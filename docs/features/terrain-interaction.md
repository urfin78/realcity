# Feature: Terrain-Interaktion (`feat/terrain-interaction`)

Siehe [ROADMAP](../ROADMAP.md) §4. Macht die echten Geodaten spielrelevant.

## Umfang

### 1. Hang-Aufschlag
- Beim Bau Höhenunterschied zur Nachbarschaft auswerten
  (`game.js` sampelt Terrain bereits an der Zellmitte).
- Großer Gradient → Kostenfaktor (z.B. bis ×3). Sehr steile Hänge optional sperren.

### 2. Wasserlage-Bonus
- Wohnzonen mit Wasser in kleinem Radius → höheres Wachstum / mehr Einnahmen.
- Faktor in `simulation.js` einrechnen.

### 3. Wald
- **Rodbar:** Wald-Tile per Abriss/Werkzeug entfernen → einmalig Geld, danach
  bebaubar.
- **Naherholung:** ungerodeter Wald in Wohnnähe → Wachstums-/Zufriedenheitsbonus.

### 4. Bau-Verbote
- Wasser unbebaubar (bereits umgesetzt).
- Optional: Hänge über Schwellgradient gesperrt.

## Umsetzung (Architektur)
- `terrain.js` bündelt die reine Logik (Hang-Faktor, Steil-Sperre, Lage-Bonus)
  — DOM-frei, daher per `node:test` prüfbar.
- `game.js` sampelt beim Bau Höhe/Wasser/Wald (hat als einziges Zugriff auf die
  Karte) und **schreibt den Lage-Bonus als `cell.terrainBonus` auf die Zelle**.
  Die Simulation liest nur `cell.terrainBonus` und braucht keine Kartendaten.
- Sehr steile Hänge (Gradient ≥ `SLOPE_BLOCK`) sind gesperrt (wie Wasser);
  darunter skaliert der Aufschlag bis `SLOPE_MAX_FACTOR`.
- Wald-Rodung beim Bau gibt einmalig `FOREST_CLEAR_REWARD`; gerodete Tiles
  stehen in `clearedForest` und verlieren ihren Naherholungs-Bonus.
- Persistenz: `clearedForest` wird mitgespeichert (Schema 3). Der Lage-Bonus
  wird beim Laden aus der Karte neu berechnet (nicht serialisiert).

## Betroffene Dateien
- neu: `src/core/terrain.js` — Hilfsfunktionen Gradient/Nähe/Bonus.
- `src/core/game.js` (Baukosten + Steil-Sperre, Wald-Rodung, Bonus berechnen)
- `src/core/simulation.js` (`cell.terrainBonus` verstärkt die Einnahmen)
- `src/core/persistence.js` (clearedForest, Schema 3)
- `tests/terrain.test.mjs`, `tests/persistence.test.mjs`

## Tests (node:test)
- Gradient-Funktion liefert für flaches vs. steiles Gelände korrekte Faktoren.
- Wohnzone an Wasser erhält Wachstumsbonus gegenüber Zone im Landesinneren.
- Wald-Nähe-Bonus greift nur bei ungerodetem Wald.

## Hinweis
Reine Logik-Funktionen (Gradient, Nähe) testbar machen — sie dürfen nicht von
`document`/`window` abhängen, damit `node:test` sie importieren kann
(wie `network.js`/`simulation.js`).

## Akzeptanzkriterien
- Bau am Steilhang kostet sichtbar mehr als in der Ebene.
- Wasserlage-Wohnzonen wachsen erkennbar besser.
- CI grün, Conventional-Commit-Titel.
