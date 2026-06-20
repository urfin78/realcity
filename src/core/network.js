// Straßennetz-Analyse via BFS

const GAME_GRID = 64;

function idx(gx, gy) { return gy * GAME_GRID + gx; }

// Gibt ein Set aller Zell-Indizes zurück die über Straßen erreichbar sind.
// Startpunkt: alle Straßenzellen (zusammenhängende Komponenten werden zusammengeführt).
export function connectedRoadSet(cells) {
  const roads = new Set();
  for (let i = 0; i < GAME_GRID * GAME_GRID; i++) {
    if (cells[i]?.type === 'road') roads.add(i);
  }
  return roads;
}

// Prüft ob eine Zelle (gx, gy) eine Straße als direkten Nachbarn hat (4er-Nachbarschaft).
export function hasRoadNeighbor(cells, gx, gy) {
  for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    const nx = gx+dx, ny = gy+dy;
    if (nx < 0 || nx >= GAME_GRID || ny < 0 || ny >= GAME_GRID) continue;
    if (cells[idx(nx, ny)]?.type === 'road') return true;
  }
  return false;
}

// Prüft ob eine Zone-Zelle über eine Straße mit dem Hauptnetzwerk verbunden ist.
// "Verbunden" = Straße in direkter Nachbarschaft UND diese Straße ist Teil
// des größten zusammenhängenden Straßennetzes.
export function isConnected(cells, gx, gy) {
  // Baue die größte zusammenhängende Straßenkomponente per BFS
  const roads = [];
  for (let i = 0; i < GAME_GRID * GAME_GRID; i++) {
    if (cells[i]?.type === 'road') roads.push(i);
  }
  if (roads.length === 0) return false;

  // BFS über alle Straßen — finde alle Komponenten
  const visited = new Set();
  let largest = new Set();

  for (const start of roads) {
    if (visited.has(start)) continue;
    const component = new Set();
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift();
      if (component.has(cur)) continue;
      component.add(cur);
      visited.add(cur);
      const cx = cur % GAME_GRID, cy = Math.floor(cur / GAME_GRID);
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = cx+dx, ny = cy+dy;
        if (nx < 0 || nx >= GAME_GRID || ny < 0 || ny >= GAME_GRID) continue;
        const ni = idx(nx, ny);
        if (cells[ni]?.type === 'road' && !component.has(ni)) queue.push(ni);
      }
    }
    if (component.size > largest.size) largest = component;
  }

  // Prüfe ob ein Nachbar von (gx,gy) im größten Netz liegt
  for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    const nx = gx+dx, ny = gy+dy;
    if (nx < 0 || nx >= GAME_GRID || ny < 0 || ny >= GAME_GRID) continue;
    if (largest.has(idx(nx, ny))) return true;
  }
  return false;
}

// Gibt true zurück wenn in Radius r um (gx,gy) mindestens eine Zelle
// mit dem gesuchten Zonentyp existiert.
export function hasZoneInRadius(cells, gx, gy, zoneType, r) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > r) continue; // Manhattan-Distanz
      const nx = gx+dx, ny = gy+dy;
      if (nx < 0 || nx >= GAME_GRID || ny < 0 || ny >= GAME_GRID) continue;
      const c = cells[idx(nx, ny)];
      if (c?.type === 'zone' && c.zone === zoneType && c.level > 0) return true;
    }
  }
  return false;
}
