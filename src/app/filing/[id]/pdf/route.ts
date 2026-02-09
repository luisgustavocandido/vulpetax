import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, clients, llcs, taxFilings, relatedParties, reportableTransactions } from "@/db";
import { generateFilingPdf } from "@/lib/pdf-generator";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [filing] = await db.select().from(taxFilings).where(eq(taxFilings.id, id));
  if (!filing) notFound();

  const llcRow = filing.llcId
    ? (await db.select().from(llcs).where(eq(llcs.id, filing.llcId)))[0]
    : null;
  const clientRow = llcRow?.clientId
    ? (await db.select().from(clients).where(eq(clients.id, llcRow.clientId)))[0]
    : null;

  const relatedPartiesList = await db
    .select()
    .from(relatedParties)
    .where(eq(relatedParties.taxFilingId, id));

  const transactions = await db
    .select()
    .from(reportableTransactions)
    .where(eq(reportableTransactions.taxFilingId, id));

  const pdfBytes = await generateFilingPdf({
    filing,
    llc: llcRow ?? null,
    client: clientRow ?? null,
    relatedParties: relatedPartiesList,
    transactions,
  });

  const llcName = (llcRow?.name ?? "LLC").replace(/[^a-zA-Z0-9-_]/g, "_");
  const filename = `VulpeTax_Declaracao_${filing.taxYear}_${llcName}.pdf`;

  const buffer = Buffer.from(pdfBytes);
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBytes.length),
    },
  });
}
