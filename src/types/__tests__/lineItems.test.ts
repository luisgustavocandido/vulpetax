/**
 * Verificação mínima: compat layer (items → lineItems) e normalização.
 * Executar: npx tsx src/types/__tests__/lineItems.test.ts
 */

import {
  normalizeLegacyToLineItemInputArray,
  lineItemFromApi,
  lineItemToApi,
  type LineItemForm,
} from "../lineItems";

function runTests() {
  let passed = 0;
  let failed = 0;

  // A) Payload legado "items" com "type" em vez de "kind" é normalizado para lineItems
  const legacyItems = [
    { type: "LLC", description: "Item legado", valueCents: 1000 },
    { kind: "Endereco", description: "Endereço", valueCents: 0, billingPeriod: "Mensal" },
  ];
  const resultA = normalizeLegacyToLineItemInputArray(legacyItems);
  if (resultA.ok && resultA.items.length === 2 && resultA.items[0].kind === "LLC" && resultA.items[1].kind === "Endereco") {
    console.log("✓ [A] Payload legado (items com type/kind) normaliza para lineItems com kind");
    passed++;
  } else {
    console.error("✗ [A] Falhou:", resultA);
    failed++;
  }

  // B) Item com kind vazio é rejeitado (400)
  const noKind = [{ description: "Sem kind", valueCents: 0 }];
  const resultB = normalizeLegacyToLineItemInputArray(noKind);
  if (!resultB.ok && resultB.error.includes("kind") && resultB.status === 400) {
    console.log("✓ [B] Item sem kind rejeitado com 400 e mensagem clara");
    passed++;
  } else {
    console.error("✗ [B] Falhou: esperado ok:false, error sobre kind, status 400. Obtido:", resultB);
    failed++;
  }

  // C) lineItemFromApi + lineItemToApi: id ↔ dbId
  const apiItem = { id: "a1b2c3d4-0000-4000-8000-000000000000", kind: "LLC", description: "Test", valueCents: 500 };
  const formItem = lineItemFromApi(apiItem);
  const backToApi = lineItemToApi(formItem as LineItemForm);
  if (formItem.dbId === apiItem.id && backToApi.id === apiItem.id && backToApi.kind === apiItem.kind) {
    console.log("✓ [C] lineItemFromApi / lineItemToApi preservam id ↔ dbId");
    passed++;
  } else {
    console.error("✗ [C] Falhou: formItem.dbId=", formItem.dbId, "backToApi.id=", backToApi.id);
    failed++;
  }

  // D) lineItems (novo formato) já aceito
  const newFormat = [{ kind: "Gateway", description: "Novo", valueCents: 0 }];
  const resultD = normalizeLegacyToLineItemInputArray(newFormat);
  if (resultD.ok && resultD.items[0].kind === "Gateway") {
    console.log("✓ [D] Payload com lineItems (kind) aceito");
    passed++;
  } else {
    console.error("✗ [D] Falhou:", resultD);
    failed++;
  }

  console.log("\n---");
  console.log(passed > 0 ? `✓ ${passed} passed` : "");
  if (failed > 0) {
    console.error(`✗ ${failed} failed`);
    process.exit(1);
  }
  console.log("All lineItems checks passed.");
}

runTests();
