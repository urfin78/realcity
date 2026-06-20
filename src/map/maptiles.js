// OSM Slippy Map Tile-System
// Tile-URLs: https://tile.openstreetmap.org/{z}/{x}/{y}.png
// Nutzungsbedingungen: https://operations.osmfoundation.org/policies/tiles/

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_PX  = 256; // OSM-Tiles sind immer 256×256px

export class MapTiles {
  constructor(canvas) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.cache   = new Map(); // "z/x/y" → HTMLImageElement
    this.pending = new Set(); // aktuell ladende Tiles
  }

  // Geo-Koordinaten → OSM-Tile-Koordinaten bei Zoom z
  static geoToTile(lat, lon, z) {
    const n = Math.pow(2, z);
    const x = Math.floor((lon + 180) / 360 * n);
    const latRad = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x, y };
  }

  // OSM-Tile-Koordinaten + Subpixel → Canvas-Pixel
  static tileToCanvas(tx, ty, z, centerLat, centerLon, canvasW, canvasH, zoom) {
    const n = Math.pow(2, z);
    const centerTileX = (centerLon + 180) / 360 * n;
    const centerLatRad = centerLat * Math.PI / 180;
    const centerTileY = (1 - Math.log(Math.tan(centerLatRad) + 1 / Math.cos(centerLatRad)) / Math.PI) / 2 * n;

    const px = (tx - centerTileX) * TILE_PX * zoom + canvasW / 2;
    const py = (ty - centerTileY) * TILE_PX * zoom + canvasH / 2;
    return { px, py };
  }

  getTile(z, x, y) {
    const key = `${z}/${x}/${y}`;
    if (this.cache.has(key)) return this.cache.get(key);
    if (this.pending.has(key)) return null;

    this.pending.add(key);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.cache.set(key, img);
      this.pending.delete(key);
      this._dirty = true;
    };
    img.onerror = () => {
      this.pending.delete(key);
    };
    img.src = TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);
    return null;
  }

  render(camera) {
    const { ctx, canvas } = this;
    const { width, height } = canvas;
    const { lat, lon, zoom } = camera;

    // OSM-Zoom-Level: bei hohem game-zoom höhere Tile-Auflösung
    const z = Math.min(18, Math.max(1, Math.round(zoom + 10)));
    const tileZoom = zoom * Math.pow(2, z - 10); // Skalierung der 256px-Tiles auf Canvas

    const n = Math.pow(2, z);
    const centerLatRad = lat * Math.PI / 180;
    const centerTileX = (lon + 180) / 360 * n;
    const centerTileY = (1 - Math.log(Math.tan(centerLatRad) + 1 / Math.cos(centerLatRad)) / Math.PI) / 2 * n;

    const scaledTile = TILE_PX * tileZoom;

    // Sichtbare Tile-Range
    const tilesX = Math.ceil(width  / scaledTile) + 2;
    const tilesY = Math.ceil(height / scaledTile) + 2;
    const startTX = Math.floor(centerTileX - tilesX / 2);
    const startTY = Math.floor(centerTileY - tilesY / 2);

    ctx.fillStyle = '#aac8f0';
    ctx.fillRect(0, 0, width, height);

    for (let dy = 0; dy <= tilesY; dy++) {
      for (let dx = 0; dx <= tilesX; dx++) {
        const tx = startTX + dx;
        const ty = startTY + dy;
        if (tx < 0 || ty < 0 || tx >= n || ty >= n) continue;

        const px = Math.floor((tx - centerTileX) * scaledTile + width  / 2);
        const py = Math.floor((ty - centerTileY) * scaledTile + height / 2);
        const sz = Math.ceil(scaledTile) + 1; // +1 verhindert Lücken durch Rundung

        const img = this.getTile(z, tx, ty);
        if (img) {
          ctx.drawImage(img, px, py, sz, sz);
        } else {
          // Platzhalter während Tile lädt
          ctx.fillStyle = '#d8e8c8';
          ctx.fillRect(px, py, sz, sz);
        }
      }
    }

    this._dirty = false;
  }

  get dirty() { return this._dirty; }
}
