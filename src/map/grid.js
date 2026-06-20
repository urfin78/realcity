// Spielraster als Geo-referenziertes Overlay über der OSM-Karte
// Jedes Feld hat eine feste Größe in Metern, unabhängig vom Zoom

const FIELD_SIZE_M = 500; // Meter pro Spielfeld

// Meter → Grad-Näherung (bei mittleren Breiten)
const M_PER_DEG_LAT = 111320;
function mPerDegLon(lat) { return 111320 * Math.cos(lat * Math.PI / 180); }

export class GameGrid {
  /**
   * @param {number} centerLat
   * @param {number} centerLon
   * @param {number} cols  Anzahl Spalten
   * @param {number} rows  Anzahl Zeilen
   */
  constructor(centerLat, centerLon, cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.cells = Array.from({ length: rows }, () => Array(cols).fill(null));

    // Geo-Ausdehnung des Rasters
    const fieldLat = FIELD_SIZE_M / M_PER_DEG_LAT;
    const fieldLon = FIELD_SIZE_M / mPerDegLon(centerLat);
    this.fieldLat = fieldLat;
    this.fieldLon = fieldLon;
    this.originLat = centerLat + (rows / 2) * fieldLat; // Nord-West-Ecke
    this.originLon = centerLon - (cols / 2) * fieldLon;
  }

  // Geo-Koordinate → Raster-Zelle
  geoToCell(lat, lon) {
    const col = Math.floor((lon - this.originLon) / this.fieldLon);
    const row = Math.floor((this.originLat - lat) / this.fieldLat);
    return { col, row };
  }

  // Raster-Zelle → Canvas-Koordinaten
  cellToCanvas(col, row, camera, canvasW, canvasH) {
    const lat = this.originLat - row * this.fieldLat;
    const lon = this.originLon + col * this.fieldLon;
    return latLonToCanvas(lat, lon, camera, canvasW, canvasH);
  }

  getCell(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return null;
    return this.cells[row][col];
  }

  setCell(col, row, value) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    this.cells[row][col] = value;
  }

  render(ctx, camera, canvasW, canvasH) {
    const { cols, rows } = this;

    // Feldgröße in Pixeln bei aktuellem Zoom
    const topLeft     = latLonToCanvas(this.originLat, this.originLon, camera, canvasW, canvasH);
    const bottomRight = latLonToCanvas(
      this.originLat - rows * this.fieldLat,
      this.originLon + cols * this.fieldLon,
      camera, canvasW, canvasH
    );

    const totalW = bottomRight.px - topLeft.px;
    const totalH = bottomRight.py - topLeft.py;
    const cellW  = totalW / cols;
    const cellH  = totalH / rows;

    // Nur zeichnen wenn Felder sichtbar groß genug sind
    if (cellW < 5) return;

    ctx.save();
    ctx.globalAlpha = 0.35;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const px = topLeft.px + col * cellW;
        const py = topLeft.py + row * cellH;
        const cell = this.cells[row][col];

        if (cell) {
          ctx.fillStyle = cell.color ?? 'rgba(255,255,255,0.2)';
          ctx.fillRect(px, py, cellW, cellH);
        }

        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, cellW, cellH);
      }
    }

    ctx.restore();
  }

  // Canvas-Klick → Raster-Zelle
  canvasToCell(mouseX, mouseY, camera, canvasW, canvasH) {
    const topLeft = latLonToCanvas(this.originLat, this.originLon, camera, canvasW, canvasH);
    const bottomRight = latLonToCanvas(
      this.originLat - this.rows * this.fieldLat,
      this.originLon + this.cols * this.fieldLon,
      camera, canvasW, canvasH
    );
    const totalW = bottomRight.px - topLeft.px;
    const totalH = bottomRight.py - topLeft.py;
    const col = Math.floor((mouseX - topLeft.px) / (totalW / this.cols));
    const row = Math.floor((mouseY - topLeft.py) / (totalH / this.rows));
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return null;
    return { col, row };
  }
}

// Hilfsfunktion: Geo-Koordinate → Canvas-Pixel (Mercator)
export function latLonToCanvas(lat, lon, camera, canvasW, canvasH) {
  const { lat: cLat, lon: cLon, zoom } = camera;
  const z = Math.min(18, Math.max(1, Math.round(zoom + 10)));
  const tileZoom = zoom * Math.pow(2, z - 10);
  const scaledTile = 256 * tileZoom;
  const n = Math.pow(2, z);

  function toTileX(lo) { return (lo + 180) / 360 * n; }
  function toTileY(la) {
    const r = la * Math.PI / 180;
    return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n;
  }

  const centerTX = toTileX(cLon);
  const centerTY = toTileY(cLat);
  const px = (toTileX(lon) - centerTX) * scaledTile + canvasW / 2;
  const py = (toTileY(lat) - centerTY) * scaledTile + canvasH / 2;
  return { px, py };
}
