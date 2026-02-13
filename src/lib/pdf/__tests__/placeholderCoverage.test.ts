/**
 * Teste de cobertura de placeholders: expectedPlaceholders ⊆ Object.keys(viewModel)
 * Executar: npx tsx src/lib/pdf/__tests__/placeholderCoverage.test.ts
 */

import {
  EXPECTED_PLACEHOLDERS,
  validatePlaceholders,
  assertPlaceholderCoverage,
} from "../posVendaPlaceholders";

// View model fictício com todas as chaves (para validação)
const fullViewModel: Record<string, string> = Object.fromEntries(
  EXPECTED_PLACEHOLDERS.map((k) => [k, "—"])
);

function runTests() {
  let passed = 0;
  let failed = 0;

  // Teste 1: viewModel completo deve passar
  const missing1 = validatePlaceholders(fullViewModel);
  if (missing1.length === 0) {
    console.log("✓ expectedPlaceholders ⊆ Object.keys(viewModel) quando completo");
    passed++;
  } else {
    console.error("✗ Falhou: viewModel completo deveria ter 0 faltando, obteve:", missing1);
    failed++;
  }

  // Teste 2: viewModel incompleto deve retornar faltantes
  const partial = { empresa: "x", codigo_cliente: "y" };
  const missing2 = validatePlaceholders(partial);
  if (missing2.length > 0 && missing2.includes("data_pagamento")) {
    console.log("✓ viewModel parcial retorna keys faltantes corretamente");
    passed++;
  } else {
    console.error("✗ Falhou: viewModel parcial deveria listar faltantes, obteve:", missing2);
    failed++;
  }

  // Teste 3: assertPlaceholderCoverage não lança quando OK
  try {
    assertPlaceholderCoverage(fullViewModel, "test-uuid");
    console.log("✓ assertPlaceholderCoverage não lança com viewModel completo");
    passed++;
  } catch {
    console.error("✗ assertPlaceholderCoverage não deveria lançar com viewModel completo");
    failed++;
  }

  // Teste 4: assertPlaceholderCoverage lança quando faltam keys
  try {
    assertPlaceholderCoverage(partial, "test-uuid");
    console.error("✗ assertPlaceholderCoverage deveria lançar com viewModel incompleto");
    failed++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("test-uuid") && msg.includes("Placeholders faltando")) {
      console.log("✓ assertPlaceholderCoverage lança com mensagem correta");
      passed++;
    } else {
      console.error("✗ Mensagem inesperada:", msg);
      failed++;
    }
  }

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
