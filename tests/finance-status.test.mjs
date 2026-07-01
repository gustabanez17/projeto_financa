import test from "node:test";
import assert from "node:assert/strict";
import {
  cycleQuoteItemStatus,
  fixedExpensePaymentStatus,
  nextQuoteItemStatus,
  normalizeQuoteItemStatus,
  toggleFixedExpensePaymentStatus,
} from "../lib/finance-status.mjs";

test("despesa fixa antiga começa pendente e alterna para pago", () => {
  assert.equal(fixedExpensePaymentStatus({ recurrence: "fixed" }), "Pendente");
  assert.equal(toggleFixedExpensePaymentStatus({ recurrence: "fixed" }), "Pago");
  assert.equal(toggleFixedExpensePaymentStatus({ fixedPaymentStatus: "Pago" }), "Pendente");
});

test("item antigo de cotação mantém compatibilidade com a checklist", () => {
  assert.equal(normalizeQuoteItemStatus({ checked: false }), "Analisando");
  assert.equal(normalizeQuoteItemStatus({ checked: true }), "Escolhida");
});

test("status da cotação percorre analisando, escolhida e cancelada", () => {
  assert.equal(nextQuoteItemStatus("Analisando"), "Escolhida");
  assert.equal(nextQuoteItemStatus("Escolhida"), "Cancelada");
  assert.equal(nextQuoteItemStatus("Cancelada"), "Analisando");
});

test("uma nova opção escolhida substitui a vencedora anterior", () => {
  const items = [
    { id: 1, name: "Loja A", status: "Escolhida" },
    { id: 2, name: "Loja B", status: "Analisando" },
  ];
  const updated = cycleQuoteItemStatus(items, 2);
  assert.equal(updated[0].status, "Analisando");
  assert.equal(updated[1].status, "Escolhida");
});
