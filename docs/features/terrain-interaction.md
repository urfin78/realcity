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

## Betroffene Dateien
- neu (optional): `src/core/terrain.js` — Hilfsfunktionen Gradient/Nähe.
- `src/core/game.js` (Baukosten aus Terrain ableiten, Wald-Rodung)
- `src/core/simulation.js` (Wasserlage-/Wald-Boni ins Wachstum)
- `tests/terrain.test.mjs`

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
