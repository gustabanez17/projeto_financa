import { itemMatchesPeriod, normalizeItemPeriod } from "./finance-period.mjs";

function installmentParts(item = {}) {
  const match = String(item.installment || "").match(/^(\d+)\/(\d+)$/);
  return {
    index: Number(item.installmentIndex || match?.[1] || 1),
    count: Number(item.installmentCount || match?.[2] || 1),
  };
}

function summarizeGroup(items, selectedPeriod, kind) {
  const ordered = [...items].sort((a, b) => installmentParts(a).index - installmentParts(b).index);
  const first = ordered[0];
  const count = Math.max(...ordered.map((item) => installmentParts(item).count), ordered.length);
  const total = Number(first.seriesTotal) || ordered.reduce((sum, item) => sum + Number(kind === "forecast" ? item.planned : item.amount || 0), 0);
  const paidItems = ordered.filter((item) => kind === "forecast" ? Boolean(item.actualConfirmed ?? item.transactionId) : item.status === "Realizado" || item.status === "Pago");
  const paid = paidItems.reduce((sum, item) => sum + Number(kind === "forecast" ? (item.actual ?? item.planned) : item.amount || 0), 0);
  const current = ordered.find((item) => itemMatchesPeriod(item, selectedPeriod, selectedPeriod));
  return {
    id: `${kind}-${first.installmentSeriesId || first.seriesId || first.id}`,
    kind,
    description: first.description || first.title || "Parcelamento",
    category: first.category || "Outros",
    person: first.person || "",
    card: first.card || "",
    count,
    currentInstallment: current ? installmentParts(current).index : null,
    total,
    paid,
    pending: Math.max(total - paid, 0),
    paidCount: paidItems.length,
    percent: total > 0 ? Math.min(Math.round((paid / total) * 100), 100) : 0,
    startPeriod: normalizeItemPeriod(first, selectedPeriod).period,
  };
}

export function installmentSummaries({ forecasts = [], transactions = [] }, selectedPeriod) {
  const groups = new Map();
  forecasts.filter((item) => item.recurrence === "installment" || item.installmentCount > 1).forEach((item) => {
    const key = `forecast-${item.installmentSeriesId || item.seriesId || item.id}`;
    groups.set(key, [...(groups.get(key) || []), item]);
  });
  transactions.filter((item) => item.installment && !item.linkedForecastId).forEach((item) => {
    const parsed = installmentParts(item);
    const fallbackSeries = Number(item.id) - Math.max(parsed.index - 1, 0);
    const key = `transaction-${item.installmentSeriesId || item.seriesId || fallbackSeries}`;
    groups.set(key, [...(groups.get(key) || []), item]);
  });
  return [...groups.entries()].map(([key, items]) => summarizeGroup(items, selectedPeriod, key.startsWith("forecast-") ? "forecast" : "transaction"))
    .sort((a, b) => a.startPeriod.localeCompare(b.startPeriod));
}
