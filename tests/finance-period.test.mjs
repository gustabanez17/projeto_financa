import test from "node:test";
import assert from "node:assert/strict";
import { addMonths, normalizeItemPeriod, periodFrom, periodLabel } from "../lib/finance-period.mjs";

test("competência atravessa dezembro e janeiro preservando o ano", () => {
  assert.equal(addMonths("2026-12", 1), "2027-01");
  assert.equal(addMonths("2027-01", -1), "2026-12");
});

test("registro antigo recebe competência sem perder o nome do mês", () => {
  assert.deepEqual(normalizeItemPeriod({ month: "Junho" }, "2026-07"), { month: "Junho", period: "2026-06", year: 2026 });
  assert.equal(periodFrom(2027, "Março"), "2027-03");
  assert.equal(periodLabel("2027-03"), "Março de 2027");
});
