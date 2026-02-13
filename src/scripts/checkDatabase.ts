#!/usr/bin/env tsx
/**
 * Script para verificar presença de tabelas críticas no banco de dados.
 * Útil para detectar migrações pendentes antes de iniciar o servidor.
 * 
 * Uso: npm run db:check
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";

const criticalTables = [
  "clients",
  "client_tax_forms",
  "client_tax_profile",
  "client_tax_owners",
];

async function checkDatabase() {
  console.log("🔍 Verificando tabelas críticas no banco de dados...\n");

  try {
    // Testar conexão
    await db.execute(sql`SELECT 1`);
    console.log("✅ Conexão com banco de dados estabelecida\n");

    // Verificar cada tabela
    const results = await Promise.all(
      criticalTables.map(async (tableName) => {
        const result = await db.execute(
          sql`SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${tableName}
          )`
        );
        const exists = result.rows[0]?.exists ?? false;
        return { table: tableName, exists };
      })
    );

    // Exibir resultados
    let hasMissing = false;
    for (const { table, exists } of results) {
      const icon = exists ? "✅" : "❌";
      const status = exists ? "existe" : "NÃO EXISTE";
      console.log(`${icon} ${table}: ${status}`);
      if (!exists) {
        hasMissing = true;
      }
    }

    console.log();

    // Verificar especificamente client_tax_forms
    const taxFormsExists = results.find((r) => r.table === "client_tax_forms")?.exists ?? false;
    if (!taxFormsExists) {
      console.log("⚠️  ATENÇÃO: Tabela client_tax_forms não encontrada!");
      console.log("   Isso indica que a migração para múltiplos TAX forms não foi aplicada.");
      console.log("   Para aplicar:");
      console.log("   1. npm run db:migrate");
      console.log("   2. Ou execute manualmente: drizzle/0010_client_tax_forms.sql");
      console.log();
    }

    if (hasMissing) {
      console.log("❌ Algumas tabelas críticas estão faltando.");
      console.log("   Execute: npm run db:migrate");
      process.exit(1);
    } else {
      console.log("✅ Todas as tabelas críticas estão presentes.");
      process.exit(0);
    }
  } catch (error) {
    console.error("❌ Erro ao verificar banco de dados:");
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    } else {
      console.error("   Erro desconhecido");
    }
    process.exit(1);
  }
}

checkDatabase();
