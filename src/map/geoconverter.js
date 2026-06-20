export const TILE_SIZE = 4; // Pixel pro Tile (bei zoom=1.5 → 6px/Tile sichtbar)

/**
 * Konvertiert einen Bereich von Geo-Koordinaten in ein Spielraster.
 * @param {number} minLat
 * @param {number} maxLat
 * @param {number} minLon
 * @param {number} maxLon
 * @param {number} targetWidth  Gewünschte Rasterbreite in Tiles
 * @param {number} targetHeight Gewünschte Rasterhöhe in Tiles
 */
export function createConverter(minLat, maxLat, minLon, maxLon, targetWidth, targetHeight) {
  const latRange = maxLat - minLat;
  const lonRange = maxLon - minLon;

  return {
    width: targetWidth,
    height: targetHeight,

    geoToTile(lat, lon) {
      const x = Math.floor(((lon - minLon) / lonRange) * targetWidth);
      const y = Math.floor(((maxLat - lat) / latRange) * targetHeight); // Y invertiert
      return { x: Math.max(0, Math.min(targetWidth - 1, x)),
               y: Math.max(0, Math.min(targetHeight - 1, y)) };
    },

    // Gibt alle Tiles zurück, die ein Polygon (Array von {lat,lon}) abdeckt
    polygonToTiles(coords) {
      if (!coords || coords.length < 2) return [];
      const tiles = new Set();

      // Bounding-Box des Polygons rastern
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      const projected = coords.map(({ lat, lon }) => {
        const t = this.geoToTile(lat, lon);
        minX = Math.min(minX, t.x); maxX = Math.max(maxX, t.x);
        minY = Math.min(minY, t.y); maxY = Math.max(maxY, t.y);
        return t;
      });

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (pointInPolygon(x + 0.5, y + 0.5, projected)) {
            tiles.add(`${x},${y}`);
          }
        }
      }

      // Fallback: mindestens die Linie selbst
      if (tiles.size === 0) {
        projected.forEach(t => tiles.add(`${t.x},${t.y}`));
      }

      return [...tiles].map(key => {
        const [x, y] = key.split(',').map(Number);
        return { x, y };
      });
    },

    // Gibt alle Tiles entlang einer Linie zurück (Bresenham)
    lineToTiles(coords) {
      const tiles = new Set();
      for (let i = 0; i < coords.length - 1; i++) {
        const a = this.geoToTile(coords[i].lat, coords[i].lon);
        const b = this.geoToTile(coords[i + 1].lat, coords[i + 1].lon);
        bresenham(a.x, a.y, b.x, b.y).forEach(t => tiles.add(`${t.x},${t.y}`));
      }
      return [...tiles].map(key => {
        const [x, y] = key.split(',').map(Number);
        return { x, y };
      });
    },
  };
}

function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function bresenham(x0, y0, x1, y1) {
  const tiles = [];
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    tiles.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx)  { err += dx; y0 += sy; }
  }
  return tiles;
}
