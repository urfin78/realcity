export const TileType = {
  UNKNOWN:     'unknown',
  ROAD:        'road',
  BUILDING:    'building',
  RESIDENTIAL: 'residential',
  COMMERCIAL:  'commercial',
  INDUSTRIAL:  'industrial',
  PARK:        'park',
  WATER:       'water',
  FOREST:      'forest',
  RAIL:        'rail',
};

// Farben für Canvas-Rendering
export const TileColors = {
  [TileType.UNKNOWN]:     '#2a2a3a',
  [TileType.ROAD]:        '#555566',
  [TileType.BUILDING]:    '#8888aa',
  [TileType.RESIDENTIAL]: '#7799bb',
  [TileType.COMMERCIAL]:  '#bb9944',
  [TileType.INDUSTRIAL]:  '#aa6633',
  [TileType.PARK]:        '#338844',
  [TileType.WATER]:       '#2255aa',
  [TileType.FOREST]:      '#225533',
  [TileType.RAIL]:        '#444455',
};

export const TileLabels = {
  [TileType.UNKNOWN]:     'Unbekannt',
  [TileType.ROAD]:        'Straße',
  [TileType.BUILDING]:    'Gebäude',
  [TileType.RESIDENTIAL]: 'Wohngebiet',
  [TileType.COMMERCIAL]:  'Gewerbe',
  [TileType.INDUSTRIAL]:  'Industrie',
  [TileType.PARK]:        'Park',
  [TileType.WATER]:       'Wasser',
  [TileType.FOREST]:      'Wald',
  [TileType.RAIL]:        'Schiene',
};

// OSM-Tags → TileType Mapping
export function osmTagsToTileType(tags) {
  if (!tags) return TileType.UNKNOWN;

  if (tags.natural === 'water' || tags.waterway) return TileType.WATER;
  if (tags.natural === 'wood' || tags.landuse === 'forest') return TileType.FOREST;
  if (tags.leisure === 'park' || tags.landuse === 'grass' || tags.landuse === 'meadow') return TileType.PARK;
  if (tags.railway) return TileType.RAIL;
  if (tags.highway) return TileType.ROAD;
  if (tags.landuse === 'residential') return TileType.RESIDENTIAL;
  if (tags.landuse === 'commercial' || tags.shop) return TileType.COMMERCIAL;
  if (tags.landuse === 'industrial') return TileType.INDUSTRIAL;
  if (tags.building) {
    if (tags.building === 'residential' || tags.building === 'apartments') return TileType.RESIDENTIAL;
    if (tags.building === 'commercial' || tags.building === 'retail') return TileType.COMMERCIAL;
    if (tags.building === 'industrial') return TileType.INDUSTRIAL;
    return TileType.BUILDING;
  }

  return TileType.UNKNOWN;
}
