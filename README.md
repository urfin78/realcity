# RealCity

Ein browserbasierter Städtebauer (SimCity-artig) auf **echtem Terrain**: Höhenrelief
aus SRTM-Satellitendaten, Wasser und Wald aus OpenStreetMap. Reines Vanilla
HTML5/JavaScript — **kein npm, kein Node, kein Build-Schritt** zur Laufzeit.

## Spielen

Die jeweils veröffentlichte Version läuft auf GitHub Pages
(nach dem ersten Release unter `https://urfin78.github.io/realcity/`).
Zum Spielen ist **keinerlei Installation** nötig — es ist eine statische Seite.

## Lokal entwickeln

Das Spiel nutzt ES-Module und `fetch()`, daher funktioniert es **nicht** per
Doppelklick (`file://`). Es braucht einen beliebigen statischen HTTP-Server.
Ein paar Möglichkeiten (eine genügt):

```bash
python3 -m http.server 8000      # Python (überall vorinstalliert)
npx serve                        # Node, falls vorhanden
# oder die "Live Server"-Extension in VS Code
```

Dann `http://localhost:8000/` öffnen.

> Hinweis: Python wird hier **nur als bequemer lokaler Server** genutzt — das
> Spiel selbst hat keine Python-Abhängigkeit. Für das Hosting auf GitHub Pages
> ist gar kein Server-Tooling nötig.

## Projektstruktur

```
index.html              Spiel-Einstieg (HUD, Toolbar, Canvas)
preview.html            Terrain-Vorschau-Werkzeug (Debug)
src/
  core/                 Spiel-Logik
    game.js             Render-Loop, Eingabe, Kamera
    state.js            Budget, Bevölkerung, Tick-System
    network.js          Straßennetz-Analyse (BFS, Zusammenhang)
    simulation.js       Zonen-Wachstum pro Tick
  map/                  Terrain-/Karten-Hilfsmodule
  data/                 Tile-Typen, Farben, Labels
maps/                   Generierte Spielkarten (*.json) — siehe maps/README.md
tools/
  generate_map.py       Karten-Generator (SRTM + OSM → maps/*.json)
srtm/                   SRTM-Höhenrohdaten (nicht versioniert, s. .gitignore)
tests/                  Unit-Tests (node:test, keine Dependencies)
```

## Neue Karten generieren

Dieser Schritt ist **Vorverarbeitung** und der einzige Teil mit echter
Python-Abhängigkeit. Das Ergebnis (`maps/<stadt>.json`) wird committet, sodass
Spieler nichts generieren müssen.

```bash
pip install requests           # Pflicht
pip install rasterio numpy     # optional: bessere SRTM-Abtastung (sonst Fallback)

python3 tools/generate_map.py Dresden 51.05 13.74
python3 tools/generate_map.py Hamburg 53.55 10.00
```

Der Generator lädt die passende SRTM-Kachel (gecacht in `srtm/`) und fragt die
OSM **Overpass API** nach Wasser-/Waldflächen ab.

## Tests & CI

Unit-Tests laufen mit der **Node-Standardbibliothek** (`node:test`) — kein npm,
keine `package.json`, keine Dependencies:

```bash
node --test tests/
```

GitHub Actions (`.github/workflows/`):

| Workflow | Auslöser | Zweck |
|----------|----------|-------|
| `ci.yml` | Push auf `main`, jeder Pull Request | JS-Syntax-Check, Unit-Tests, Python-`py_compile`+pyflakes, JSON-Validierung |
| `release.yml` | **manuell** (`workflow_dispatch`) | Version-Bump aus Conventional Commits → GitHub Release → Deploy auf `gh-pages` |

Deployt wird also **nicht bei jedem Push**, sondern nur durch einen bewusst
gestarteten Release-Lauf. Der Version-Sprung richtet sich nach den
[Conventional Commits](https://www.conventionalcommits.org/) seit dem letzten Tag:
`feat:` → minor, `fix:`/sonstige → patch, `!:`/`BREAKING CHANGE` → major.

## Verwendete Komponenten & Werkzeuge

| Komponente | Rolle | Lizenz / Quelle |
|------------|-------|-----------------|
| Vanilla HTML5/JS (ES-Module, Canvas 2D) | Frontend, Spiel-Logik | — (eigener Code, MIT) |
| Python 3 + [`requests`](https://pypi.org/project/requests/) | Karten-Generator | Apache 2.0 |
| [`rasterio`](https://pypi.org/project/rasterio/) + [`numpy`](https://pypi.org/project/numpy/) *(optional)* | SRTM-Abtastung | BSD |
| Node.js Standardbibliothek (`node:test`) | Tests/CI (nur Runner) | — |
| GitHub Actions | CI & Release | — |

### Datenquellen

| Daten | Quelle | Lizenz |
|-------|--------|--------|
| Höhenmodell | [SRTM](https://srtm.csi.cgiar.org/) (NASA / CGIAR-CSI) | Public Domain |
| Wasser, Wald | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass API | **ODbL** © OpenStreetMap-Mitwirkende |

Die generierten `maps/*.json` enthalten OSM-Daten und stehen daher als
abgeleitete Datenbank unter der **ODbL** — Details und Pflichten in
[`maps/README.md`](maps/README.md). Der Quellcode ist **MIT** (siehe
[`LICENSE`](LICENSE)). Code und Daten sind lizenzrechtlich getrennt.

## Lizenz

Quellcode: [MIT](LICENSE). Kartendaten: ODbL / Public Domain (siehe oben).

---

> 🤖 Dieses Projekt wurde mit Unterstützung von [Claude Code](https://claude.com/claude-code)
> (Anthropic) erstellt.
