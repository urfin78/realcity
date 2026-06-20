#!/usr/bin/env python3
"""
Generiert eine Spielkarte aus SRTM-Höhendaten + OSM-Wasser/Wald.
Ausgabe: maps/<stadtname>.json

SRTM-Daten: https://srtm.csi.cgiar.org/srtmdata/
Lizenz: Public Domain (NASA)
OSM-Daten: © OpenStreetMap contributors (ODbL)

Verwendung:
  python3 tools/generate_map.py Dresden 51.05 13.74
  python3 tools/generate_map.py Hamburg 53.55 10.00
"""

import sys
import os
import json
import struct
import zipfile
import math
import requests

# --- Konfiguration ---
GRID       = 128       # Spielraster-Auflösung (128×128 Felder)
AREA_KM    = 5         # Kartengröße in km (Radius)
SRTM_DIR   = os.path.join(os.path.dirname(__file__), '..', 'srtm')
MAPS_DIR   = os.path.join(os.path.dirname(__file__), '..', 'maps')
SRTM_URL   = 'https://srtm.csi.cgiar.org/wp-content/uploads/files/srtm_5x5/TIFF/'

# Grad-Ausdehnung für ~20km Radius
DEG_LAT = AREA_KM / 111.32
def deg_lon(lat): return AREA_KM / (111.32 * math.cos(math.radians(lat)))


# --- SRTM ---

def srtm_tile_name(lat, lon):
    """CGIAR-SRTM Kachelname für eine Koordinate."""
    # CGIAR teilt die Welt in 5°×5° Kacheln
    col = int((lon + 180) / 5) + 1
    row = int((60 - lat) / 5) + 1
    return f"srtm_{col:02d}_{row:02d}"

def download_srtm(tile_name):
    """Lädt eine SRTM-Kachel herunter falls nicht gecacht."""
    zip_path = os.path.join(SRTM_DIR, f"{tile_name}.zip")
    tif_path = os.path.join(SRTM_DIR, f"{tile_name}.tif")

    if os.path.exists(tif_path):
        return tif_path

    if not os.path.exists(zip_path):
        url = f"{SRTM_URL}{tile_name}.zip"
        print(f"  Lade SRTM-Kachel: {url}")
        r = requests.get(url, stream=True, timeout=60)
        if r.status_code != 200:
            raise RuntimeError(f"SRTM Download fehlgeschlagen: {r.status_code} — {url}")
        os.makedirs(SRTM_DIR, exist_ok=True)
        with open(zip_path, 'wb') as f:
            for chunk in r.iter_content(65536):
                f.write(chunk)
        print(f"  Gespeichert: {zip_path}")

    print(f"  Entpacke {zip_path}...")
    with zipfile.ZipFile(zip_path) as z:
        for name in z.namelist():
            if name.endswith('.tif'):
                z.extract(name, SRTM_DIR)
                extracted = os.path.join(SRTM_DIR, name)
                os.rename(extracted, tif_path)
                break

    return tif_path

def read_srtm_tif(tif_path, min_lat, max_lat, min_lon, max_lon, grid):
    """
    Liest Höhenwerte aus einer GeoTIFF-Datei (CGIAR SRTM, 6000×6000 Pixel pro 5°×5°).
    Gibt ein grid×grid Array zurück.
    """
    try:
        # GeoTIFF minimal parsen — CGIAR SRTM ist immer 6000×6000, Int16, 5°×5°
        # Kachel-Bounds aus dem Dateinamen ableiten
        base = os.path.basename(tif_path).replace('.tif', '')
        parts = base.split('_')
        col, row = int(parts[1]), int(parts[2])
        tile_lon_min = (col - 1) * 5 - 180
        tile_lat_max = 60 - (row - 1) * 5
        tile_lon_max = tile_lon_min + 5
        tile_lat_min = tile_lat_max - 5

        # GeoTIFF lesen mit rasterio falls vorhanden, sonst Fallback
        try:
            import rasterio
            with rasterio.open(tif_path) as src:
                return _sample_rasterio(src, min_lat, max_lat, min_lon, max_lon, grid)
        except ImportError:
            pass

        # Fallback: TIFF direkt lesen (vereinfacht für CGIAR SRTM)
        return _sample_tif_raw(tif_path, tile_lat_min, tile_lat_max,
                               tile_lon_min, tile_lon_max,
                               min_lat, max_lat, min_lon, max_lon, grid)

    except Exception as e:
        raise RuntimeError(f"Fehler beim Lesen von {tif_path}: {e}")

def _sample_rasterio(src, min_lat, max_lat, min_lon, max_lon, grid):
    from rasterio.windows import from_bounds
    from rasterio.enums import Resampling
    import numpy as np

    window = from_bounds(min_lon, min_lat, max_lon, max_lat, src.transform)
    data = src.read(1, window=window, out_shape=(grid, grid),
                    resampling=Resampling.bilinear)
    data = np.where(data < -1000, 0, data)  # NoData → 0
    return data.flatten().tolist()

def _sample_tif_raw(tif_path, tile_lat_min, tile_lat_max, tile_lon_min, tile_lon_max,
                    min_lat, max_lat, min_lon, max_lon, grid):
    """Minimaler TIFF-Reader für CGIAR SRTM (Int16, 6000×6000)."""
    TILE_SIZE = 6000

    with open(tif_path, 'rb') as f:
        # TIFF-Header überspringen — direkt die Pixel-Daten lesen
        # CGIAR SRTM TIFFs haben einen festen Offset (nach IFD)
        # Wir suchen den Pixel-Offset aus dem TIFF-Tag StripOffsets (Tag 273)
        f.seek(0)
        byte_order = f.read(2)
        big_endian = byte_order == b'MM'
        bo = '>' if big_endian else '<'

        f.seek(4)
        ifd_offset = struct.unpack(bo + 'I', f.read(4))[0]
        f.seek(ifd_offset)
        num_entries = struct.unpack(bo + 'H', f.read(2))[0]

        strip_offsets = []
        for _ in range(num_entries):
            tag, typ, count = struct.unpack(bo + 'HHI', f.read(8))
            value_raw = f.read(4)
            if tag == 273:  # StripOffsets
                if count == 1:
                    strip_offsets = [struct.unpack(bo + 'I', value_raw)[0]]
                else:
                    ptr = struct.unpack(bo + 'I', value_raw)[0]
                    pos = f.tell()
                    f.seek(ptr)
                    strip_offsets = list(struct.unpack(bo + f'{count}I', f.read(4*count)))
                    f.seek(pos)

        if not strip_offsets:
            raise RuntimeError("Konnte TIFF-Offset nicht lesen")

        data_offset = strip_offsets[0]

        result = []
        for gy in range(grid):
            for gx in range(grid):
                lat = max_lat - (gy / (grid - 1)) * (max_lat - min_lat)
                lon = min_lon + (gx / (grid - 1)) * (max_lon - min_lon)

                # Pixel-Position in der Kachel
                px = int((lon - tile_lon_min) / (tile_lon_max - tile_lon_min) * TILE_SIZE)
                py = int((tile_lat_max - lat)  / (tile_lat_max - tile_lat_min) * TILE_SIZE)
                px = max(0, min(TILE_SIZE - 1, px))
                py = max(0, min(TILE_SIZE - 1, py))

                offset = data_offset + (py * TILE_SIZE + px) * 2
                f.seek(offset)
                val = struct.unpack(bo + 'h', f.read(2))[0]
                result.append(max(0, val))

        return result


# --- OSM ---

def fetch_osm(min_lat, max_lat, min_lon, max_lon):
    """Lädt Wasser und Wald aus der Overpass API."""
    b = f"{min_lat},{min_lon},{max_lat},{max_lon}"
    # Wasserwege mit großem Puffer (~100km) damit Flüsse aus jeder
    # Richtung vollständig geladen werden
    bw = f"{min_lat - 0.5},{min_lon - 0.5},{max_lat + 0.5},{max_lon + 0.5}"
    query = f"""
    [out:json][timeout:60];
    (
      way["waterway"~"river|canal"]({bw});
      way["natural"="wood"]({b});
      way["landuse"="forest"]({b});
      relation["natural"="wood"]({b});
      relation["landuse"="forest"]({b});
    );
    out geom;
    """
    print("  Lade OSM-Daten (Overpass API)...")
    r = requests.post('https://overpass-api.de/api/interpreter',
                      data={'data': query}, timeout=90,
                      headers={'User-Agent': 'RealCity-MapGenerator/1.0'})
    r.raise_for_status()
    return r.json().get('elements', [])

def rasterize_osm(elements, min_lat, max_lat, min_lon, max_lon, grid):
    """Rasterisiert OSM-Polygone in grid×grid Boolean-Arrays."""
    water  = [0] * (grid * grid)
    forest = [0] * (grid * grid)

    def geo_to_cell_f(lat, lon):
        """Gibt float-Koordinaten zurück (nicht geclippt)."""
        col = (lon - min_lon) / (max_lon - min_lon) * (grid - 1)
        row = (max_lat - lat) / (max_lat - min_lat) * (grid - 1)
        return col, row

    def geo_to_cell(lat, lon):
        col, row = geo_to_cell_f(lat, lon)
        return int(max(0, min(grid-1, col))), int(max(0, min(grid-1, row)))

    def clip_segment(x0, y0, x1, y1):
        """Cohen-Sutherland Line Clipping auf [0, grid-1] × [0, grid-1].
        Gibt (x0, y0, x1, y1, visible) zurück."""
        XMIN, XMAX, YMIN, YMAX = 0, grid-1, 0, grid-1
        INSIDE, LEFT, RIGHT, BOTTOM, TOP = 0, 1, 2, 4, 8

        def code(x, y):
            c = INSIDE
            if x < XMIN: c |= LEFT
            elif x > XMAX: c |= RIGHT
            if y < YMIN: c |= TOP
            elif y > YMAX: c |= BOTTOM
            return c

        c0, c1 = code(x0, y0), code(x1, y1)
        while True:
            if not (c0 | c1):   return x0, y0, x1, y1, True   # beide innen
            if c0 & c1:         return x0, y0, x1, y1, False   # beide außen
            c = c0 if c0 else c1
            if c & BOTTOM:
                x = x0 + (x1-x0) * (YMAX-y0) / (y1-y0); y = YMAX
            elif c & TOP:
                x = x0 + (x1-x0) * (YMIN-y0) / (y1-y0); y = YMIN
            elif c & RIGHT:
                y = y0 + (y1-y0) * (XMAX-x0) / (x1-x0); x = XMAX
            else:
                y = y0 + (y1-y0) * (XMIN-x0) / (x1-x0); x = XMIN
            if c == c0: x0, y0, c0 = x, y, code(x, y)
            else:       x1, y1, c1 = x, y, code(x, y)

    def rasterize_poly(coords, target):
        if len(coords) < 3:
            return
        pts = [geo_to_cell(c['lat'], c['lon']) for c in coords]
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        min_x, max_x = max(0,min(xs)), min(grid-1,max(xs))
        min_y, max_y = max(0,min(ys)), min(grid-1,max(ys))
        for gy in range(min_y, max_y+1):
            for gx in range(min_x, max_x+1):
                if point_in_poly(gx+.5, gy+.5, pts):
                    target[gy * grid + gx] = 1
        if not any(target[p[1]*grid+p[0]] for p in pts):
            for p in pts:
                target[p[1]*grid+p[0]] = 1

    def rasterize_line_with_width(coords, target, width=3):
        """Zeichnet eine Linie mit Clipping und gegebener Breite."""
        r = width // 2
        pts_f = [geo_to_cell_f(c['lat'], c['lon']) for c in coords]
        for i in range(len(pts_f) - 1):
            fx0, fy0 = pts_f[i]
            fx1, fy1 = pts_f[i+1]
            cx0, cy0, cx1, cy1, visible = clip_segment(fx0, fy0, fx1, fy1)
            if not visible:
                continue
            x0, y0 = int(round(cx0)), int(round(cy0))
            x1, y1 = int(round(cx1)), int(round(cy1))
            # Bresenham auf geclippten Koordinaten
            dx, dy = abs(x1-x0), abs(y1-y0)
            sx, sy = (1 if x0<x1 else -1), (1 if y0<y1 else -1)
            err = dx - dy
            while True:
                for ox in range(-r, r+1):
                    for oy in range(-r, r+1):
                        nx, ny = x0+ox, y0+oy
                        if 0 <= nx < grid and 0 <= ny < grid:
                            target[ny*grid+nx] = 1
                if x0 == x1 and y0 == y1: break
                e2 = 2*err
                if e2 > -dy: err -= dy; x0 += sx
                if e2 < dx:  err += dx; y0 += sy

    def point_in_poly(px, py, poly):
        inside = False
        n = len(poly)
        j = n - 1
        for i in range(n):
            xi, yi = poly[i]; xj, yj = poly[j]
            if ((yi > py) != (yj > py)) and (px < (xj-xi)*(py-yi)/(yj-yi)+xi):
                inside = not inside
            j = i
        return inside

    for el in elements:
        is_water  = el.get('tags',{}).get('natural') == 'water' or \
                    el.get('tags',{}).get('waterway') in ('river','canal')
        is_forest = el.get('tags',{}).get('natural') == 'wood' or \
                    el.get('tags',{}).get('landuse') == 'forest'
        target = water if is_water else forest if is_forest else None
        if target is None:
            continue

        if el['type'] == 'way' and 'geometry' in el:
            if is_water:
                tags = el.get('tags', {})
                m_per_px = (AREA_KM * 2 * 1000) / GRID  # Meter pro Pixel
                try:
                    parts = str(tags.get('width') or '').split()
                    width_m = float(parts[0]) if parts else None
                except (ValueError, TypeError):
                    width_m = None
                if width_m is not None:
                    width = max(1, round(width_m / m_per_px))
                elif tags.get('CEMT'):
                    # Schiffbare Hauptwasserstraße (Elbe, Mulde etc.) → breiter
                    width = 3
                else:
                    width = 1
                rasterize_line_with_width(el['geometry'], target, width=width)
            else:
                rasterize_poly(el['geometry'], target)
        elif el['type'] == 'relation' and 'members' in el:
            for m in el['members']:
                if m.get('role') == 'outer' and 'geometry' in m:
                    rasterize_poly(m['geometry'], target)

    # Wasser: kein Erosions-Filter (OSM-Daten sind korrekt, Randpixel würden sonst entfernt)
    water  = morphology_clean(water,  grid, min_neighbors=0, dilate=False)
    # Wald: moderat glätten
    forest = morphology_clean(forest, grid, min_neighbors=3, dilate=False)
    # Wasser hat Vorrang vor Wald
    for i in range(grid * grid):
        if water[i]: forest[i] = 0

    return water, forest


def morphology_clean(data, grid, min_neighbors=2, dilate=True):
    """Entfernt isolierte Zellen und schließt kleine Lücken."""
    def neighbors(i):
        x, y = i % grid, i // grid
        count = 0
        for dx, dy in [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(1,-1),(-1,1),(1,1)]:
            nx, ny = x+dx, y+dy
            if 0 <= nx < grid and 0 <= ny < grid:
                count += data[ny*grid+nx]
        return count

    # Erosion: isolierte Pixel entfernen
    cleaned = list(data)
    for i in range(grid * grid):
        if cleaned[i] and neighbors(i) < min_neighbors:
            cleaned[i] = 0

    if not dilate:
        return cleaned

    # Dilation: Lücken in Flächen schließen (Zelle wird gesetzt wenn ≥4 Nachbarn gesetzt)
    dilated = list(cleaned)
    for i in range(grid * grid):
        if not dilated[i] and neighbors(i) >= 4:
            dilated[i] = 1

    return dilated


# --- Gauss-Glättung ---

def gauss_smooth(data, grid, sigma=2.0):
    import math
    r = int(math.ceil(sigma * 2))
    kernel = [math.exp(-(i*i)/(2*sigma*sigma)) for i in range(-r, r+1)]
    s = sum(kernel)
    kernel = [k/s for k in kernel]

    tmp = [0.0] * (grid * grid)
    for y in range(grid):
        for x in range(grid):
            val = sum(kernel[ki] * data[y*grid + max(0,min(grid-1, x+ki-r))]
                      for ki in range(len(kernel)))
            tmp[y*grid+x] = val

    out = [0.0] * (grid * grid)
    for y in range(grid):
        for x in range(grid):
            val = sum(kernel[ki] * tmp[max(0,min(grid-1, y+ki-r))*grid+x]
                      for ki in range(len(kernel)))
            out[y*grid+x] = val
    return out


# --- Hauptprogramm ---

def main():
    if len(sys.argv) < 4:
        print("Verwendung: python3 generate_map.py <Name> <lat> <lon>")
        print("Beispiel:   python3 generate_map.py Dresden 51.05 13.74")
        sys.exit(1)

    name    = sys.argv[1]
    center_lat = float(sys.argv[2])
    center_lon = float(sys.argv[3])

    dlat = DEG_LAT
    dlon = deg_lon(center_lat)
    min_lat = center_lat - dlat
    max_lat = center_lat + dlat
    min_lon = center_lon - dlon
    max_lon = center_lon + dlon

    print(f"\n=== Karte generieren: {name} ===")
    print(f"    Bereich: {min_lat:.4f}–{max_lat:.4f}N, {min_lon:.4f}–{max_lon:.4f}E")
    print(f"    Raster:  {GRID}×{GRID} Felder (~{AREA_KM*2/GRID*1000:.0f}m pro Feld)\n")

    # 1. SRTM
    print("[1/3] SRTM-Höhendaten...")
    tile = srtm_tile_name(center_lat, center_lon)
    tif  = download_srtm(tile)
    elev_raw = read_srtm_tif(tif, min_lat, max_lat, min_lon, max_lon, GRID)
    elev = gauss_smooth(elev_raw, GRID, sigma=1.5)
    min_e = min(elev); max_e = max(elev)
    print(f"    Höhe: {min_e:.0f}m – {max_e:.0f}m")

    # 2. OSM
    print("\n[2/3] OSM-Daten (Wasser + Wald)...")
    osm_elements = fetch_osm(min_lat, max_lat, min_lon, max_lon)
    water, forest = rasterize_osm(osm_elements, min_lat, max_lat, min_lon, max_lon, GRID)
    print(f"    {sum(water)} Wasser-Felder, {sum(forest)} Wald-Felder von {GRID*GRID} gesamt")

    # 3. Höhen normalisieren (Perzentil → 0.0–1.0)
    print("\n[3/3] Normalisiere und speichere...")
    sorted_elev = sorted(elev)
    n = len(sorted_elev)
    def percentile_rank(val):
        lo, hi = 0, n - 1
        while lo < hi:
            mid = (lo + hi) // 2
            if sorted_elev[mid] < val: lo = mid + 1
            else: hi = mid
        return lo / (n - 1)

    elev_norm = [round(percentile_rank(e), 4) for e in elev]

    # Wasser-flags: OSM ist Quelle der Wahrheit
    water_out = list(water)

    # Wald-flags: nur wo OSM-Wald UND nicht zu tief
    forest_out = []
    for i in range(GRID * GRID):
        forest_out.append(1 if (forest[i] and elev_norm[i] > 0.1) else 0)

    # 4. Speichern
    os.makedirs(MAPS_DIR, exist_ok=True)
    out_path = os.path.join(MAPS_DIR, f"{name.lower()}.json")
    result = {
        'name':     name,
        'center':   {'lat': center_lat, 'lon': center_lon},
        'bounds':   {'minLat': min_lat, 'maxLat': max_lat, 'minLon': min_lon, 'maxLon': max_lon},
        'grid':     GRID,
        'areakm':   AREA_KM * 2,
        'elevation': elev_norm,   # 0.0–1.0, normalisiert per Perzentil
        'water':    water_out,    # 0/1 flags
        'forest':   forest_out,   # 0/1 flags
        'meta': {
            'elev_min': round(min_e, 1),
            'elev_max': round(max_e, 1),
            'sources':  ['SRTM (NASA, Public Domain)', 'OpenStreetMap contributors (ODbL)'],
        }
    }
    with open(out_path, 'w') as f:
        json.dump(result, f, separators=(',', ':'))

    print(f"\nFertig: {out_path} ({os.path.getsize(out_path)//1024} KB)")

if __name__ == '__main__':
    main()
