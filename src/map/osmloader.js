import { osmTagsToTileType } from '../data/tiletypes.js';
import { createConverter } from './geoconverter.js';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Raster-Größe: ~300x200 Tiles → ~65m pro Tile bei 20km Ausschnitt
const GRID_WIDTH  = 300;
const GRID_HEIGHT = 200;

/**
 * Lädt OSM-Daten für eine Stadt und gibt ein TileGrid zurück.
 * @param {string} cityName
 * @param {(msg: string) => void} onStatus
 * @returns {{ grid: string[][], width: number, height: number }}
 */
export async function loadCity(cityName, onStatus = () => {}) {
  onStatus(`Suche "${cityName}"...`);

  // Schritt 1: Bounding Box der Stadt ermitteln (Nominatim)
  const bbox = await fetchBBox(cityName);
  if (!bbox) throw new Error(`Stadt "${cityName}" nicht gefunden`);

  onStatus(`Lade Kartendaten (${cityName})...`);

  // Schritt 2: OSM-Features laden
  const elements = await fetchOSMElements(bbox);

  onStatus('Konvertiere in Spielraster...');

  // Schritt 3: In Spielraster umwandeln
  const grid = buildGrid(elements, bbox);

  onStatus('');
  return grid;
}

async function fetchBBox(cityName) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'de' } });
  const data = await res.json();
  if (!data.length) return null;

  const { boundingbox } = data[0];
  // boundingbox: [minLat, maxLat, minLon, maxLon]
  const minLat = parseFloat(boundingbox[0]);
  const maxLat = parseFloat(boundingbox[1]);
  const minLon = parseFloat(boundingbox[2]);
  const maxLon = parseFloat(boundingbox[3]);

  // Stadtregion: ~20km × 14km Ausschnitt
  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;
  const deltaLat = 0.09; // ~10km N/S
  const deltaLon = 0.13; // ~10km O/W (Lon-Grad schmaler bei mittleren Breiten)

  return {
    minLat: centerLat - deltaLat,
    maxLat: centerLat + deltaLat,
    minLon: centerLon - deltaLon,
    maxLon: centerLon + deltaLon,
  };
}

async function fetchOSMElements(bbox) {
  const { minLat, maxLat, minLon, maxLon } = bbox;
  const b = `${minLat},${minLon},${maxLat},${maxLon}`;

  const query = `
    [out:json][timeout:40];
    (
      way["landuse"](${b});
      way["natural"](${b});
      way["waterway"]["waterway"!="drain"]["waterway"!="ditch"](${b});
      way["leisure"~"park|nature_reserve|golf_course"](${b});
      way["highway"~"motorway|trunk|primary|secondary"](${b});
      way["railway"~"rail|subway"](${b});
      relation["natural"](${b});
      relation["landuse"](${b});
      relation["leisure"~"park|nature_reserve"](${b});
    );
    out geom;
  `;

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  if (!res.ok) throw new Error(`Overpass API Fehler: ${res.status}`);
  const data = await res.json();
  return data.elements || [];
}

function buildGrid(elements, bbox) {
  const { minLat, maxLat, minLon, maxLon } = bbox;
  const converter = createConverter(minLat, maxLat, minLon, maxLon, GRID_WIDTH, GRID_HEIGHT);

  // Grid mit UNKNOWN initialisieren
  const grid = Array.from({ length: GRID_HEIGHT }, () =>
    Array(GRID_WIDTH).fill('unknown')
  );

  // Priorität: höherer Index = höhere Priorität beim Überschreiben
  const priority = {
    unknown: 0, road: 1, rail: 2, forest: 3, park: 3,
    water: 4, building: 5, residential: 6, commercial: 6, industrial: 6,
  };

  function setTile(x, y, type) {
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return;
    if ((priority[type] ?? 0) >= (priority[grid[y][x]] ?? 0)) {
      grid[y][x] = type;
    }
  }

  for (const el of elements) {
    const type = osmTagsToTileType(el.tags);

    if (el.type === 'way' && el.geometry) {
      const coords = el.geometry.map(g => ({ lat: g.lat, lon: g.lon }));
      const isArea = !!(el.tags.landuse || el.tags.leisure ||
                        el.tags.natural === 'water' || el.tags.natural === 'wood' ||
                        el.tags.natural === 'wetland' || el.tags.natural === 'grassland' ||
                        el.tags.natural === 'scrub' || el.tags.natural === 'heath');
      const tiles = isArea ? converter.polygonToTiles(coords) : converter.lineToTiles(coords);
      tiles.forEach(({ x, y }) => setTile(x, y, type));
    }

    // Relations: äußeren Ring (outer members) als Fläche rastern
    if (el.type === 'relation' && el.members) {
      for (const member of el.members) {
        if (member.type === 'way' && member.role === 'outer' && member.geometry) {
          const coords = member.geometry.map(g => ({ lat: g.lat, lon: g.lon }));
          converter.polygonToTiles(coords).forEach(({ x, y }) => setTile(x, y, type));
        }
      }
    }
  }

  return { grid, width: GRID_WIDTH, height: GRID_HEIGHT };
}
