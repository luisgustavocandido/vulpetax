/**
 * Testes unitários para ranges e MoM% da Dashboard Financeira.
 * Executar: npx tsx src/lib/__tests__/financeDashboardRanges.test.ts
 */

import {
  getMTDRange,
  getPrevMonthMTDRange,
  computeMoMPercent,
} from "../financeDashboardQueries";

function runTests() {
  let passed = 0;
  let failed = 0;

  // --- getMTDRange ---
  const mtd1 = getMTDRange("2025-03");
  if (mtd1.from === "2025-03-01") {
    console.log("✓ getMTDRange(2025-03).from = 2025-03-01");
    passed++;
  } else {
    console.error("✗ getMTDRange(2025-03).from esperado 2025-03-01, obteve", mtd1.from);
    failed++;
  }

  const mtd2 = getMTDRange("2024-12");
  if (mtd2.from === "2024-12-01" && mtd2.to === "2024-12-31") {
    console.log("✓ getMTDRange(2024-12) cobre o mês inteiro quando não é mês atual");
    passed++;
  } else {
    console.error("✗ getMTDRange(2024-12) esperado from=2024-12-01 to=2024-12-31, obteve", mtd2);
    failed++;
  }

  // --- getPrevMonthMTDRange ---
  const prev1 = getPrevMonthMTDRange("2025-03");
  if (prev1.from === "2025-02-01") {
    console.log("✓ getPrevMonthMTDRange(2025-03).from = 2025-02-01");
    passed++;
  } else {
    console.error("✗ getPrevMonthMTDRange(2025-03).from esperado 2025-02-01, obteve", prev1.from);
    failed++;
  }

  const prev2 = getPrevMonthMTDRange("2025-01");
  if (prev2.from === "2024-12-01") {
    console.log("✓ getPrevMonthMTDRange(2025-01).from = 2024-12-01");
    passed++;
  } else {
    console.error("✗ getPrevMonthMTDRange(2025-01).from esperado 2024-12-01, obteve", prev2.from);
    failed++;
  }

  // --- computeMoMPercent ---
  const mom1 = computeMoMPercent(120, 100);
  if (mom1 === 20) {
    console.log("✓ computeMoMPercent(120, 100) = 20");
    passed++;
  } else {
    console.error("✗ computeMoMPercent(120, 100) esperado 20, obteve", mom1);
    failed++;
  }

  const mom2 = computeMoMPercent(80, 100);
  if (mom2 === -20) {
    console.log("✓ computeMoMPercent(80, 100) = -20");
    passed++;
  } else {
    console.error("✗ computeMoMPercent(80, 100) esperado -20, obteve", mom2);
    failed++;
  }

  const mom3 = computeMoMPercent(50, 0);
  if (mom3 === null) {
    console.log("✓ computeMoMPercent(50, 0) = null (evita divisão por zero)");
    passed++;
  } else {
    console.error("✗ computeMoMPercent(50, 0) esperado null, obteve", mom3);
    failed++;
  }

  const mom4 = computeMoMPercent(0, 100);
  if (mom4 === -100) {
    console.log("✓ computeMoMPercent(0, 100) = -100");
    passed++;
  } else {
    console.error("✗ computeMoMPercent(0, 100) esperado -100, obteve", mom4);
    failed++;
  }

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
