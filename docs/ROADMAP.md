# RealCity — Roadmap & Feature-Planung

Stand der Mechanik (Basis auf `main`): Budget, Straßennetz (BFS-Zusammenhang),
4 Zonentypen mit Level-Wachstum, Tick-basierte Einnahmen. Diese Roadmap baut
darauf die nächste Tiefe auf. Jedes Feature wird auf einem eigenen
`feat/...`-Branch entwickelt und per Pull Request (CI-geprüft) nach `main`
gemergt.

Reines Vanilla JS, kein Build — diese Bedingung gilt für jedes Feature.

---

## 1. `feat/save-and-ux` — Speichern & UX

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

## Reihenfolge (Empfehlung)

1. **save-and-ux** zuerst — schafft Abriss, Persistenz und die HUD-Basis, von der
   die anderen profitieren.
2. **economy-balance** und **terrain-interaction** parallel möglich (unabhängig).
3. **utilities-demand** zuletzt — größtes Feature, nutzt die HUD-Anzeige aus 1.

Jeder Branch: kleiner, fokussierter PR; CI muss grün sein; Conventional-Commit-
Titel (`feat: …`), damit der Release-Workflow den Versions-Bump korrekt ableitet.
