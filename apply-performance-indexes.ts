/**
 * Script para aplicar índices de performance no Neon
 * 
 * Uso:
 *   DATABASE_URL="postgresql://...neon..." npx tsx apply-performance-indexes.ts
 * 
 * OU configure DATABASE_URL no .env e rode:
 *   npx tsx apply-performance-indexes.ts
 */

import "dotenv/config";
import { Pool } from "pg";

async function applyIndexes() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL não definida");
    console.error("   Defina via: DATABASE_URL='...' npx tsx apply-performance-indexes.ts");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10000,
    query_timeout: 30000,
  });

  const indexes = [
    {
      name: "idx_client_line_items_client_id",
      sql: `CREATE INDEX IF NOT EXISTS idx_client_line_items_client_id 
            ON client_line_items(client_id);`,
      description: "Índice para JOIN em client_line_items (melhora performance da subquery agregada)",
    },
    {
      name: "idx_clients_created_at_desc",
      sql: `CREATE INDEX IF NOT EXISTS idx_clients_created_at_desc 
            ON clients(created_at DESC) 
            WHERE deleted_at IS NULL;`,
      description: "Índice para ORDER BY created_at DESC (query de listagem)",
    },
    {
      name: "idx_clients_deleted_at_null",
      sql: `CREATE INDEX IF NOT EXISTS idx_clients_deleted_at_null 
            ON clients(deleted_at) 
            WHERE deleted_at IS NULL;`,
      description: "Índice para WHERE deleted_at IS NULL (filtro comum)",
    },
    {
      name: "idx_clients_query_optimized",
      sql: `CREATE INDEX IF NOT EXISTS idx_clients_query_optimized 
            ON clients(created_at DESC, deleted_at) 
            WHERE deleted_at IS NULL;`,
      description: "Índice composto para otimizar query completa (ORDER BY + WHERE)",
    },
  ];

  try {
    console.log("🔍 Verificando índices existentes...\n");

    // Verificar índices existentes
    const existingIndexes = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND indexname IN (
        'idx_client_line_items_client_id',
        'idx_clients_created_at_desc',
        'idx_clients_deleted_at_null',
        'idx_clients_query_optimized'
      );
    `);

    const existingNames = existingIndexes.rows.map((r: any) => r.indexname);
    console.log(`📊 Índices existentes: ${existingNames.length > 0 ? existingNames.join(", ") : "nenhum"}\n`);

    // Criar índices
    console.log("📝 Criando índices de performance...\n");
    
    for (const idx of indexes) {
      const exists = existingNames.includes(idx.name);
      
      if (exists) {
        console.log(`⏭️  Índice '${idx.name}' já existe. Pulando...`);
      } else {
        try {
          await pool.query(idx.sql);
          console.log(`✅ Índice criado: ${idx.name}`);
          console.log(`   ${idx.description}`);
        } catch (error: any) {
          // Ignorar erro se índice já existe (race condition)
          if (error.message.includes("already exists") || error.code === "42P07") {
            console.log(`⏭️  Índice '${idx.name}' já existe.`);
          } else {
            console.error(`❌ Erro ao criar índice '${idx.name}':`, error.message);
            throw error;
          }
        }
      }
    }

    console.log("\n✅ Processo concluído!\n");

    // Verificar índices finais
    const finalIndexes = await pool.query(`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND indexname IN (
        'idx_client_line_items_client_id',
        'idx_clients_created_at_desc',
        'idx_clients_deleted_at_null',
        'idx_clients_query_optimized'
      )
      ORDER BY indexname;
    `);

    console.log("📋 Índices criados:");
    finalIndexes.rows.forEach((row: any) => {
      console.log(`  - ${row.indexname}`);
      console.log(`    ${row.indexdef.substring(0, 80)}...`);
    });

  } catch (error: any) {
    console.error("\n❌ Erro ao aplicar índices:");
    console.error("  Código:", error.code);
    console.error("  Mensagem:", error.message);
    if (error.detail) {
      console.error("  Detalhe:", error.detail);
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

applyIndexes();
