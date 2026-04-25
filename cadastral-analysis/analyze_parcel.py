#!/usr/bin/env python3
"""
Análisis de parcela catastral a partir de GML INSPIRE (Catastro) + MDT02 (GeoTIFF/ASC).

Uso:
    python analyze_parcel.py --gml parcela.gml --mdt mdt02.tif [--buffer 50] [--contour-interval 1.0] [--out-dir ./output]
    python analyze_parcel.py --gml parcela.gml          # solo análisis geométrico
    python analyze_parcel.py --mdt mdt02.tif --geojson parcela.geojson  # con geometría preconvertida
"""

import argparse
import json
import math
import os
import sys
from pathlib import Path

import numpy as np
from lxml import etree
from pyproj import CRS, Transformer
from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from shapely.ops import unary_union


# ── GML INSPIRE parsing ────────────────────────────────────────────────────────

NS = {
    "gml": "http://www.opengis.net/gml/3.2",
    "cp":  "http://inspire.ec.europa.eu/schemas/cp/4.0",
    "base": "http://inspire.ec.europa.eu/schemas/base/3.3",
}


def _parse_pos_list(text: str) -> list[tuple[float, float]]:
    vals = list(map(float, text.split()))
    return [(vals[i], vals[i + 1]) for i in range(0, len(vals) - 1, 2)]


def _ring_from_linear_ring(lr_el) -> list[tuple[float, float]]:
    pl = lr_el.find(".//gml:posList", NS)
    if pl is not None:
        return _parse_pos_list(pl.text.strip())
    pts = lr_el.findall(".//gml:pos", NS)
    return [tuple(map(float, p.text.split())) for p in pts]


def _polygon_from_element(poly_el) -> Polygon:
    ext_el = poly_el.find(".//gml:exterior/gml:LinearRing", NS)
    exterior = _ring_from_linear_ring(ext_el)
    holes = [
        _ring_from_linear_ring(h.find("gml:LinearRing", NS))
        for h in poly_el.findall(".//gml:interior", NS)
    ]
    return Polygon(exterior, holes)


def parse_gml_inspire(gml_path: str) -> dict:
    """
    Devuelve dict con:
      geometry      – Shapely geometry (ETRS89 UTM30N, EPSG:25830)
      ref_catastral – str
      area_oficial  – float (m²) desde el GML, None si no viene
      srs_wkt       – str CRS del GML
    """
    tree = etree.parse(gml_path)
    root = tree.getroot()

    # referencia catastral
    ref_el = root.find(".//cp:nationalCadastralReference", NS)
    ref_cat = ref_el.text.strip() if ref_el is not None else "desconocida"

    # superficie oficial (viene en areaValue o en un attr de la feature)
    area_el = root.find(".//{http://inspire.ec.europa.eu/schemas/cp/4.0}areaValue", NS)
    area_oficial = float(area_el.text) if area_el is not None else None

    # CRS del envelope o primer geometry
    srs_name = None
    env = root.find(".//gml:Envelope", NS)
    if env is not None:
        srs_name = env.get("srsName")

    # recoger todos los polígonos
    polygons = []
    for poly_el in root.iter("{http://www.opengis.net/gml/3.2}Polygon"):
        try:
            polygons.append(_polygon_from_element(poly_el))
        except Exception as e:
            print(f"  [warn] polígono ignorado: {e}", file=sys.stderr)

    if not polygons:
        raise ValueError("No se encontraron polígonos en el GML.")

    geometry = unary_union(polygons) if len(polygons) > 1 else polygons[0]

    return {
        "geometry": geometry,
        "ref_catastral": ref_cat,
        "area_oficial": area_oficial,
        "srs_wkt": srs_name or "EPSG:25830",
    }


def parse_geojson(geojson_path: str) -> dict:
    with open(geojson_path) as f:
        data = json.load(f)
    features = data.get("features", [data]) if data.get("type") == "FeatureCollection" else [data]
    geoms = [shape(f["geometry"]) for f in features]
    geometry = unary_union(geoms)
    props = features[0].get("properties", {})
    return {
        "geometry": geometry,
        "ref_catastral": props.get("nationalCadastralReference", props.get("refcat", "desconocida")),
        "area_oficial": props.get("areaValue"),
        "srs_wkt": "EPSG:25830",
    }


# ── Geometric analysis ─────────────────────────────────────────────────────────

def geometric_analysis(geom, ref_cat: str, area_oficial) -> dict:
    area_grafica = geom.area
    perimetro = geom.length
    bounds = geom.bounds          # (minx, miny, maxx, maxy)
    centroid = geom.centroid

    bbox_width  = bounds[2] - bounds[0]
    bbox_height = bounds[3] - bounds[1]

    # orientación dominante del bounding box rotado mínimo
    try:
        from shapely.geometry import MultiPoint
        rect = geom.minimum_rotated_rectangle
        coords = list(rect.exterior.coords)
        dx = coords[1][0] - coords[0][0]
        dy = coords[1][1] - coords[0][1]
        angle_deg = math.degrees(math.atan2(dy, dx)) % 180
        side1 = math.hypot(dx, dy)
        dx2 = coords[2][0] - coords[1][0]
        dy2 = coords[2][1] - coords[1][1]
        side2 = math.hypot(dx2, dy2)
        elongacion = max(side1, side2) / min(side1, side2) if min(side1, side2) > 0 else 1.0
    except Exception:
        angle_deg, elongacion = None, None

    result = {
        "ref_catastral": ref_cat,
        "geometria": {
            "area_oficial_m2":  area_oficial,
            "area_grafica_m2":  round(area_grafica, 2),
            "area_grafica_ha":  round(area_grafica / 10_000, 4),
            "diferencia_pct":   round((area_grafica - area_oficial) / area_oficial * 100, 2)
                                if area_oficial else None,
            "perimetro_m":      round(perimetro, 2),
            "bbox": {
                "minx": round(bounds[0], 2), "miny": round(bounds[1], 2),
                "maxx": round(bounds[2], 2), "maxy": round(bounds[3], 2),
                "ancho_m": round(bbox_width, 2), "alto_m": round(bbox_height, 2),
            },
            "centroide_utm30n": {
                "x": round(centroid.x, 2), "y": round(centroid.y, 2)
            },
            "orientacion_eje_largo_deg": round(angle_deg, 1) if angle_deg is not None else None,
            "elongacion": round(elongacion, 2) if elongacion is not None else None,
        },
    }
    return result


# ── Topographic analysis ───────────────────────────────────────────────────────

def topographic_analysis(mdt_path: str, geom, buffer_m: float, contour_interval: float) -> dict:
    try:
        import rasterio
        from rasterio.mask import mask as rio_mask
        from rasterio.warp import reproject, Resampling
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib.contour import QuadContourSet
    except ImportError as e:
        return {"error": str(e)}

    geom_buf = geom.buffer(buffer_m)

    with rasterio.open(mdt_path) as src:
        raster_crs = src.crs
        # reproyectar geometría si hace falta
        if str(raster_crs) != "EPSG:25830":
            transformer = Transformer.from_crs("EPSG:25830", raster_crs, always_xy=True)
            from shapely.ops import transform as shp_transform
            geom_buf_proj = shp_transform(
                lambda x, y: transformer.transform(x, y), geom_buf
            )
            geom_proj = shp_transform(
                lambda x, y: transformer.transform(x, y), geom
            )
        else:
            geom_buf_proj = geom_buf
            geom_proj = geom

        # recortar raster a buffer
        data, transform = rio_mask(
            src,
            [mapping(geom_buf_proj)],
            crop=True,
            nodata=src.nodata or -9999,
        )
        data = data[0].astype(float)
        nodata = src.nodata or -9999
        data[data == nodata] = np.nan
        res_x = abs(transform.a)
        res_y = abs(transform.e)

    # máscara solo para la parcela (sin buffer) para estadísticas
    mask_parcel = _rasterize_geom(geom_proj, data.shape, transform)

    elev_parcel = data[mask_parcel]
    elev_parcel = elev_parcel[~np.isnan(elev_parcel)]

    if elev_parcel.size == 0:
        return {"error": "El MDT no cubre la parcela o todos los píxeles son nodata."}

    z_min  = float(np.min(elev_parcel))
    z_max  = float(np.max(elev_parcel))
    z_mean = float(np.mean(elev_parcel))
    z_std  = float(np.std(elev_parcel))
    desnivel = z_max - z_min

    # pendiente (%)
    dy_arr, dx_arr = np.gradient(data, res_y, res_x)
    slope_pct = np.sqrt(dx_arr**2 + dy_arr**2) * 100
    slope_parcel = slope_pct[mask_parcel]
    slope_parcel = slope_parcel[~np.isnan(slope_parcel)]

    slope_mean = float(np.mean(slope_parcel)) if slope_parcel.size else 0.0
    slope_max  = float(np.max(slope_parcel))  if slope_parcel.size else 0.0

    total_px = slope_parcel.size
    cat_suave  = float(np.sum(slope_parcel < 15)  / total_px * 100) if total_px else 0.0
    cat_media  = float(np.sum((slope_parcel >= 15) & (slope_parcel < 30)) / total_px * 100) if total_px else 0.0
    cat_fuerte = float(np.sum(slope_parcel >= 30)  / total_px * 100) if total_px else 0.0

    # orientación (aspecto): N=0/360, E=90, S=180, O=270
    aspect_rad = np.arctan2(-dy_arr, dx_arr)
    aspect_deg = (np.degrees(aspect_rad) + 90) % 360
    asp_parcel = aspect_deg[mask_parcel]
    asp_parcel = asp_parcel[~np.isnan(asp_parcel)]
    asp_mean = float(np.mean(asp_parcel)) if asp_parcel.size else 0.0

    def _cardinal(deg):
        dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"]
        return dirs[int((deg + 22.5) / 45) % 8]

    # propuesta de plataformas (cota base = z_min + 10% del desnivel, saltos de 3 m)
    z_base = z_min + desnivel * 0.10
    plataformas = []
    cota = z_base
    while cota <= z_max - desnivel * 0.10:
        plataformas.append(round(cota, 1))
        cota += 3.0

    return {
        "resolucion_mdt_m": round(res_x, 2),
        "altimetria": {
            "z_min_m":    round(z_min, 2),
            "z_max_m":    round(z_max, 2),
            "z_media_m":  round(z_mean, 2),
            "z_std_m":    round(z_std, 2),
            "desnivel_m": round(desnivel, 2),
        },
        "pendiente": {
            "media_pct":    round(slope_mean, 1),
            "maxima_pct":   round(slope_max, 1),
            "cat_suave_pct_lt15":   round(cat_suave, 1),
            "cat_media_pct_15a30":  round(cat_media, 1),
            "cat_fuerte_pct_gt30":  round(cat_fuerte, 1),
        },
        "orientacion_dominante": {
            "grados":   round(asp_mean, 1),
            "cardinal": _cardinal(asp_mean),
        },
        "plataformas_propuestas_cota_m": plataformas[:10],
        "buffer_analisis_m": buffer_m,
        "intervalo_curvas_m": contour_interval,
    }


def _rasterize_geom(geom, shape_rc, transform):
    """Devuelve máscara booleana (H×W) para la geometría sobre el raster."""
    from rasterio.features import geometry_mask
    mask = geometry_mask(
        [mapping(geom)],
        transform=transform,
        invert=True,
        out_shape=shape_rc,
    )
    return mask


# ── Map outputs ────────────────────────────────────────────────────────────────

def save_maps(mdt_path: str, geom, buffer_m: float, contour_interval: float, out_dir: Path):
    try:
        import rasterio
        from rasterio.mask import mask as rio_mask
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib.colors import LightSource
    except ImportError:
        print("[warn] matplotlib/rasterio no disponible, no se generan mapas.", file=sys.stderr)
        return []

    geom_buf = geom.buffer(buffer_m)

    with rasterio.open(mdt_path) as src:
        data, transform = rio_mask(src, [mapping(geom_buf)], crop=True, nodata=src.nodata or -9999)
        data = data[0].astype(float)
        data[data == (src.nodata or -9999)] = np.nan
        res_x = abs(transform.a)
        res_y = abs(transform.e)

    # coordenadas para imshow
    rows, cols = data.shape
    x0, y0 = transform.c, transform.f
    extent = [x0, x0 + cols * res_x, y0 - rows * res_y, y0]

    dy_arr, dx_arr = np.gradient(data, res_y, res_x)
    slope_pct = np.sqrt(dx_arr**2 + dy_arr**2) * 100

    saved = []
    out_dir.mkdir(parents=True, exist_ok=True)

    # mapa 1: hillshade + curvas de nivel
    fig, ax = plt.subplots(figsize=(10, 10))
    ls = LightSource(azdeg=315, altdeg=45)
    hillshade = ls.hillshade(data, vert_exag=2, dx=res_x, dy=res_y)
    ax.imshow(hillshade, cmap="gray", extent=extent, origin="upper", alpha=0.7)
    # curvas de nivel
    z_min = float(np.nanmin(data))
    z_max = float(np.nanmax(data))
    levels = np.arange(
        math.ceil(z_min / contour_interval) * contour_interval,
        math.floor(z_max / contour_interval) * contour_interval + contour_interval,
        contour_interval,
    )
    x_arr = np.linspace(x0, x0 + cols * res_x, cols)
    y_arr = np.linspace(y0, y0 - rows * res_y, rows)
    cs = ax.contour(x_arr, y_arr, data, levels=levels, colors="saddlebrown", linewidths=0.5)
    ax.clabel(cs, inline=True, fontsize=6, fmt="%.0f m")
    # límite parcela
    if hasattr(geom, "geoms"):
        for g in geom.geoms:
            xs, ys = g.exterior.xy
            ax.plot(xs, ys, "r-", linewidth=2)
    else:
        xs, ys = geom.exterior.xy
        ax.plot(xs, ys, "r-", linewidth=2)
    ax.set_title(f"Hillshade + Curvas de nivel (Δ={contour_interval} m)")
    ax.set_xlabel("X UTM30N (m)")
    ax.set_ylabel("Y UTM30N (m)")
    p = out_dir / "hillshade_curvas.png"
    fig.savefig(p, dpi=150, bbox_inches="tight")
    plt.close(fig)
    saved.append(str(p))

    # mapa 2: mapa de pendientes por categoría
    fig, ax = plt.subplots(figsize=(10, 10))
    import matplotlib.colors as mcolors
    cmap = mcolors.ListedColormap(["#a8d5a2", "#f9c74f", "#f94144"])
    bounds_c = [0, 15, 30, 200]
    norm = mcolors.BoundaryNorm(bounds_c, cmap.N)
    im = ax.imshow(slope_pct, cmap=cmap, norm=norm, extent=extent, origin="upper")
    cbar = fig.colorbar(im, ax=ax, ticks=[7.5, 22.5, 115])
    cbar.ax.set_yticklabels(["<15% (suave)", "15–30% (media)", ">30% (fuerte)"])
    if hasattr(geom, "geoms"):
        for g in geom.geoms:
            xs, ys = g.exterior.xy
            ax.plot(xs, ys, "k-", linewidth=2)
    else:
        xs, ys = geom.exterior.xy
        ax.plot(xs, ys, "k-", linewidth=2)
    ax.set_title("Mapa de pendientes (%)")
    ax.set_xlabel("X UTM30N (m)")
    ax.set_ylabel("Y UTM30N (m)")
    p = out_dir / "mapa_pendientes.png"
    fig.savefig(p, dpi=150, bbox_inches="tight")
    plt.close(fig)
    saved.append(str(p))

    return saved


# ── GeoJSON output ─────────────────────────────────────────────────────────────

def save_geojson(geom, props: dict, out_path: Path):
    feature = {
        "type": "Feature",
        "geometry": mapping(geom),
        "properties": props,
    }
    fc = {"type": "FeatureCollection", "features": [feature]}
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False, indent=2)


# ── CLI ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Análisis parcela catastral")
    parser.add_argument("--gml",     help="GML INSPIRE del Catastro (WFS)")
    parser.add_argument("--geojson", help="GeoJSON de la parcela (alternativa al GML)")
    parser.add_argument("--mdt",     help="MDT02 GeoTIFF o ASC del CNIG")
    parser.add_argument("--buffer",  type=float, default=50.0,
                        help="Buffer en metros para análisis topográfico (default: 50)")
    parser.add_argument("--contour-interval", type=float, default=1.0,
                        help="Equidistancia curvas de nivel en metros (default: 1.0)")
    parser.add_argument("--out-dir", default="./output",
                        help="Directorio de salida (default: ./output)")
    args = parser.parse_args()

    if not args.gml and not args.geojson:
        parser.error("Se requiere --gml o --geojson")

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    print("\n═══ Análisis de Parcela Catastral ═══\n")

    # 1) Cargar geometría
    if args.gml:
        print(f"▸ Leyendo GML INSPIRE: {args.gml}")
        parcel = parse_gml_inspire(args.gml)
    else:
        print(f"▸ Leyendo GeoJSON: {args.geojson}")
        parcel = parse_geojson(args.geojson)

    geom = parcel["geometry"]
    print(f"  Ref. catastral: {parcel['ref_catastral']}")
    print(f"  Tipo geometría: {geom.geom_type}")

    # 2) Análisis geométrico
    print("\n▸ Calculando métricas geométricas…")
    geo_result = geometric_analysis(geom, parcel["ref_catastral"], parcel["area_oficial"])
    g = geo_result["geometria"]
    print(f"  Área gráfica:  {g['area_grafica_m2']} m²  ({g['area_grafica_ha']} ha)")
    if g["diferencia_pct"] is not None:
        print(f"  Área oficial:  {g['area_oficial_m2']} m²  (diferencia: {g['diferencia_pct']:+.2f}%)")
    print(f"  Perímetro:     {g['perimetro_m']} m")
    bb = g["bbox"]
    print(f"  BBox:          {bb['ancho_m']} × {bb['alto_m']} m  "
          f"(SW {bb['minx']}, {bb['miny']})")
    if g["orientacion_eje_largo_deg"] is not None:
        print(f"  Eje largo:     {g['orientacion_eje_largo_deg']}°  elongación {g['elongacion']}x")

    report = {**geo_result}

    # 3) Análisis topográfico (opcional)
    if args.mdt:
        print(f"\n▸ Analizando MDT: {args.mdt}  (buffer {args.buffer} m)")
        topo = topographic_analysis(args.mdt, geom, args.buffer, args.contour_interval)
        if "error" in topo:
            print(f"  [error topografía] {topo['error']}")
        else:
            a = topo["altimetria"]
            s = topo["pendiente"]
            o = topo["orientacion_dominante"]
            print(f"  Altimetría:    {a['z_min_m']}–{a['z_max_m']} m  "
                  f"(media {a['z_media_m']} m, desnivel {a['desnivel_m']} m)")
            print(f"  Pendiente:     media {s['media_pct']}%  máx {s['maxima_pct']}%")
            print(f"  Categorías:    suave <15%: {s['cat_suave_pct_lt15']}%  "
                  f"media 15-30%: {s['cat_media_pct_15a30']}%  "
                  f"fuerte >30%: {s['cat_fuerte_pct_gt30']}%")
            print(f"  Orientación:   {o['cardinal']} ({o['grados']}°)")
            if topo["plataformas_propuestas_cota_m"]:
                plats = ", ".join(f"{c} m" for c in topo["plataformas_propuestas_cota_m"])
                print(f"  Plataformas:   {plats}")

        report["topografia"] = topo

        # Mapas
        print("\n▸ Generando mapas…")
        maps = save_maps(args.mdt, geom, args.buffer, args.contour_interval, out_dir)
        for m in maps:
            print(f"  ✓ {m}")
        report["mapas_generados"] = maps
    else:
        print("\n  (sin --mdt: análisis topográfico omitido)")

    # 4) Guardar GeoJSON
    geojson_path = out_dir / "parcela.geojson"
    props_flat = {
        "ref_catastral": parcel["ref_catastral"],
        "area_grafica_m2": g["area_grafica_m2"],
        "perimetro_m": g["perimetro_m"],
    }
    if "topografia" in report and "error" not in report["topografia"]:
        a = report["topografia"]["altimetria"]
        props_flat.update({
            "z_min_m": a["z_min_m"],
            "z_max_m": a["z_max_m"],
            "desnivel_m": a["desnivel_m"],
            "pendiente_media_pct": report["topografia"]["pendiente"]["media_pct"],
            "orientacion": report["topografia"]["orientacion_dominante"]["cardinal"],
        })
    save_geojson(geom, props_flat, geojson_path)
    print(f"\n▸ GeoJSON guardado: {geojson_path}")

    # 5) JSON resumen
    json_path = out_dir / "analisis.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"▸ Informe JSON:    {json_path}")

    print("\n═══ Análisis completado ═══\n")
    return report


if __name__ == "__main__":
    main()
