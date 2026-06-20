# Feature: Versorgung & Bedarf (`feat/utilities-demand`)

Siehe [ROADMAP](../ROADMAP.md) §3. Größtes Feature — klassische SimCity-Tiefe.

## Umfang

### 1. Versorgungsnetz (`src/core/utilities.js`, neu)
- Neuer Zell-/Gebäudetyp **Kraftwerk** (Tool `power`), erzeugt Versorgungs-
  kapazität.
- Strom breitet sich entlang von Zonen+Straßen aus (BFS, analog `network.js`).
  Wiederverwendbares BFS aus `network.js` extrahieren statt duplizieren.
- Jede Zone hat Strombedarf (skaliert mit Level). Summe ≤ Kapazität → versorgt.
- Unversorgte Zonen wachsen nicht und verfallen über Ticks.
- (Optional als zweiter Schritt: Wasser analog.)

### 2. RCI-Nachfrage
- Globaler Bedarf `demand = { residential, commercial, industrial }` in `[-1, 1]`.
- Ableitung aus Zonenverhältnis: viel Wohnen ohne Arbeit → C/I-Bedarf steigt; usw.
- Bedarf moduliert die Wachstums-Wahrscheinlichkeit in `simulation.js`.
- Speist die RCI-Balken im HUD (Platzhalter aus `feat/save-and-ux` füllen).

## Betroffene Dateien
- neu: `src/core/utilities.js`, `tests/utilities.test.mjs`
- `src/core/network.js` (BFS-Kern extrahieren, wiederverwendbar machen)
- `src/core/simulation.js` (Versorgung + RCI als Wachstumsfaktoren)
- `index.html` (Kraftwerk-Tool, RCI-Balken)
- `src/core/game.js` (Kraftwerk-Rendering, RCI-Anzeige, Versorgungs-Overlay)

## Tests (node:test)
- Kraftwerk versorgt verbundene Zonen bis zur Kapazitätsgrenze.
- Zone außerhalb der Kapazität bleibt unversorgt → wächst nicht.
- RCI-Bedarf reagiert plausibel auf Zonen-Ungleichgewicht.

## Abhängigkeiten
- RCI-Balken nutzen das HUD aus `feat/save-and-ux` (lose; funktioniert auch ohne,
  dann ohne Balken-Visualisierung).

## Akzeptanzkriterien
- Zonen ohne Kraftwerk wachsen nicht; nach Kraftwerksbau wachsen sie.
- RCI-Anzeige verändert sich mit dem Zonen-Mix.
- CI grün, Conventional-Commit-Titel.
