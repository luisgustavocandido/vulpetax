/**
 * Script para aplicar migração 0006 (sync_state) no banco de produção
 * 
 * Uso:
 *   DATABASE_URL="postgresql://..." npx tsx apply-prod-migration.ts
 * 
 * OU configure DATABASE_URL no .env e rode:
 *   npx tsx apply-prod-migration.ts
 */

import "dotenv/config";
import { Pool } from "pg";
import { readFileSync } from "fs";

async function applyProdMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL não definida");
    console.error("   Defina via: DATABASE_URL='...' npx tsx apply-prod-migration.ts");
    process.exit(1);
  }

  // Detectar ambiente
  const isProduction = 
    databaseUrl.includes("supabase.co") || 
    databaseUrl.includes("supabase.com") ||
    databaseUrl.includes("vercel") ||
    databaseUrl.includes("amazonaws.com") ||
    databaseUrl.includes("neon.tech");

  console.log(`🌍 Ambiente: ${isProduction ? "PRODUÇÃO" : "LOCAL"}\n`);

  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10000,
    query_timeout: 30000,
  });

  try {
    console.log("🔍 Verificando tabela sync_state...\n");

    const check = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sync_state'
      );
    `);

    const exists = check.rows[0].exists;
    console.log(`📊 Tabela 'sync_state' existe: ${exists}\n`);

    if (!exists) {
      console.log("📝 Aplicando migração 0006_tax_form_sync.sql...\n");
      
      const migrationSql = readFileSync("drizzle/0006_tax_form_sync.sql", "utf-8");
      
      // Dividir por linhas e executar cada statement
      const statements = migrationSql
        .split(";")
        .map(s => s.trim())
        .filter(s => s && !s.startsWith("--") && s.length > 10);

      for (const stmt of statements) {
        try {
          await pool.query(stmt + ";");
          const preview = stmt.substring(0, 60).replace(/\n/g, " ");
          console.log(`  ✓ ${preview}...`);
        } catch (e: any) {
          // Ignorar erros de "already exists" ou "does not exist" (para IF NOT EXISTS)
          if (
            !e.message.includes("already exists") &&
            !e.message.includes("does not exist") &&
            !e.message.includes("duplicate")
          ) {
            console.error(`  ❌ Erro: ${e.message}`);
            console.error(`     SQL: ${stmt.substring(0, 100)}...`);
            throw e;
          }
        }
      }

      console.log("\n✅ Migração aplicada com sucesso!\n");
    } else {
      console.log("✅ Tabela sync_state já existe. Nenhuma ação necessária.\n");
    }

    // Verificar estrutura final
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'sync_state'
      ORDER BY ordinal_position;
    `);
    
    console.log("📋 Estrutura da tabela 'sync_state':");
    columns.rows.forEach((row: any) => {
      const nullable = row.is_nullable === "NO" ? "NOT NULL" : "NULL";
      console.log(`  - ${row.column_name.padEnd(20)} ${row.data_type.padEnd(25)} ${nullable}`);
    });

    // Verificar se há registros
    const count = await pool.query(`SELECT COUNT(*) as count FROM sync_state;`);
    console.log(`\n📊 Registros na tabela: ${count.rows[0].count}`);

  } catch (error: any) {
    console.error("\n❌ Erro ao aplicar migração:");
    console.error("  Código:", error.code);
    console.error("  Mensagem:", error.message);
    if (error.position) {
      console.error("  Posição:", error.position);
    }
    if (error.detail) {
      console.error("  Detalhe:", error.detail);
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

applyProdMigration();
