export const QUOTE_ITEM_STATUSES = ["Analisando", "Escolhida", "Cancelada"];

export function normalizeQuoteItemStatus(item = {}) {
  if (QUOTE_ITEM_STATUSES.includes(item.status)) return item.status;
  return item.checked ? "Escolhida" : "Analisando";
}

export function nextQuoteItemStatus(status) {
  const current = QUOTE_ITEM_STATUSES.indexOf(status);
  return QUOTE_ITEM_STATUSES[(current + 1) % QUOTE_ITEM_STATUSES.length];
}

export function cycleQuoteItemStatus(items = [], itemId) {
  const selected = items.find((item) => item.id === itemId);
  if (!selected) return items;

  const nextStatus = nextQuoteItemStatus(normalizeQuoteItemStatus(selected));
  return items.map((item) => {
    if (item.id === itemId) return { ...item, status: nextStatus, checked: false };
    if (nextStatus === "Escolhida" && normalizeQuoteItemStatus(item) === "Escolhida") {
      return { ...item, status: "Analisando", checked: false };
    }
    return item;
  });
}

export function fixedExpensePaymentStatus(forecast = {}) {
  return forecast.fixedPaymentStatus === "Pago" ? "Pago" : "Pendente";
}

export function toggleFixedExpensePaymentStatus(forecast = {}) {
  return fixedExpensePaymentStatus(forecast) === "Pago" ? "Pendente" : "Pago";
}
