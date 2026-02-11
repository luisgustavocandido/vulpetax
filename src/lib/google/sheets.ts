/**
 * Google Sheets client para leitura de planilhas via Service Account.
 * Compartilhe a planilha com o email da service account.
 */

import { google } from "googleapis";

function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normaliza header: trim, lowercase, remove acentos, espaços -> underscore.
 */
function normalizeHeader(header: string): string {
  const out = removeAccents(header)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return out || "_empty";
}

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY são obrigatórios");
  }
  const privateKey = key.replace(/\\n/g, "\n");
  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

export type SheetRowsResult = {
  headers: string[];
  rows: Record<string, string>[];
};

export type SheetConfig = {
  spreadsheetId?: string;
  gid?: string | number;
  sheetName?: string;
};

/**
 * Lê linhas de uma aba do Google Sheets.
 * Usa config quando fornecido, senão variáveis de ambiente (TAX default).
 */
export async function getSheetRows(config?: SheetConfig): Promise<SheetRowsResult> {
  const spreadsheetId =
    config?.spreadsheetId ?? process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const sheetIdStr =
    config?.gid != null ? String(config.gid) : process.env.GOOGLE_SHEETS_GID;
  const sheetName = config?.sheetName ?? process.env.GOOGLE_SHEETS_SHEET_NAME;

  if (!spreadsheetId) {
    throw new Error("spreadsheetId é obrigatório (env ou config)");
  }

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
  });

  const sheetsList = spreadsheet.data.sheets ?? [];
  let targetSheet: (typeof sheetsList)[number] | undefined;

  if (sheetIdStr) {
    const gid = parseInt(sheetIdStr, 10);
    if (!Number.isNaN(gid)) {
      targetSheet = sheetsList.find((s) => s.properties?.sheetId === gid);
    }
  }
  if (!targetSheet && sheetName) {
    targetSheet = sheetsList.find(
      (s) => s.properties?.title?.toLowerCase() === sheetName.toLowerCase()
    );
  }
  if (!targetSheet) {
    targetSheet = sheetsList[0];
  }
  if (!targetSheet?.properties?.title) {
    throw new Error("Nenhuma aba encontrada na planilha");
  }

  const range = `'${targetSheet.properties.title}'`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const values = (response.data.values ?? []) as string[][];
  if (values.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = values[0]!.map((h) => String(h ?? "").trim());
  const normalized = rawHeaders.map(normalizeHeader);
  const seen: Record<string, number> = {};
  const headers = normalized.map((h) => {
    seen[h] = (seen[h] ?? 0) + 1;
    return seen[h] > 1 ? `${h}_${seen[h]}` : h;
  });
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < values.length; i++) {
    const rawRow = values[i] ?? [];
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      const val = String(rawRow[j] ?? "").trim();
      const base = h.replace(/_\d+$/, "");
      if (!(base in row) || (val && !row[base]?.trim())) row[base] = val;
      row[h] = val;
    });
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Lê planilha Pós-Venda LLC usando env POSVENDA_SHEETS_*.
 */
export async function getPosVendaSheetRows(): Promise<SheetRowsResult> {
  const spreadsheetId = process.env.POSVENDA_SHEETS_SPREADSHEET_ID;
  const gid = process.env.POSVENDA_SHEETS_GID;
  const sheetName = process.env.POSVENDA_SHEETS_SHEET_NAME;
  if (!spreadsheetId) {
    throw new Error("POSVENDA_SHEETS_SPREADSHEET_ID é obrigatório");
  }
  return getSheetRows({ spreadsheetId, gid, sheetName });
}
