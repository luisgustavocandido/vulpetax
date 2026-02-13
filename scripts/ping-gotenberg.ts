#!/usr/bin/env npx tsx
/**
 * Healthcheck opcional: ping Gotenberg (útil em dev).
 * Executar: npx tsx scripts/ping-gotenberg.ts
 */

import "dotenv/config";
import { pingGotenberg } from "../src/lib/pdf/pingGotenberg";

async function main() {
  const result = await pingGotenberg();
  if (result.ok) {
    console.log(`✓ Gotenberg OK (${result.ms}ms)`);
  } else {
    console.error(`✗ Gotenberg falhou: ${result.error}`);
    process.exit(1);
  }
}

main();
