# Feature: Speichern & UX (`feat/save-and-ux`)

Siehe [ROADMAP](../ROADMAP.md) §1. Fundament-Feature: macht das Spiel benutzbar.

## Umfang

### 1. Persistenz (`src/core/persistence.js`, neu)
- `serialize(cells, state) → JSON-String` — Zellen kompakt (nur belegte Zellen
  als `[index, type, zone, level]`) plus `state`-Felder.
- `deserialize(json) → { cells, state }` mit Validierung (Grid-Größe, Felder).
- `save(city)` schreibt nach `localStorage['realcity:<city>']`; `load(city)` liest.
- Auto-Save: im Tick-Handler von `game.js` aufrufen (debounced, z.B. jeder Tick).
- Beim Laden einer Karte: vorhandenen Spielstand anbieten/auto-laden.

### 2. Abriss-Werkzeug
- Neues Toolbar-Tool `bulldoze`.
- Entfernt Zelle, erstattet einen Teil der Baukosten (z.B. 50 %).
- Bereits vorhandenes „Doppelklick entfernt eigenes Objekt" durch klares Tool
  ersetzen.

### 3. Bau-Vorschau (Hover)
- `mousemove` auf dem Canvas → aktuelle Zielzelle bestimmen.
- Overlay rendern: Umriss in Grün (baubar) / Rot (blockiert: Wasser, kein
  Straßennachbar, kein Geld) + Kostenlabel am Cursor.

### 4. HUD-Erweiterung
- Zonen-Zähler (R/C/I/Verwaltung) und Einnahmen/Tick.
- Platzhalter-RCI-Balken (wird in `feat/utilities-demand` mit Daten gefüllt).

## Betroffene Dateien
- neu: `src/core/persistence.js`, `tests/persistence.test.mjs`
- `src/core/game.js` (Hover-Overlay, Abriss, Auto-Save-Hook, HUD)
- `src/core/state.js` (Serialisierungs-Helfer)
- `index.html` (Toolbar-Button Abriss, HUD-Elemente)

## Tests (node:test)
- `serialize`→`deserialize` ist verlustfrei (Round-Trip).
- Abriss erstattet korrekten Betrag und leert die Zelle.
- `deserialize` weist fehlerhaftes JSON / falsche Grid-Größe ab.

## Akzeptanzkriterien
- Reload der Seite stellt die Stadt wieder her.
- Hover zeigt Kosten und Baubarkeit vor dem Klick.
- CI grün, Conventional-Commit-Titel.
