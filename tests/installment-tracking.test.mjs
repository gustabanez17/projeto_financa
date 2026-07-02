import test from "node:test";
import assert from "node:assert/strict";
import { installmentSummaries } from "../lib/installment-tracking.mjs";

test("resume parcelas pagas, pendentes e parcela da competência", () => {
  const forecasts = [1, 2, 3].map((index) => ({
    id: 100 + index,
    seriesId: 100,
    recurrence: "installment",
    installment: `${index}/3`,
    installmentIndex: index,
    installmentCount: 3,
    seriesTotal: 300,
    planned: 100,
    actual: index < 3 ? 100 : null,
    actualConfirmed: index < 3,
    description: "Notebook",
    period: `2026-0${index + 6}`,
  }));
  const [summary] = installmentSummaries({ forecasts }, "2026-08");
  assert.equal(summary.currentInstallment, 2);
  assert.equal(summary.paid, 200);
  assert.equal(summary.pending, 100);
  assert.equal(summary.percent, 67);
});
