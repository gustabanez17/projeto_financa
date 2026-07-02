export const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function periodFrom(year, month) {
  const monthIndex = MONTHS.indexOf(month);
  const safeYear = Number(year) || new Date().getFullYear();
  return `${safeYear}-${String(Math.max(monthIndex, 0) + 1).padStart(2, "0")}`;
}

export function periodParts(period) {
  const match = String(period || "").match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : new Date();
  return { year: date.getFullYear(), monthIndex: date.getMonth(), month: MONTHS[date.getMonth()] };
}

export function addMonths(period, amount) {
  const { year, monthIndex } = periodParts(period);
  const date = new Date(year, monthIndex + Number(amount || 0), 1);
  return periodFrom(date.getFullYear(), MONTHS[date.getMonth()]);
}

export function normalizeItemPeriod(item = {}, fallbackPeriod) {
  const fallback = periodParts(fallbackPeriod);
  const period = item.period || periodFrom(item.year || fallback.year, item.month || fallback.month);
  const parts = periodParts(period);
  return { ...item, period, year: parts.year, month: parts.month };
}

export function itemMatchesPeriod(item, selectedPeriod, fallbackPeriod = selectedPeriod) {
  return normalizeItemPeriod(item, fallbackPeriod).period === selectedPeriod;
}

export function periodLabel(period, short = false) {
  const { year, month } = periodParts(period);
  return short ? `${month.slice(0, 3)}/${String(year).slice(-2)}` : `${month} de ${year}`;
}

export function normalizeMonthlyBalances(balances = {}, fallbackYear) {
  return Object.fromEntries(Object.entries(balances).map(([key, value]) => {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) return [key, value];
    return [periodFrom(fallbackYear, key), value];
  }));
}
