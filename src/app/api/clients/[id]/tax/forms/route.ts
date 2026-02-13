import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients, clientPartners, clientTaxForms, clientTaxProfile, clientTaxOwners } from "@/db/schema";
import { eq, desc, and, asc } from "drizzle-orm";
import { getRequestMeta } from "@/lib/requestMeta";
import { logAudit, diffChangedFields } from "@/lib/audit";
import { z } from "zod";

const createTaxFormSchema = z.object({
  taxYear: z.number().int().min(2000).max(2100),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  if (!client || client.deletedAt) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const forms = await db
    .select({
      id: clientTaxForms.id,
      taxYear: clientTaxForms.taxYear,
      status: clientTaxForms.status,
      createdAt: clientTaxForms.createdAt,
      updatedAt: clientTaxForms.updatedAt,
    })
    .from(clientTaxForms)
    .where(eq(clientTaxForms.clientId, id))
    .orderBy(desc(clientTaxForms.taxYear), desc(clientTaxForms.createdAt));

  return NextResponse.json({ forms });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.error("[POST tax/forms] Invalid JSON body", { clientId: id });
    return NextResponse.json(
      { error: "Corpo da requisição inválido (JSON esperado)" },
      { status: 400 }
    );
  }

  const parsed = createTaxFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const meta = getRequestMeta(request);
  const { taxYear } = parsed.data;

  try {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);
    if (!client || client.deletedAt) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    // Verificar se já existe form para este ano
    const [existing] = await db
      .select()
      .from(clientTaxForms)
      .where(and(eq(clientTaxForms.clientId, id), eq(clientTaxForms.taxYear, taxYear)))
      .limit(1);
    if (existing) {
      return NextResponse.json(
        { error: `Já existe um formulário TAX para o ano ${taxYear}` },
        { status: 409 }
      );
    }

    // Buscar dados do client_tax_profile existente para pré-preencher
    const [existingProfile] = await db
      .select()
      .from(clientTaxProfile)
      .where(eq(clientTaxProfile.clientId, id))
      .limit(1);

    // Buscar owners existentes (client_tax_owners por clientId) - fallback para main owner
    const existingOwners = await db
      .select()
      .from(clientTaxOwners)
      .where(eq(clientTaxOwners.clientId, id))
      .orderBy(asc(clientTaxOwners.ownerIndex));
    const mainOwner = existingOwners.find((o) => o.ownerIndex === 1);

    // Preparar valores iniciais do form (copiar do profile antigo ou main owner)
    const formValues: Partial<typeof clientTaxForms.$inferInsert> = {
      clientId: id,
      taxYear,
      status: "draft",
      llcName: existingProfile?.llcName ?? client.companyName,
    };

    if (existingProfile) {
      // Copiar campos do profile antigo para o novo form
      Object.assign(formValues, {
        formationDate: existingProfile.formationDate,
        activitiesDescription: existingProfile.activitiesDescription,
        einNumber: existingProfile.einNumber,
        llcUsAddressLine1: existingProfile.llcUsAddressLine1,
        llcUsAddressLine2: existingProfile.llcUsAddressLine2,
        llcUsCity: existingProfile.llcUsCity,
        llcUsState: existingProfile.llcUsState,
        llcUsZip: existingProfile.llcUsZip,
        ownerEmail: existingProfile.ownerEmail,
        ownerFullLegalName: existingProfile.ownerFullLegalName,
        ownerResidenceCountry: existingProfile.ownerResidenceCountry,
        ownerCitizenshipCountry: existingProfile.ownerCitizenshipCountry,
        ownerHomeAddressDifferent: existingProfile.ownerHomeAddressDifferent,
        ownerResidentialAddressLine1: existingProfile.ownerResidentialAddressLine1,
        ownerResidentialAddressLine2: existingProfile.ownerResidentialAddressLine2,
        ownerResidentialCity: existingProfile.ownerResidentialCity,
        ownerResidentialState: existingProfile.ownerResidentialState,
        ownerResidentialPostalCode: existingProfile.ownerResidentialPostalCode,
        ownerResidentialCountry: existingProfile.ownerResidentialCountry,
        ownerUsTaxId: existingProfile.ownerUsTaxId,
        ownerForeignTaxId: existingProfile.ownerForeignTaxId,
        llcFormationCostUsdCents: existingProfile.llcFormationCostUsdCents,
        hasAdditionalOwners: existingProfile.hasAdditionalOwners,
        totalAssetsUsdCents: existingProfile.totalAssetsUsdCents,
        hasUsBankAccounts: existingProfile.hasUsBankAccounts,
        aggregateBalanceOver10k: existingProfile.aggregateBalanceOver10k,
        totalWithdrawalsUsdCents: existingProfile.totalWithdrawalsUsdCents,
        totalTransferredToLlcUsdCents: existingProfile.totalTransferredToLlcUsdCents,
        totalWithdrawnFromLlcUsdCents: existingProfile.totalWithdrawnFromLlcUsdCents,
        personalExpensesPaidByCompanyUsdCents: existingProfile.personalExpensesPaidByCompanyUsdCents,
        businessExpensesPaidPersonallyUsdCents: existingProfile.businessExpensesPaidPersonallyUsdCents,
      });
    } else if (mainOwner) {
      // Fallback: quando não há profile, usar dados do main owner (ownerIndex 1 de forms anteriores)
      Object.assign(formValues, {
        ownerEmail: mainOwner.email,
        ownerFullLegalName: mainOwner.fullLegalName,
        ownerResidenceCountry: mainOwner.residenceCountry,
        ownerCitizenshipCountry: mainOwner.citizenshipCountry,
        ownerHomeAddressDifferent: mainOwner.homeAddressDifferent ?? false,
        ownerUsTaxId: mainOwner.usTaxId,
        ownerForeignTaxId: mainOwner.foreignTaxId,
      });
    } else {
      // Fallback: usar dados do sócio principal do cliente (client_partners) ou dados pessoais do cliente
      const partners = await db
        .select()
        .from(clientPartners)
        .where(eq(clientPartners.clientId, id));
      const mainPartner = partners.find((p) => p.role === "SocioPrincipal") ?? partners[0];
      if (mainPartner) {
        const hasAddress = !!(
          mainPartner.addressLine1?.trim() ||
          mainPartner.city?.trim() ||
          mainPartner.country?.trim()
        );
        Object.assign(formValues, {
          ownerEmail: mainPartner.email ?? client.email,
          ownerFullLegalName: mainPartner.fullName,
          ownerResidenceCountry: mainPartner.country,
          ownerCitizenshipCountry: mainPartner.country,
          ownerHomeAddressDifferent: hasAddress,
          ownerResidentialAddressLine1: mainPartner.addressLine1 ?? null,
          ownerResidentialAddressLine2: mainPartner.addressLine2 ?? null,
          ownerResidentialCity: mainPartner.city ?? null,
          ownerResidentialState: mainPartner.state ?? null,
          ownerResidentialPostalCode: mainPartner.postalCode ?? null,
          ownerResidentialCountry: mainPartner.country ?? null,
        });
      } else {
        // Cliente sem sócios: usar dados pessoais do cliente
        const hasAddress = !!(
          client.personalAddressLine1?.trim() ||
          client.personalCity?.trim() ||
          client.personalCountry?.trim()
        );
        Object.assign(formValues, {
          ownerEmail: client.email ?? null,
          ownerFullLegalName: null,
          ownerResidenceCountry: client.personalCountry ?? null,
          ownerCitizenshipCountry: client.personalCountry ?? null,
          ownerHomeAddressDifferent: hasAddress,
          ownerResidentialAddressLine1: client.personalAddressLine1 ?? null,
          ownerResidentialAddressLine2: client.personalAddressLine2 ?? null,
          ownerResidentialCity: client.personalCity ?? null,
          ownerResidentialState: client.personalState ?? null,
          ownerResidentialPostalCode: client.personalPostalCode ?? null,
          ownerResidentialCountry: client.personalCountry ?? null,
        });
      }
    }
    console.log("[POST tax/forms] Starting insert", {
      clientId: id,
      taxYear,
      hasExistingProfile: !!existingProfile,
      formValuesKeys: Object.keys(formValues),
    });

    const [inserted] = await db
      .insert(clientTaxForms)
      .values(formValues as typeof clientTaxForms.$inferInsert)
      .returning({ id: clientTaxForms.id });

    if (!inserted) {
      console.error("[POST tax/forms] Insert returned no rows", { clientId: id, taxYear });
      return NextResponse.json(
        { error: "Erro ao criar formulário: nenhum registro retornado" },
        { status: 500 }
      );
    }

    const [full] = await db
      .select()
      .from(clientTaxForms)
      .where(eq(clientTaxForms.id, inserted.id))
      .limit(1);

    if (!full) {
      console.error("[POST tax/forms] Form not found after insert", {
        clientId: id,
        taxYear,
        insertedId: inserted.id,
      });
      return NextResponse.json(
        { error: "Erro ao criar formulário: registro não encontrado após inserção" },
        { status: 500 }
      );
    }

    const { oldValues, newValues } = diffChangedFields(null, full as Record<string, unknown>);
    await logAudit(db, {
      action: "create",
      entity: "client_tax_forms",
      entityId: inserted.id,
      oldValues,
      newValues,
      meta,
    });

    // Copiar owners do client_tax_owners antigo (vinculados ao clientId) para o novo form
    if (existingOwners.length > 0) {
      try {
        for (const owner of existingOwners) {
          await db.insert(clientTaxOwners).values({
            clientId: id,
            taxFormId: inserted.id,
            ownerIndex: owner.ownerIndex,
            email: owner.email,
            fullLegalName: owner.fullLegalName,
            residenceCountry: owner.residenceCountry,
            citizenshipCountry: owner.citizenshipCountry,
            homeAddressDifferent: owner.homeAddressDifferent,
            usTaxId: owner.usTaxId,
            foreignTaxId: owner.foreignTaxId,
          });
        }
      } catch (ownerErr) {
        console.error("[POST tax/forms] Error copying owners", {
          clientId: id,
          taxFormId: inserted.id,
          message: ownerErr instanceof Error ? ownerErr.message : String(ownerErr),
        });
        // Não falhar o request se houver erro ao copiar owners
      }
    }

    return NextResponse.json(
      { taxFormId: inserted.id, clientId: id, taxYear, status: "draft" },
      { status: 201 }
    );
  } catch (err) {
    const isDev = process.env.NODE_ENV !== "production";
    
    // Extrair informações do erro PostgreSQL se disponível
    let pgCode: string | undefined;
    let pgDetail: string | undefined;
    let pgConstraint: string | undefined;
    let pgTable: string | undefined;
    let pgColumn: string | undefined;
    
    // Drizzle/PostgreSQL errors podem ter propriedades diretas ou na mensagem
    // DrizzleQueryError tem o erro PostgreSQL em err.cause
    if (err && typeof err === "object") {
      // Tentar pegar do erro direto (mas só se não for undefined)
      if ("code" in err && err.code !== undefined) pgCode = String(err.code);
      if ("detail" in err && err.detail !== undefined) pgDetail = String(err.detail);
      if ("constraint" in err && err.constraint !== undefined) pgConstraint = String(err.constraint);
      if ("table" in err && err.table !== undefined) pgTable = String(err.table);
      if ("column" in err && err.column !== undefined) pgColumn = String(err.column);
      
      // Tentar pegar do cause (erro do PostgreSQL dentro do DrizzleQueryError)
      if ("cause" in err && err.cause && typeof err.cause === "object") {
        if (!pgCode && "code" in err.cause && err.cause.code !== undefined) {
          pgCode = String(err.cause.code);
        }
        if (!pgDetail && "detail" in err.cause && err.cause.detail !== undefined) {
          pgDetail = String(err.cause.detail);
        }
        if (!pgConstraint && "constraint" in err.cause && err.cause.constraint !== undefined) {
          pgConstraint = String(err.cause.constraint);
        }
        if (!pgTable && "table" in err.cause && err.cause.table !== undefined) {
          pgTable = String(err.cause.table);
        }
        if (!pgColumn && "column" in err.cause && err.cause.column !== undefined) {
          pgColumn = String(err.cause.column);
        }
      }
    }

    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorLower = errorMessage.toLowerCase();
    
    console.error("[POST tax/forms] Error creating form", {
      clientId: id,
      taxYear,
      message: errorMessage,
      pgCode,
      pgDetail,
      pgConstraint,
      pgTable,
      pgColumn,
      errorType: err?.constructor?.name,
      stack: err instanceof Error && isDev ? err.stack : undefined,
    });

    // Detectar tabela não encontrada (por código ou mensagem)
    if (pgCode === "42P01" || (errorLower.includes("relation") && errorLower.includes("does not exist"))) {
      // Extrair nome da tabela da mensagem de erro se pgTable não estiver disponível
      let tableName = pgTable && pgTable !== "undefined" ? pgTable : undefined;
      if (!tableName) {
        const match = errorMessage.match(/relation "([^"]+)"/);
        tableName = match ? match[1] : "client_tax_forms";
      }
      
      // Mensagem específica para client_tax_forms
      if (pgCode === "42P01" && (errorMessage.includes("client_tax_forms") || tableName === "client_tax_forms")) {
        console.log("[POST tax/forms] Migration pending - client_tax_forms table not found", {
          pgCode,
          tableName,
          detected: true,
        });
        
        return NextResponse.json(
          {
            error: "Migração pendente: tabela client_tax_forms não existe.",
            details: "Aplique drizzle/0010_client_tax_forms.sql no banco atual ou rode npm run db:migrate.",
            migration: "drizzle/0010_client_tax_forms.sql",
          },
          { status: 500 }
        );
      }
      
      // Mensagem genérica para outras tabelas
      console.log("[POST tax/forms] Table not found - returning error response", {
        pgCode,
        tableName,
        detected: true,
      });
      
      return NextResponse.json(
        {
          error: "Tabela não encontrada",
          details: isDev
            ? `Tabela "${tableName}" não existe. Verifique se todas as migrações foram aplicadas (npm run db:migrate).`
            : "Erro de configuração do banco de dados. Contate o suporte.",
          code: pgCode || "42P01",
        },
        { status: 500 }
      );
    }

    // Detectar constraint violation única (por código ou mensagem)
    if (pgCode === "23505" || errorLower.includes("unique constraint") || errorLower.includes("duplicate key")) {
      const constraintName = pgConstraint || errorLower.match(/constraint "([^"]+)"/)?.[1] || "client_tax_forms_client_year_unique";
      return NextResponse.json(
        {
          error: "Violação de constraint única",
          details: isDev
            ? `Já existe um formulário TAX para este cliente e ano fiscal. Constraint: ${constraintName}`
            : "Já existe um formulário TAX para este cliente e ano fiscal.",
          code: pgCode || "23505",
        },
        { status: 409 }
      );
    }

    // Detectar foreign key violation
    if (pgCode === "23503" || errorLower.includes("foreign key") || errorLower.includes("violates foreign key")) {
      const constraintName = pgConstraint || errorLower.match(/constraint "([^"]+)"/)?.[1] || "client_tax_forms_client_id_fkey";
      return NextResponse.json(
        {
          error: "Referência inválida",
          details: isDev
            ? `Cliente não encontrado ou referência inválida. Constraint: ${constraintName}`
            : "Cliente não encontrado.",
          code: pgCode || "23503",
        },
        { status: 404 }
      );
    }

    // Detectar NOT NULL violation
    if (pgCode === "23502" || errorLower.includes("null value") && errorLower.includes("not null")) {
      const columnName = pgColumn || errorLower.match(/column "([^"]+)"/)?.[1] || "desconhecido";
      return NextResponse.json(
        {
          error: "Campo obrigatório ausente",
          details: isDev
            ? `Campo obrigatório não fornecido: ${columnName}`
            : "Dados inválidos: campo obrigatório ausente.",
          code: pgCode || "23502",
        },
        { status: 400 }
      );
    }

    // Erro genérico
    return NextResponse.json(
      {
        error: "Falha ao criar TAX",
        details: isDev ? errorMessage : undefined,
        code: pgCode,
      },
      { status: 500 }
    );
  }
}
