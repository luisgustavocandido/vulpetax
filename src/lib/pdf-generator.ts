import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getOrderedTotals } from "./pdf-form-data";
import type { TaxFiling, LLC, Client, RelatedParty, ReportableTransaction } from "@/db";

type FilingData = {
  filing: TaxFiling;
  llc: LLC | null;
  client: Client | null;
  relatedParties: RelatedParty[];
  transactions: ReportableTransaction[];
};

const MARGIN = 50;
const LINE_HEIGHT = 14;
const SECTION_GAP = 20;

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function fmtNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtBool(b: boolean | null | undefined): string {
  if (b == null) return "—";
  return b ? "SIM" : "NÃO";
}

/** Gera PDF da declaração (pacote VulpeTax — Form 5472 / pro forma 1120). */
export async function generateFilingPdf(data: FilingData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612; // US Letter
  const pageHeight = 792;
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - MARGIN;

  function addPageIfNeeded(needed: number) {
    if (y - needed < MARGIN) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - MARGIN;
    }
  }

  function drawSectionTitle(title: string) {
    addPageIfNeeded(LINE_HEIGHT * 2);
    y -= LINE_HEIGHT;
    page.drawText(title, {
      x: MARGIN,
      y,
      size: 12,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= LINE_HEIGHT;
  }

  function drawLine(label: string, value: string) {
    addPageIfNeeded(LINE_HEIGHT);
    page.drawText(`${label}:`, {
      x: MARGIN,
      y,
      size: 10,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    });
    const maxLabelWidth = 220;
    page.drawText(value || "—", {
      x: MARGIN + maxLabelWidth,
      y,
      size: 10,
      font: font,
      color: rgb(0, 0, 0),
    });
    y -= LINE_HEIGHT;
  }

  const { filing, llc, client, relatedParties, transactions } = data;
  const llcName = llc?.name ?? "LLC";
  const taxYear = filing.taxYear;

  // Título
  addPageIfNeeded(LINE_HEIGHT * 4);
  page.drawText("VulpeTax — Pacote de Declaração", {
    x: MARGIN,
    y,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= LINE_HEIGHT;
  page.drawText(`Declaração ${taxYear} — ${llcName}`, {
    x: MARGIN,
    y,
    size: 12,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= LINE_HEIGHT * 2;

  // 1. DADOS DA LLC
  drawSectionTitle("1. DADOS DA LLC");
  if (llc) {
    drawLine("Nome da LLC", llc.name);
    drawLine("EIN", llc.ein);
    drawLine("Estado", llc.state);
    drawLine("Data de formação", fmtDate(llc.formationDate));
    drawLine("Atividade principal", llc.businessActivity ?? "");
    drawLine("Endereço linha 1", llc.addressLine1 ?? "");
    drawLine("Endereço linha 2", llc.addressLine2 ?? "");
    drawLine("Cidade, Estado, ZIP", [llc.city, llc.stateAddress, llc.zip].filter(Boolean).join(", "));
    drawLine("Custo de constituição (USD)", fmtNumber(llc.formationCostUsd));
  } else {
    drawLine("LLC", "—");
  }
  y -= SECTION_GAP;

  // 2. DADOS DO PROPRIETÁRIO
  drawSectionTitle("2. DADOS DO PROPRIETÁRIO");
  if (client) {
    drawLine("Nome completo", client.fullName);
    drawLine("E-mail", client.email);
    drawLine("Telefone", client.phone ?? "");
    drawLine("País de residência", client.country);
    drawLine("País de cidadania", client.citizenshipCountry ?? "");
    drawLine("Endereço particular diferente da LLC?", fmtBool(client.addressDifferentFromLLC));
    drawLine("Endereço particular", client.address ?? "");
    drawLine("TIN EUA (ITIN/SSN)", client.usTin ?? "");
    drawLine("CPF/TIN estrangeiro", client.foreignTin ?? "");
    drawLine("Tipo doc.", [client.idType, client.idNumber].filter(Boolean).join(": ") || "");
  } else {
    drawLine("Cliente", "—");
  }
  y -= SECTION_GAP;

  // 3. PARTES RELACIONADAS
  drawSectionTitle("3. PARTES RELACIONADAS (Form 5472)");
  if (relatedParties.length === 0) {
    drawLine("Nenhuma", "—");
  } else {
    for (const p of relatedParties) {
      drawLine(`• ${p.name}`, `${p.partyType} · ${p.country}`);
      drawLine("  Endereço", p.address ?? "");
      drawLine("  TIN/CPF", p.tin ?? "");
    }
  }
  y -= SECTION_GAP;

  // 4. SOBRE OS ATIVOS
  drawSectionTitle("4. SOBRE OS ATIVOS DA EMPRESA");
  drawLine("Ativos totais até 31/12 (USD)", fmtNumber(filing.totalAssetsYearEndUsd));
  drawLine("Contas bancárias nos EUA em nome da LLC?", fmtBool(filing.hasUsBankAccounts));
  drawLine("Saldo agregado > USD 10.000 (FBAR)?", fmtBool(filing.aggregateBalanceOver10k));
  y -= SECTION_GAP;

  // 5. TOTAIS (Reportable Transactions)
  drawSectionTitle("5. TOTAIS — TRANSAÇÕES REPORTÁVEIS (Form 5472)");
  const { rows, total } = getOrderedTotals(transactions);
  if (rows.length === 0) {
    drawLine("Sem transações", "0.00");
  } else {
    for (const r of rows) {
      drawLine(r.label, fmtNumber(r.amount));
    }
    addPageIfNeeded(LINE_HEIGHT);
    page.drawText("Total:", {
      x: MARGIN,
      y,
      size: 10,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    page.drawText(fmtNumber(total), {
      x: MARGIN + 220,
      y,
      size: 10,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    y -= LINE_HEIGHT;
  }
  y -= SECTION_GAP;

  // 6. DETALHES DAS TRANSAÇÕES
  if (transactions.length > 0) {
    drawSectionTitle("6. DETALHES DAS TRANSAÇÕES");
    const labels: Record<string, string> = {
      contribution: "Contribuição",
      distribution: "Distribuição",
      loan_from_owner: "Empréstimo do titular",
      loan_to_owner: "Empréstimo ao titular",
      payment_for_services: "Pagamento por serviços",
      sale_of_inventory: "Venda de estoque",
      sale_of_tangible_property: "Venda de propriedade tangível",
      personal_expenses_paid_by_llc: "Despesas pessoais pagas pela LLC",
      business_expenses_paid_personally: "Despesas empresariais pagas pessoalmente",
      other: "Outro",
    };
    for (const t of transactions) {
      addPageIfNeeded(LINE_HEIGHT * 2);
      const label = labels[t.transactionType] ?? t.transactionType;
      page.drawText(`• ${label} — ${fmtNumber(t.amountUsd)}`, {
        x: MARGIN,
        y,
        size: 10,
        font: font,
        color: rgb(0, 0, 0),
      });
      y -= LINE_HEIGHT;
      if (t.description) {
        page.drawText(`  ${t.description}`, {
          x: MARGIN + 10,
          y,
          size: 9,
          font: font,
          color: rgb(0.4, 0.4, 0.4),
        });
        y -= LINE_HEIGHT * 0.8;
      }
    }
    y -= SECTION_GAP;
  }

  // 7. DECLARAÇÃO
  drawSectionTitle("7. DECLARAÇÃO FINAL");
  if (filing.declarationAcceptedAt) {
    drawLine("Aceita em", fmtDate(filing.declarationAcceptedAt));
  } else {
    drawLine("Status", "Pendente de aceite");
  }

  doc.setTitle(`VulpeTax — Declaração ${taxYear} — ${llcName}`);
  doc.setAuthor("VulpeTax");

  return doc.save();
}
