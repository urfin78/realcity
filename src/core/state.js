// Spielzustand — Budget, Bevölkerung, Tick, Wirtschaft

export const COSTS = {
  road:        500,
  zone:       1000,
  power:      5000,   // Kraftwerk — teuer, versorgt aber viele Zonen
};

// Brutto-Einnahmen einer Zone pro Tick = INCOME[zone] × level × taxRate.
export const INCOME = {
  residential: 200,
  commercial:  500,
  industrial:  800,
  admin:         0,
};

// Laufender Unterhalt pro Tick. Straße: fix. Zonen: Grundbetrag × max(level,1),
// d.h. auch eine frisch gesetzte (Level-0-)Zone kostet bereits etwas.
export const UPKEEP = {
  road:         20,
  residential:  40,
  commercial:   50,
  industrial:   70,
  admin:       150,  // Verwaltung ist teuer, wirft aber keine Einnahmen ab
  power:       200,  // Kraftwerk: hoher Betriebsunterhalt
};

// Steuer: zulässiger Bereich und Default je Zonentyp (Anteil 0.0–0.2).
export const TAX_MIN = 0.0;
export const TAX_MAX = 0.2;
const DEFAULT_TAX = 0.10;

// Kredit: Zinssatz pro Tick und Tilgungsanteil der Restschuld pro Tick.
export const LOAN_INTEREST = 0.02;   // 2 % der Restschuld pro Tick
export const LOAN_REPAYMENT = 0.05;  // 5 % der Restschuld pro Tick getilgt

// Bankrott: Schwelle und Anzahl aufeinanderfolgender Ticks darunter.
export const BANKRUPTCY_THRESHOLD = 0;
export const BANKRUPTCY_TICKS = 5;

const START_MONEY = 100_000;

function defaultTaxRates() {
  return { residential: DEFAULT_TAX, commercial: DEFAULT_TAX, industrial: DEFAULT_TAX };
}

export const state = {
  money:        START_MONEY,
  population:   0,
  tick:         0,
  // Wirtschaft
  taxRates:     defaultTaxRates(),
  debt:         0,
  brokeTicks:   0,      // aufeinanderfolgende Ticks mit money < Schwelle
  gameOver:     false,
  // RCI-Nachfrage, je Tick aus dem Zonen-Mix neu berechnet (für die HUD-Balken).
  demand:       { residential: 0, commercial: 0, industrial: 0 },
};

// Callbacks die nach jedem Tick ausgeführt werden
const tickListeners = [];
export function onTick(fn) { tickListeners.push(fn); }

let tickInterval = null;

export function startTicks(intervalMs = 5000) {
  if (tickInterval) return;
  tickInterval = setInterval(() => {
    if (state.gameOver) return;   // nach Game-Over keine weiteren Ticks verrechnen
    state.tick++;
    tickListeners.forEach(fn => fn());
  }, intervalMs);
}

export function stopTicks() {
  clearInterval(tickInterval);
  tickInterval = null;
}

export function spend(amount) {
  if (state.money < amount) return false;
  state.money -= amount;
  return true;
}

export function earn(amount) {
  state.money += amount;
}

// Setzt den Steuersatz eines Zonentyps, geklemmt auf [TAX_MIN, TAX_MAX].
export function setTaxRate(zone, rate) {
  if (!(zone in state.taxRates)) return;
  state.taxRates[zone] = Math.max(TAX_MIN, Math.min(TAX_MAX, rate));
}

// Nimmt einen Kredit auf: Budget und Schuldenstand steigen um amount.
export function takeLoan(amount) {
  if (!(amount > 0)) return false;
  state.money += amount;
  state.debt  += amount;
  return true;
}

// Verrechnet Kreditzinsen und Tilgung für einen Tick.
// Zinsen erhöhen die Schuld, Tilgung senkt Schuld und Budget.
// Gibt den negativen Cashflow-Anteil (Tilgung, als positive Zahl) zurück.
export function serviceLoan() {
  if (state.debt <= 0) return 0;
  state.debt += state.debt * LOAN_INTEREST;
  let repay = state.debt * LOAN_REPAYMENT;
  if (repay > state.debt) repay = state.debt;
  state.debt  -= repay;
  state.money -= repay;
  if (state.debt < 1) state.debt = 0;  // Restschuld unter 1 € abrunden
  return repay;
}

// Prüft den Bankrott-Zähler nach einem Tick. Setzt gameOver wenn die Schwelle
// BANKRUPTCY_TICKS-mal in Folge unterschritten wurde.
export function checkBankruptcy() {
  if (state.money < BANKRUPTCY_THRESHOLD) {
    state.brokeTicks++;
    if (state.brokeTicks >= BANKRUPTCY_TICKS) state.gameOver = true;
  } else {
    state.brokeTicks = 0;
  }
  return state.gameOver;
}

// Überschreibt die state-Felder (z.B. nach dem Laden eines Spielstands),
// ohne die Objekt-Referenz zu ändern (Importe zeigen weiter auf dasselbe state).
export function applyState({ money, population, tick, taxRates, debt, brokeTicks, gameOver }) {
  if (Number.isFinite(money))      state.money = money;
  if (Number.isFinite(population)) state.population = population;
  if (Number.isFinite(tick))       state.tick = tick;
  if (Number.isFinite(debt))       state.debt = debt;
  if (Number.isFinite(brokeTicks)) state.brokeTicks = brokeTicks;
  if (typeof gameOver === 'boolean') state.gameOver = gameOver;
  if (taxRates) {
    for (const z of Object.keys(state.taxRates)) {
      if (Number.isFinite(taxRates[z])) {
        state.taxRates[z] = Math.max(TAX_MIN, Math.min(TAX_MAX, taxRates[z]));
      }
    }
  }
}

// Setzt den Zustand auf Spielbeginn zurück.
export function resetState() {
  state.money = START_MONEY;
  state.population = 0;
  state.tick = 0;
  state.taxRates = defaultTaxRates();
  state.debt = 0;
  state.brokeTicks = 0;
  state.gameOver = false;
  state.demand = { residential: 0, commercial: 0, industrial: 0 };
}
