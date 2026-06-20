// Spielzustand — Budget, Bevölkerung, Tick

export const COSTS = {
  road:        500,
  zone:       1000,
};

export const INCOME = {
  residential: 200,  // × level pro Tick
  commercial:  500,
  industrial:  800,
  admin:         0,
};

export const state = {
  money:      100_000,
  population: 0,
  tick:       0,
};

// Callbacks die nach jedem Tick ausgeführt werden
const tickListeners = [];
export function onTick(fn) { tickListeners.push(fn); }

let tickInterval = null;

export function startTicks(intervalMs = 5000) {
  if (tickInterval) return;
  tickInterval = setInterval(() => {
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

// Überschreibt die state-Felder (z.B. nach dem Laden eines Spielstands),
// ohne die Objekt-Referenz zu ändern (Importe zeigen weiter auf dasselbe state).
export function applyState({ money, population, tick }) {
  if (Number.isFinite(money))      state.money = money;
  if (Number.isFinite(population)) state.population = population;
  if (Number.isFinite(tick))       state.tick = tick;
}

// Setzt den Zustand auf Spielbeginn zurück.
export function resetState() {
  state.money = 100_000;
  state.population = 0;
  state.tick = 0;
}
