import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Rota de health check para verificar conexão com banco de dados.
 * Útil para diagnóstico.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Testa conexão básica
    await db.execute(sql`SELECT 1`);
    
    // Tabelas críticas que devem existir
    const criticalTables = ["clients", "client_tax_forms"];
    
    // Verificar existência de cada tabela crítica
    const tableChecks = await Promise.all(
      criticalTables.map(async (tableName) => {
        const result = await db.execute(
          sql`SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${tableName}
          )`
        );
        return {
          table: tableName,
          exists: result.rows[0]?.exists ?? false,
        };
      })
    );
    
    const allTablesExist = tableChecks.every((check) => check.exists);
    const missingTables = tableChecks.filter((check) => !check.exists).map((check) => check.table);
    
    // Se alguma tabela crítica estiver faltando, retornar warning
    if (!allTablesExist) {
      return NextResponse.json(
        {
          status: "warning",
          database: "connected",
          tables: tableChecks,
          missingTables,
          message: missingTables.includes("client_tax_forms")
            ? "Migração pendente: tabela client_tax_forms não existe. Rode npm run db:migrate."
            : `Tabelas críticas faltando: ${missingTables.join(", ")}. Verifique migrações.`,
          migration: missingTables.includes("client_tax_forms")
            ? "drizzle/0010_client_tax_forms.sql"
            : undefined,
          timestamp: new Date().toISOString(),
        },
        { status: 200 } // 200 porque DB está conectado, mas há aviso
      );
    }
    
    return NextResponse.json({
      status: "ok",
      database: "connected",
      tables: tableChecks,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    const errorDetails = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? errorDetails : undefined,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
