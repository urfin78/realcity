# Feature: Release-Version im Spiel anzeigen (`feat/version-display`)

Siehe [ROADMAP](../ROADMAP.md) §5. Kleines UX-Feature.

## Ziel
Die aktuell deployte Release-Version (z.B. `v0.2.0`) soll im Spiel sichtbar sein,
damit man weiß, welcher Stand läuft (hilfreich für Bug-Reports / Caching-Checks).

## Herausforderung
Es gibt keinen Build-Schritt — die Version muss beim **Release** in eine vom
Spiel ladbare Datei geschrieben werden. Der `release.yml`-Workflow kennt den Tag
(`steps.version.outputs.tag`).

## Umfang

### 1. Version beim Deploy schreiben (`release.yml`)
- Im Deploy-Schritt vor dem Commit auf `gh-pages` eine `version.json` erzeugen:
  ```json
  { "version": "v0.2.0", "commit": "<sha>", "date": "<iso>" }
  ```
  z.B. via `printf` mit `${{ steps.version.outputs.tag }}` und `${{ github.sha }}`.

### 2. Version im Spiel anzeigen (`game.js` / `index.html`)
- Beim Start `fetch('version.json')` (best effort).
- Anzeige dezent neben der Attribution unten rechts, z.B. `RealCity v0.2.0`.
- Fallback wenn die Datei fehlt (lokale Entwicklung): `dev` anzeigen.

## Betroffene Dateien
- `.github/workflows/release.yml` (version.json beim Deploy erzeugen)
- `index.html` (Anzeige-Element, z.B. in/neben `#attribution`)
- `src/core/game.js` (version.json laden, einsetzen)
- `version.json` als Platzhalter im Repo (`{ "version": "dev" }`) für lokale Läufe

## Tests
- Klein; primär manuell (Anzeige nach Release sichtbar). Optional ein Test, der
  prüft, dass das Anzeige-Element existiert / der Fallback greift.

## Akzeptanzkriterien
- Nach einem Release zeigt die Live-Seite die korrekte `vX.Y.Z`.
- Lokal (ohne version.json) zeigt das Spiel `dev` und stürzt nicht ab.
- CI grün, Conventional-Commit-Titel.
