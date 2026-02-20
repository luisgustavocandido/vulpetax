import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { promises as fs } from "fs";
import path from "path";
import { db } from "@/db";
import { clients, clientLineItems, clientPartners } from "@/db/schema";
import type { LineItemKind } from "@/db/schema";
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

/** Ordem fixa das 5 linhas da tabela no PDF: Descrição | Valor */
const SLOT_KINDS: LineItemKind[] = [
  "LLC",
  "Endereco",
  "Gateway",
  "ServicoAdicional",
  "BancoTradicional",
];

const SLOT_LABELS: string[] = [
  "LLC:",
  "Endereço:",
  "Gateway:",
  "Serviço Adicional:",
  "Banco Tradicional:",
];

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "src/assets/templates/pos-venda-llc-template.docx"
);

function roleToPapel(role: string): string {
  if (role === "SocioPrincipal") return "Sócio Principal";
  if (role === "Socio") return "Sócio";
  return role;
}

type LineItemRow = typeof clientLineItems.$inferSelect;

/** Remove do início do texto o rótulo da linha (ex.: "LLC:", "LLC,", "Endereco,") para não repetir no PDF. */
function stripLabelPrefix(label: string, text: string): string {
  const normalized = text.trim();
  if (!normalized) return normalized;
  const labelBase = label.replace(/:$/, "").trim(); // "LLC:" -> "LLC"
  
  // Abordagem mais agressiva: remove qualquer ocorrência do rótulo no início
  // até encontrar algo que não seja o rótulo seguido de separadores
  let result = normalized;
  
  // Pattern 1: "LLC" seguido de separadores (vírgula, espaço, dois pontos, etc.)
  const pattern1 = new RegExp(`^${escapeRe(labelBase)}[\\s,:·]+`, "i");
  // Pattern 2: "LLC" seguido imediatamente por outro "LLC" (sem separador explícito)
  const pattern2 = new RegExp(`^${escapeRe(labelBase)}(?=\\s*${escapeRe(labelBase)})`, "i");
  
  let prev = "";
  let iterations = 0;
  // Remove iterativamente até não conseguir mais
  while (result !== prev && iterations < 100) {
    prev = result;
    result = result.replace(pattern1, "").trim();
    result = result.replace(pattern2, "").trim();
    iterations++;
  }
  
  return result || normalized;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Retorna só o conteúdo da descrição (sem o rótulo), para o template usar "Rótulo: <<item_N_descricao>>" sem duplicar. */
function formatItemDescription(
  label: string,
  item: LineItemRow | null
): string {
  if (!item) return EMPTY;
  if (label === "Endereço:") {
    const parts: string[] = [];
    const provider = (item.addressProvider ?? "").trim();
    const skipProvider = /^endere[çc]o$/i.test(provider);
    if (provider && !skipProvider) parts.push(provider);
    if (item.addressLine1) parts.push(item.addressLine1);
    const main = parts.length ? parts.join(", ") : (item.description || EMPTY);
    const suffix = item.billingPeriod ? ` · ${item.billingPeriod}` : "";
    const raw = `${main}${suffix}`.trim();
    return stripLabelPrefix("Endereço", raw) || raw;
  }
  const desc = item.description?.trim() || EMPTY;
  return stripLabelPrefix(label, desc) || desc;
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

  const allItems = await db
    .select()
    .from(clientLineItems)
    .where(eq(clientLineItems.clientId, clientId));

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

  // Itens 1..5: slots fixos por tipo (LLC, Endereço, Gateway, Serviço Adicional, Banco Tradicional)
  for (let i = 0; i < 5; i++) {
    const kind = SLOT_KINDS[i];
    const label = SLOT_LABELS[i];
    const item = allItems.find((it) => it.kind === kind) ?? null;
    const n = i + 1;

    viewModel[`item_${n}_tipo`] = orEmpty(item?.kind);
    viewModel[`item_${n}_descricao`] = formatItemDescription(label, item);
    viewModel[`item_${n}_valor`] = item ? formatUsd(item.valueCents) : EMPTY;
    viewModel[`item_${n}_sale_date`] = item?.saleDate ? formatDate(item.saleDate) : EMPTY;
    viewModel[`item_${n}_comercial`] = orEmpty(item?.commercial);
    viewModel[`item_${n}_sdr`] = orEmpty(item?.sdr);
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
