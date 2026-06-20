import { TileColors } from '../data/tiletypes.js';
import { TILE_SIZE } from './geoconverter.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.dirty  = true;
  }

  resize(width, height) {
    this.canvas.width  = width;
    this.canvas.height = height;
    this.dirty = true;
  }

  render(tilemap, camera) {
    if (!this.dirty && !camera.dirty) return;
    const { ctx } = this;
    const { width, height } = this.canvas;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    if (!tilemap || !tilemap.grid) return;

    const tileSize = TILE_SIZE * camera.zoom;

    // Sichtbarer Bereich (Tile-Koordinaten)
    const startX = Math.max(0, Math.floor(-camera.x / tileSize));
    const startY = Math.max(0, Math.floor(-camera.y / tileSize));
    const endX   = Math.min(tilemap.width,  Math.ceil((width  - camera.x) / tileSize));
    const endY   = Math.min(tilemap.height, Math.ceil((height - camera.y) / tileSize));

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const type  = tilemap.getTile(x, y);
        const color = TileColors[type] ?? TileColors['unknown'];

        const px = Math.floor(camera.x + x * tileSize);
        const py = Math.floor(camera.y + y * tileSize);
        const sz = Math.ceil(tileSize);

        ctx.fillStyle = color;
        ctx.fillRect(px, py, sz, sz);

        // Gitter nur bei ausreichendem Zoom
        if (camera.zoom >= 2) {
          ctx.strokeStyle = 'rgba(0,0,0,0.2)';
          ctx.strokeRect(px, py, sz, sz);
        }
      }
    }

    this.dirty  = false;
    camera.dirty = false;
  }

  markDirty() {
    this.dirty = true;
  }
}
