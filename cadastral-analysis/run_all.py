#!/usr/bin/env python3
"""
Pipeline completo: descarga + análisis de una parcela catastral.

Uso rápido:
    python run_all.py --refcat 4414604UF1440N0001ZX

Opciones:
    --refcat        Referencia catastral (obligatorio)
    --buffer        Buffer MDT en metros (default: 150)
    --contour       Equidistancia curvas de nivel en metros (default: 1.0)
    --out-dir       Directorio de salida (default: ./output/<refcat>)
    --skip-mdt      Solo geometría, sin topografía
    --skip-download Usar datos ya descargados en --out-dir/data/
"""

import argparse
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Análisis completo de parcela catastral")
    parser.add_argument("--refcat", required=True,
                        help="Referencia catastral (ej: 4414604UF1440N0001ZX)")
    parser.add_argument("--buffer", type=float, default=150.0,
                        help="Buffer MDT en metros (default: 150)")
    parser.add_argument("--contour", type=float, default=1.0,
                        help="Equidistancia curvas de nivel en metros (default: 1.0)")
    parser.add_argument("--out-dir", default=None,
                        help="Directorio raíz de salida (default: ./output/<refcat>)")
    parser.add_argument("--skip-mdt", action="store_true",
                        help="Solo análisis geométrico, sin topografía ni MDT")
    parser.add_argument("--skip-download", action="store_true",
                        help="Omitir descarga, usar archivos ya presentes en <out-dir>/data/")
    args = parser.parse_args()

    refcat  = args.refcat.strip().upper()
    out_dir = Path(args.out_dir) if args.out_dir else Path("output") / refcat
    data_dir = out_dir / "data"
    maps_dir = out_dir / "maps"
    out_dir.mkdir(parents=True, exist_ok=True)

    gml_path = data_dir / f"{refcat}.gml"
    mdt_path = data_dir / f"{refcat}_mdt02.tif"

    # ── 1. Descarga ────────────────────────────────────────────────────────────
    if not args.skip_download:
        from download_data import main as dl_main
        import sys as _sys
        old_argv = _sys.argv
        dl_args = [
            "download_data.py",
            "--refcat", refcat,
            "--buffer", str(args.buffer),
            "--out-dir", str(data_dir),
        ]
        if args.skip_mdt:
            dl_args.append("--skip-mdt")
        _sys.argv = dl_args
        try:
            dl_main()
        finally:
            _sys.argv = old_argv
    else:
        print(f"▸ Usando datos existentes en {data_dir}")
        if not gml_path.exists():
            print(f"  [error] No se encuentra {gml_path}", file=sys.stderr)
            sys.exit(1)

    # ── 2. Análisis ────────────────────────────────────────────────────────────
    from analyze_parcel import main as analyze_main
    import sys as _sys
    old_argv = _sys.argv
    analyze_args = [
        "analyze_parcel.py",
        "--gml", str(gml_path),
        "--buffer", str(args.buffer),
        "--contour-interval", str(args.contour),
        "--out-dir", str(maps_dir),
    ]
    if not args.skip_mdt and mdt_path.exists():
        analyze_args += ["--mdt", str(mdt_path)]
    elif not args.skip_mdt and not mdt_path.exists():
        print(f"\n  [aviso] MDT no encontrado en {mdt_path} — se omite análisis topográfico.")

    _sys.argv = analyze_args
    try:
        report = analyze_main()
    finally:
        _sys.argv = old_argv

    # ── 3. Resumen final ───────────────────────────────────────────────────────
    print("\n" + "═" * 50)
    print(f"  Ref. catastral: {refcat}")
    print(f"  Directorio:     {out_dir.resolve()}")
    print(f"  Archivos generados:")
    for f in sorted(out_dir.rglob("*")):
        if f.is_file():
            size = f.stat().st_size
            unit = "KB" if size < 1_048_576 else "MB"
            val  = size / 1024 if size < 1_048_576 else size / 1_048_576
            print(f"    {f.relative_to(out_dir)}  ({val:.1f} {unit})")
    print("═" * 50 + "\n")


if __name__ == "__main__":
    main()
