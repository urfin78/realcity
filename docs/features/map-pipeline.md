# Feature: Karten-Pipeline mit automatischem PR (`feat/map-pipeline`)

Siehe [ROADMAP](../ROADMAP.md) §6. Karten werden nicht zur Laufzeit erzeugt —
deshalb eine Pipeline, die auf Knopfdruck eine neue Karte baut und als PR vorlegt.

## Umfang

### 1. Generator pflegt das Manifest (`tools/generate_map.py`)
- Neue Funktion `update_manifest(name, lat, lon)`: trägt die Karte in
  `maps/index.json` ein (ersetzt bei gleicher ID, dedupliziert, sortiert nach Name).
- Bestehende Einträge bleiben erhalten — das Spiel zeigt nur vorhandene Karten.

### 2. Workflow `new-map.yml` (`workflow_dispatch`)
- Eingaben: `name`, `lat`, `lon`.
- Validiert Eingaben (Lat/Lon numerisch, Name nur Buchstaben/Bindestrich →
  verhindert Pfad-Manipulation).
- Installiert `requests rasterio numpy`, ruft `generate_map.py` auf.
- Validiert die erzeugte Karte (Pflichtfelder, Grid-Länge).
- Öffnet via `gh pr create` (CLI, keine externe Action) automatisch einen PR
  (`map/<stadt>` → `main`). **Kein Auto-Merge** — bewusste Prüfung.
- Hinweis: GitHub startet die CI auf bot-erstellten PRs nicht automatisch
  (Rekursionsschutz des `GITHUB_TOKEN`); im PR einmal „Approve workflows to run".

## Betroffene Dateien
- `tools/generate_map.py` (`update_manifest`)
- `.github/workflows/new-map.yml` (neu)

## Abhängigkeiten
- Baut auf `feat/save-and-ux` auf (dort entsteht `maps/index.json` + die
  dynamische Städteliste). Daher von diesem Branch abgezweigt.

## Bedienung
Actions → „Neue Karte generieren" → Stadt + Koordinaten eingeben → Workflow
erzeugt Karte und legt einen PR an. Nach dem Merge erscheint die Stadt
automatisch im Spiel-Dropdown.

## Akzeptanzkriterien
- Workflow erzeugt `maps/<stadt>.json` + Manifest-Eintrag und öffnet einen PR.
- CI auf dem PR (inkl. Manifest-Validierung) ist grün.
- Bestehende Karten gehen nicht verloren.
