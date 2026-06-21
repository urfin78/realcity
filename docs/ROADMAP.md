# RealCity — Roadmap & Feature-Planung

Stand der Mechanik (Basis auf `main`): Budget, Straßennetz (BFS-Zusammenhang),
4 Zonentypen mit Level-Wachstum, Tick-basierte Einnahmen. Diese Roadmap baut
darauf die nächste Tiefe auf. Jedes Feature wird auf einem eigenen
`feat/...`-Branch entwickelt und per Pull Request (CI-geprüft) nach `main`
gemergt.

Reines Vanilla JS, kein Build — diese Bedingung gilt für jedes Feature.

## Status-Überblick

Deployt: **v0.5.0** (`gh-pages`).

| # | Feature | Status |
|---|---------|--------|
| 1 | save-and-ux | ✅ Fertig (PR #2, v0.3.0) |
| 2 | economy-balance | ✅ Fertig (PR #6, v0.5.0) |
| 3 | utilities-demand | ⚪ Offen (nur Plan) |
| 4 | terrain-interaction | 🟡 In Arbeit (Branch `feat/terrain-interaction`) |
| 5 | version-display | ✅ Fertig (PR #1, v0.2.0) |
| 6 | map-pipeline | ✅ Fertig (PR #3, v0.4.0); Karte Berlin (PR #4) |

---

## 1. `feat/save-and-ux` — Speichern & UX

**Status:** ✅ Fertig — gemergt (PR #2), deployt mit v0.3.0.

**Ziel:** Das Spiel von einer Tech-Demo zu etwas Benutzbarem machen.

- **Spielstand speichern/laden** über `localStorage` (Zellen + `state` als JSON).
  Auto-Save pro Tick, manuelles „Neu starten".
- **Abriss-Werkzeug** — Zellen entfernen (teilweise Rückerstattung).
- **Bau-Vorschau** — beim Überfahren Cursor-Highlight + Kosten/Validität anzeigen
  (grün = baubar, rot = blockiert).
- **HUD-Erweiterung** — RCI-Bedarfsbalken (Vorbereitung für Feature 3),
  kompakte Statistik (Zonen-Zähler, Einnahmen/Tick).

**Berührt:** `game.js` (Eingabe, Render-Overlay), `state.js` (Serialisierung),
neues `src/core/persistence.js`. **Abhängigkeiten:** keine.

---

## 2. `feat/economy-balance` — Wirtschaft & Balance

**Status:** ✅ Fertig — gemergt (PR #6), deployt mit v0.5.0.

**Ziel:** Das Budget zur echten Herausforderung machen (aktuell nur Wachstum).

- **Laufender Unterhalt** — Straßen und Zonen kosten pro Tick (skaliert mit Level).
- **Steuersatz-Regler** pro Zonentyp (0–20 %); höher = mehr Einnahmen, aber
  bremst Wachstum.
- **Kredit** — einmalige Geldspritze gegen Zins/Tilgung pro Tick.
- **Bankrott** — Budget < Schwelle über mehrere Ticks → Game-Over-Zustand.

**Berührt:** `state.js` (Unterhalt, Steuer, Kredit), `simulation.js`
(Steuer beeinflusst Wachstum/Einnahmen), `index.html` (Regler), `game.js` (HUD).
**Abhängigkeiten:** keine; harmoniert mit Feature 1 (HUD).

---

## 3. `feat/utilities-demand` — Versorgung & Bedarf

**Status:** ⚪ Offen — nur Plan-Doc, noch nicht implementiert.

**Ziel:** Klassische SimCity-Tiefe — Zonen brauchen Versorgung und reagieren auf
Nachfrage.

- **Versorgungsnetz** (Strom, optional Wasser) als eigene Netz-Schicht analog
  zum Straßen-BFS: Kraftwerk-Tile speist verbundene Zonen.
  Unversorgte Zonen wachsen nicht / verfallen.
- **RCI-Nachfrage** — globaler Bedarf je Zonentyp (Residential/Commercial/
  Industrial), abgeleitet aus dem Verhältnis bestehender Zonen. Steuert wie
  schnell Zonen wachsen und treibt die HUD-Anzeige aus Feature 1.

**Berührt:** neues `src/core/utilities.js` (Versorgungs-BFS), `simulation.js`
(Versorgung + RCI als Wachstumsfaktor), `network.js` (Muster wiederverwenden),
`game.js`/`index.html` (Kraftwerk-Werkzeug, RCI-Balken).
**Abhängigkeiten:** RCI-Anzeige nutzt HUD aus Feature 1 (lose gekoppelt).

---

## 4. `feat/terrain-interaction` — Terrain-Interaktion

**Status:** 🟡 In Arbeit auf `feat/terrain-interaction` — Kernlogik umgesetzt
(`src/core/terrain.js`, Verdrahtung in `game.js`/`simulation.js`, Persistenz
Schema 3). Offen: Tests für `terrain.js` und Commit/PR.

**Ziel:** Die echten Geodaten (Höhe, Wasser, Wald) spielerisch nutzen statt nur
anzuzeigen.

- **Hang-Aufschlag** — Bau auf steilem Gelände (großer Höhenunterschied zu
  Nachbarn) kostet mehr.
- **Wasserlage-Bonus** — Wohnzonen nahe Wasser wachsen besser / werfen mehr ab.
- **Wald** — rodbar (kostet, gibt einmalig Geld); ungerodeter Wald gibt
  Wohn-Bonus in der Nähe (Naherholung).
- **Bau-Verbote** — Wasser bleibt unbebaubar (bereits umgesetzt), sehr steile
  Hänge optional gesperrt.

**Berührt:** `game.js` (Terrain-Sampling bei Bau bereits vorhanden — Kosten/Boni
ableiten), `simulation.js` (Lage-Boni ins Wachstum), evtl.
`src/core/terrain.js` für Hilfsfunktionen. **Abhängigkeiten:** keine.

---

## 5. `feat/version-display` — Release-Version im Spiel anzeigen

**Status:** ✅ Fertig — gemergt (PR #1), deployt mit v0.2.0.

**Ziel:** Die aktuell deployte Version (`vX.Y.Z`) im Spiel sichtbar machen.

Da es keinen Build gibt, schreibt der Release-Workflow beim Deploy eine
`version.json` auf `gh-pages`; das Spiel lädt sie und zeigt die Version dezent an
(Fallback `dev` lokal). Details in
[features/version-display.md](features/version-display.md).

**Berührt:** `release.yml` (version.json erzeugen), `index.html`/`game.js`
(laden & anzeigen). **Abhängigkeiten:** keine.

---

## 6. `feat/map-pipeline` — Karten-Pipeline mit automatischem PR

**Status:** ✅ Fertig — gemergt (PR #3), deployt mit v0.4.0; erste Karte Berlin
generiert (PR #4). Hinweis: Workflow nutzt inzwischen die `gh`-CLI statt einer
externen Action.

**Ziel:** Neue Karten auf Knopfdruck erzeugen (Karten werden nicht zur Laufzeit
generiert). Ein `workflow_dispatch`-Workflow ruft `generate_map.py` auf, pflegt
`maps/index.json` und öffnet via `peter-evans/create-pull-request` automatisch
einen PR. Kein Auto-Merge. Details in
[features/map-pipeline.md](features/map-pipeline.md).

**Berührt:** `tools/generate_map.py` (Manifest-Pflege),
`.github/workflows/new-map.yml`. **Abhängigkeiten:** baut auf `save-and-ux`
(Manifest + dynamische Städteliste).

---

## Reihenfolge (Empfehlung)

1. ~~**save-and-ux** zuerst — schafft Abriss, Persistenz und die HUD-Basis.~~ ✅
2. **economy-balance** ✅ und **terrain-interaction** (🟡 in Arbeit) — unabhängig,
   parallel möglich.
3. **utilities-demand** zuletzt — größtes Feature, nutzt die HUD-Anzeige aus 1.
   Einziges noch offenes Feature.

Jeder Branch: kleiner, fokussierter PR; CI muss grün sein; Conventional-Commit-
Titel (`feat: …`), damit der Release-Workflow den Versions-Bump korrekt ableitet.
