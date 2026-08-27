#!/usr/bin/env python3
"""
Descarga automática de datos para una referencia catastral:
  1. GML INSPIRE desde el WFS del Catastro (ovc.catastro.meh.es)
  2. MDT02 (2 m resolución) desde el WCS del CNIG / IDEE (servicios.idee.es)

Uso:
    python download_data.py --refcat 4414604UF1440N0001ZX [--buffer 150] [--out-dir ./data]

Requisitos: pip install requests lxml shapely pyproj
"""

import argparse
import sys
import time
from pathlib import Path

import requests
from lxml import etree

# Headers para parecer un navegador normal y evitar bloqueos de servidor
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}

CATASTRO_WFS = "https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx"
CNIG_WCS     = "https://servicios.idee.es/wcs-inspire/mdt"


def download_gml(refcat: str, out_path: Path, timeout: int = 30) -> Path:
    """Descarga el GML INSPIRE de la parcela desde el WFS del Catastro."""
    params = {
        "service":           "WFS",
        "version":           "2.0.0",
        "request":           "GetFeature",
        "STOREDQUERIE_ID":   "GetParcel",
        "refcat":            refcat,
    }
    print(f"▸ Descargando GML del Catastro para refcat {refcat}…")
    r = requests.get(CATASTRO_WFS, params=params, headers=BROWSER_HEADERS, timeout=timeout)
    r.raise_for_status()

    # Verificar que es XML válido y contiene geometría
    try:
        root = etree.fromstring(r.content)
    except etree.XMLSyntaxError as e:
        raise ValueError(f"Respuesta no es XML válido: {e}\nContenido: {r.text[:200]}")

    # el WFS devuelve ExceptionReport si la refcat no existe
    if "ExceptionReport" in root.tag or "Exception" in root.tag:
        ns = {"ows": "http://www.opengis.net/ows"}
        msg_el = root.find(".//ows:ExceptionText", ns) or root.find(".//{*}ExceptionText")
        msg = msg_el.text if msg_el is not None else r.text[:300]
        raise ValueError(f"WFS devolvió error: {msg}")

    out_path.write_bytes(r.content)
    size_kb = len(r.content) / 1024
    print(f"  ✓ Guardado: {out_path}  ({size_kb:.1f} KB)")
    return out_path


def bbox_from_gml(gml_path: Path) -> tuple[float, float, float, float]:
    """Extrae la bounding box (minx, miny, maxx, maxy) desde el GML."""
    tree = etree.parse(str(gml_path))
    root = tree.getroot()

    NS = {"gml": "http://www.opengis.net/gml/3.2"}

    # buscar en Envelope primero (forma rápida)
    env = root.find(".//gml:Envelope", NS)
    if env is not None:
        lc = env.find("gml:lowerCorner", NS)
        uc = env.find("gml:upperCorner", NS)
        if lc is not None and uc is not None:
            x1, y1 = map(float, lc.text.split())
            x2, y2 = map(float, uc.text.split())
            return min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2)

    # fallback: leer todos los posList y calcular bbox manualmente
    all_x, all_y = [], []
    for pl in root.iter("{http://www.opengis.net/gml/3.2}posList"):
        vals = list(map(float, pl.text.split()))
        all_x.extend(vals[0::2])
        all_y.extend(vals[1::2])
    if not all_x:
        raise ValueError("No se pudo extraer bbox del GML.")
    return min(all_x), min(all_y), max(all_x), max(all_y)


def download_mdt02(bbox: tuple[float, float, float, float],
                   buffer_m: float,
                   out_path: Path,
                   timeout: int = 120) -> Path:
    """
    Descarga el MDT02 (2 m resolución, ETRS89 UTM30N) para la bbox + buffer
    desde el WCS del CNIG/IDEE.
    """
    minx, miny, maxx, maxy = bbox
    # aplicar buffer
    minx -= buffer_m
    miny -= buffer_m
    maxx += buffer_m
    maxy += buffer_m

    width_m  = maxx - minx
    height_m = maxy - miny
    # MDT02 es 2 m/píxel → tamaño en píxeles
    width_px  = max(1, int(width_m  / 2))
    height_px = max(1, int(height_m / 2))

    # Límite razonable para no pedir demasiado en una sola descarga
    MAX_PX = 4000
    if width_px > MAX_PX or height_px > MAX_PX:
        scale = max(width_px, height_px) / MAX_PX
        width_px  = int(width_px  / scale)
        height_px = int(height_px / scale)
        print(f"  [info] Imagen reducida a {width_px}×{height_px} px (máx {MAX_PX})")

    # WCS 1.0 – más compatible con servicios CNIG
    params = {
        "SERVICE":    "WCS",
        "VERSION":    "1.0.0",
        "REQUEST":    "GetCoverage",
        "COVERAGE":   "MDT02",
        "CRS":        "EPSG:25830",
        "BBOX":       f"{minx},{miny},{maxx},{maxy}",
        "WIDTH":      str(width_px),
        "HEIGHT":     str(height_px),
        "FORMAT":     "GeoTIFF",
    }

    print(f"▸ Descargando MDT02 del CNIG  [{width_px}×{height_px} px, {width_m:.0f}×{height_m:.0f} m]…")
    print(f"  BBox: ({minx:.0f}, {miny:.0f}) – ({maxx:.0f}, {maxy:.0f})")

    r = requests.get(CNIG_WCS, params=params, headers=BROWSER_HEADERS,
                     timeout=timeout, stream=True)
    r.raise_for_status()

    content_type = r.headers.get("Content-Type", "")
    if "xml" in content_type or "text" in content_type:
        snippet = r.content[:500].decode(errors="replace")
        raise ValueError(
            f"WCS devolvió texto en lugar de GeoTIFF (posible error de servicio):\n{snippet}"
        )

    out_path.write_bytes(r.content)
    size_mb = len(r.content) / (1024 * 1024)
    print(f"  ✓ Guardado: {out_path}  ({size_mb:.2f} MB)")
    return out_path


def _retry(fn, retries: int = 3, delay: float = 2.0):
    """Reintenta fn hasta retries veces con backoff exponencial."""
    for attempt in range(1, retries + 1):
        try:
            return fn()
        except requests.RequestException as e:
            if attempt == retries:
                raise
            wait = delay * (2 ** (attempt - 1))
            print(f"  [reintento {attempt}/{retries}] Error: {e}  — esperando {wait:.0f} s")
            time.sleep(wait)


def main():
    parser = argparse.ArgumentParser(
        description="Descarga GML (Catastro) + MDT02 (CNIG) para una parcela catastral"
    )
    parser.add_argument("--refcat", required=True,
                        help="Referencia catastral (ej: 4414604UF1440N0001ZX)")
    parser.add_argument("--buffer", type=float, default=150.0,
                        help="Buffer en metros alrededor de la parcela para el MDT (default: 150)")
    parser.add_argument("--out-dir", default="./data",
                        help="Directorio de salida (default: ./data)")
    parser.add_argument("--skip-mdt", action="store_true",
                        help="Descargar solo el GML, sin MDT")
    args = parser.parse_args()

    refcat  = args.refcat.strip().upper()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n═══ Descarga de datos catastrales — {refcat} ═══\n")

    # 1) GML INSPIRE
    gml_path = out_dir / f"{refcat}.gml"
    _retry(lambda: download_gml(refcat, gml_path))

    if args.skip_mdt:
        print("\n  (--skip-mdt: descarga de MDT omitida)")
        print("\n═══ Descarga completada ═══\n")
        return {"gml": str(gml_path)}

    # 2) BBox desde el GML
    print("\n▸ Extrayendo bounding box del GML…")
    bbox = bbox_from_gml(gml_path)
    print(f"  BBox parcela: ({bbox[0]:.1f}, {bbox[1]:.1f}) – ({bbox[2]:.1f}, {bbox[3]:.1f})")
    print(f"  Dimensiones:  {bbox[2]-bbox[0]:.1f} × {bbox[3]-bbox[1]:.1f} m")

    # 3) MDT02
    mdt_path = out_dir / f"{refcat}_mdt02.tif"
    _retry(lambda: download_mdt02(bbox, args.buffer, mdt_path))

    print(f"\n═══ Descarga completada ═══")
    print(f"  GML:   {gml_path}")
    print(f"  MDT02: {mdt_path}")
    print(f"\nSiguiente paso:")
    print(f"  python analyze_parcel.py --gml {gml_path} --mdt {mdt_path} --out-dir ./output\n")

    return {"gml": str(gml_path), "mdt": str(mdt_path)}


if __name__ == "__main__":
    main()
