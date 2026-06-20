import { TileType } from '../data/tiletypes.js';
import { EventBus } from './eventbus.js';

export class TileMap {
  constructor(width, height) {
    this.width  = width;
    this.height = height;
    this.grid   = Array.from({ length: height }, () => Array(width).fill(TileType.UNKNOWN));
  }

  loadGrid(grid) {
    this.width  = grid[0].length;
    this.height = grid.length;
    this.grid   = grid;
    EventBus.emit('tilemap:loaded', { width: this.width, height: this.height });
  }

  getTile(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.grid[y][x];
  }

  setTile(x, y, type) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.grid[y][x] = type;
    EventBus.emit('tile:changed', { x, y, type });
  }
}
