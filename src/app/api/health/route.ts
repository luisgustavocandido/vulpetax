import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Rota de health check para verificar conexão com banco de dados.
 * Útil para diagnóstico.
 */
export async function GET() {
  try {
    // Testa conexão básica
    await db.execute(sql`SELECT 1`);
    
    // Testa se a tabela clients existe
    const result = await db.execute(
      sql`SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'clients'
      )`
    );
    
    const tableExists = result.rows[0]?.exists ?? false;
    
    return NextResponse.json({
      status: "ok",
      database: "connected",
      tableExists,
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
