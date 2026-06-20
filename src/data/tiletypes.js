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
  WETLAND:     'wetland',
  FARMLAND:    'farmland',
  RAIL:        'rail',
};

export const TileColors = {
  [TileType.UNKNOWN]:     '#c8d8a0', // helles Grün als Grundfläche (wie Karte)
  [TileType.ROAD]:        '#ffffff',
  [TileType.BUILDING]:    '#d4b483',
  [TileType.RESIDENTIAL]: '#e8dcc8',
  [TileType.COMMERCIAL]:  '#f0c88a',
  [TileType.INDUSTRIAL]:  '#c8aaaa',
  [TileType.PARK]:        '#a8d878',
  [TileType.WATER]:       '#aac8f0',
  [TileType.FOREST]:      '#6aaa60',
  [TileType.WETLAND]:     '#88b898',
  [TileType.FARMLAND]:    '#dce8b0',
  [TileType.RAIL]:        '#888899',
};

export const TileLabels = {
  [TileType.UNKNOWN]:     'Freifläche',
  [TileType.ROAD]:        'Straße',
  [TileType.BUILDING]:    'Gebäude',
  [TileType.RESIDENTIAL]: 'Wohngebiet',
  [TileType.COMMERCIAL]:  'Gewerbe',
  [TileType.INDUSTRIAL]:  'Industrie',
  [TileType.PARK]:        'Park',
  [TileType.WATER]:       'Wasser',
  [TileType.FOREST]:      'Wald',
  [TileType.WETLAND]:     'Feuchtgebiet',
  [TileType.FARMLAND]:    'Landwirtschaft',
  [TileType.RAIL]:        'Schiene',
};

// OSM-Tags → TileType Mapping (Reihenfolge = Priorität)
export function osmTagsToTileType(tags) {
  if (!tags) return TileType.UNKNOWN;

  // Wasser
  if (tags.natural === 'water' || tags.natural === 'bay' || tags.natural === 'coastline') return TileType.WATER;
  if (tags.waterway === 'river' || tags.waterway === 'stream' || tags.waterway === 'canal') return TileType.WATER;
  if (tags.landuse === 'reservoir' || tags.landuse === 'basin') return TileType.WATER;

  // Wald
  if (tags.natural === 'wood' || tags.landuse === 'forest') return TileType.FOREST;

  // Feuchtgebiet
  if (tags.natural === 'wetland' || tags.natural === 'marsh') return TileType.WETLAND;

  // Park / Grünfläche
  if (tags.leisure === 'park' || tags.leisure === 'nature_reserve' || tags.leisure === 'golf_course') return TileType.PARK;
  if (tags.landuse === 'grass' || tags.landuse === 'meadow' || tags.landuse === 'village_green') return TileType.PARK;
  if (tags.natural === 'grassland' || tags.natural === 'scrub' || tags.natural === 'heath') return TileType.PARK;

  // Landwirtschaft
  if (tags.landuse === 'farmland' || tags.landuse === 'farmyard' || tags.landuse === 'orchard' || tags.landuse === 'vineyard') return TileType.FARMLAND;

  // Verkehr
  if (tags.railway === 'rail' || tags.railway === 'subway' || tags.railway === 'tram') return TileType.RAIL;
  if (tags.highway) return TileType.ROAD;

  // Bebauung
  if (tags.landuse === 'residential') return TileType.RESIDENTIAL;
  if (tags.landuse === 'commercial' || tags.landuse === 'retail') return TileType.COMMERCIAL;
  if (tags.landuse === 'industrial') return TileType.INDUSTRIAL;
  if (tags.building) return TileType.BUILDING;

  return TileType.UNKNOWN;
}
