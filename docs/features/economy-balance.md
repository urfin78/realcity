# Feature: Wirtschaft & Balance (`feat/economy-balance`)

Siehe [ROADMAP](../ROADMAP.md) §2. Macht das Budget zur echten Herausforderung.

## Umfang

### 1. Laufender Unterhalt
- Konstanten in `state.js`: `UPKEEP = { road, residential, commercial, industrial, admin }`.
- Pro Tick: Summe über alle Zellen (skaliert mit Level) vom Budget abziehen.
- In `runSimulation` als negativer Posten verrechnen → Netto-Cashflow.

### 2. Steuersatz
- `state.taxRate` je Zonentyp (Default z.B. 10 %).
- Einnahme pro Zone = `INCOME[zone] * level * taxRate`.
- Höherer Satz erhöht Einnahmen, senkt aber Wachstums-Wahrscheinlichkeit
  (Faktor in `simulation.js`).
- Regler in `index.html` (Slider 0–20 %), Anzeige im HUD.

### 3. Kredit
- `takeLoan(amount)` → Budget += amount, `state.debt += amount`.
- Pro Tick: Tilgung + Zins vom Budget; `debt` sinkt.
- UI-Knopf „Kredit aufnehmen".

### 4. Bankrott
- Zählt Ticks mit `money < BANKRUPTCY_THRESHOLD`.
- Nach N Ticks → `state.gameOver = true`, Ticks stoppen, Overlay anzeigen.

## Betroffene Dateien
- `src/core/state.js` (Upkeep, Tax, Loan, Bankrott-Zähler, gameOver)
- `src/core/simulation.js` (Netto-Cashflow, Steuer↔Wachstum)
- `index.html` (Steuer-Slider, Kredit-Knopf, Game-Over-Overlay)
- `src/core/game.js` (HUD: Cashflow, Schulden, Game-Over-Handling)
- `tests/economy.test.mjs`

## Tests (node:test)
- Unterhalt reduziert das Budget korrekt pro Tick.
- Höherer Steuersatz → mehr Einnahme, messbar geringere Wachstumsrate.
- Kredit erhöht Budget und Schulden; Tilgung senkt beide über Ticks.
- Bankrott-Flag wird nach Schwellunterschreitung gesetzt.

## Akzeptanzkriterien
- Eine Stadt ohne Einnahmen rutscht durch Unterhalt ins Minus → Bankrott.
- Steuer-Regler verändert Cashflow und Wachstum sichtbar.
- CI grün, Conventional-Commit-Titel.
