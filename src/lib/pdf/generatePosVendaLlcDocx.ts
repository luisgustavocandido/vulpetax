import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { promises as fs } from "fs";
import path from "path";
import { db } from "@/db";
import { clients, clientLineItems, clientPartners } from "@/db/schema";
import { eq } from "drizzle-orm";
import { assertPlaceholderCoverage } from "./posVendaPlaceholders";
import {
  EMPTY,
  formatDate,
  formatFlag,
  formatPercent,
  formatUsd,
  orEmpty,
} from "./formatHelpers";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "src/assets/templates/pos-venda-llc-template.docx"
);

function roleToPapel(role: string): string {
  if (role === "SocioPrincipal") return "Sócio Principal";
  if (role === "Socio") return "Sócio";
  return role;
}

/**
 * View model para o template DOCX — chaves exatamente como placeholders <<chave>>.
 * Todas as chaves devem existir para evitar "undefined".
 */
export type PosVendaViewModel = Record<string, string>;

async function buildViewModel(clientId: string): Promise<PosVendaViewModel | null> {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!client || client.deletedAt) return null;

  const items = await db
    .select()
    .from(clientLineItems)
    .where(eq(clientLineItems.clientId, clientId))
    .limit(5);

  const partnersRows = await db
    .select()
    .from(clientPartners)
    .where(eq(clientPartners.clientId, clientId));
  const partners = [...partnersRows].sort((a, b) => {
    if (a.role === "SocioPrincipal" && b.role !== "SocioPrincipal") return -1;
    if (a.role !== "SocioPrincipal" && b.role === "SocioPrincipal") return 1;
    return b.percentageBasisPoints - a.percentageBasisPoints;
  });

  const paymentDate =
    client.paymentDate ??
    (client.createdAt ? new Date(client.createdAt) : undefined);

  const viewModel: PosVendaViewModel = {
    empresa: orEmpty(client.companyName),
    idioma: "Português",
    codigo_cliente: orEmpty(client.customerCode),
    data_pagamento: formatDate(paymentDate),
    comercial: orEmpty(client.commercial),
    sdr: orEmpty(client.sdr),
    tipo_negocio: orEmpty(client.businessType),
    pagamento_via: orEmpty(client.paymentMethod),
    flag_anonimo: formatFlag(client.anonymous),
    flag_holding: formatFlag(client.holding),
    flag_afiliado: formatFlag(client.affiliate),
    flag_express: formatFlag(client.express),
    observacao: orEmpty(client.notes),
  };

  // Itens 1..5 (slots fixos sempre preenchidos)
  for (let i = 1; i <= 5; i++) {
    const item = items[i - 1];
    viewModel[`item_${i}_tipo`] = orEmpty(item?.kind);
    viewModel[`item_${i}_descricao`] = orEmpty(item?.description);
    viewModel[`item_${i}_valor`] = item ? formatUsd(item.valueCents) : EMPTY;
    viewModel[`item_${i}_sale_date`] = item?.saleDate ? formatDate(item.saleDate) : EMPTY;
    viewModel[`item_${i}_comercial`] = orEmpty(item?.commercial);
    viewModel[`item_${i}_sdr`] = orEmpty(item?.sdr);
  }

  // Sócios 1..5 (slots fixos sempre preenchidos)
  for (let i = 1; i <= 5; i++) {
    const p = partners[i - 1];
    viewModel[`socio_${i}_nome`] = orEmpty(p?.fullName);
    viewModel[`socio_${i}_papel`] = p ? roleToPapel(p.role) : EMPTY;
    viewModel[`socio_${i}_pct`] = p ? formatPercent(p.percentageBasisPoints / 100) : EMPTY;
  }

  return viewModel;
}

/**
 * Gera o DOCX preenchido a partir do template e dos dados do cliente.
 */
export async function generatePosVendaLlcDocx(input: {
  clientId: string;
}): Promise<Buffer> {
  const { clientId } = input;

  const viewModel = await buildViewModel(clientId);
  if (!viewModel) {
    throw new Error("Cliente não encontrado");
  }

  assertPlaceholderCoverage(viewModel, clientId);

  let templateBytes: Buffer;
  try {
    templateBytes = await fs.readFile(TEMPLATE_PATH);
  } catch {
    throw new Error(
      "Template DOCX não encontrado. Verifique src/assets/templates/pos-venda-llc-template.docx"
    );
  }

  const zip = new PizZip(templateBytes);
  const doc = new Docxtemplater(zip, {
    delimiters: { start: "<<", end: ">>" },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => EMPTY,
  });

  doc.render(viewModel);
  const docxBuffer = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  return docxBuffer as Buffer;
}
