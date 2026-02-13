/**
 * Script para verificar e criar sync_state no banco de produção
 * ATENÇÃO: Usa DATABASE_URL do ambiente (produção)
 */

import "dotenv/config";
import { Pool } from "pg";
import { readFileSync } from "fs";

async function checkAndCreateSyncState() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL não definida");
    process.exit(1);
  }

  // Detectar se é produção
  const isProduction = databaseUrl.includes("supabase.co") || 
                       databaseUrl.includes("vercel") ||
                       databaseUrl.includes("amazonaws.com") ||
                       databaseUrl.includes("neon.tech");

  if (!isProduction) {
    console.log("⚠️  Este script é para produção. DATABASE_URL parece ser local.");
    console.log("   Para usar em produção, defina DATABASE_URL da produção.\n");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10000,
    query_timeout: 30000,
  });

  try {
    console.log("🔍 Verificando tabela sync_state no banco...\n");

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
      console.log("📝 Criando tabela sync_state...\n");
      
      const migrationSql = readFileSync("drizzle/0006_tax_form_sync.sql", "utf-8");
      
      // Extrair apenas o CREATE TABLE
      const createTableMatch = migrationSql.match(/CREATE TABLE IF NOT EXISTS "sync_state"[\s\S]*?\);?/);
      
      if (createTableMatch) {
        const createTableSql = createTableMatch[0];
        await pool.query(createTableSql);
        console.log("✅ Tabela sync_state criada com sucesso!\n");
      } else {
        console.error("❌ Não foi possível extrair CREATE TABLE da migração");
        process.exitCode = 1;
      }
    } else {
      console.log("✅ Tabela sync_state já existe. Nenhuma ação necessária.\n");
    }

    // Verificar estrutura
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'sync_state'
      ORDER BY ordinal_position;
    `);
    
    console.log("📋 Estrutura da tabela 'sync_state':");
    columns.rows.forEach((row: any) => {
      console.log(`  - ${row.column_name} (${row.data_type}) ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

  } catch (error: any) {
    console.error("\n❌ Erro:");
    console.error("  Código:", error.code);
    console.error("  Mensagem:", error.message);
    if (error.position) {
      console.error("  Posição:", error.position);
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

checkAndCreateSyncState();
