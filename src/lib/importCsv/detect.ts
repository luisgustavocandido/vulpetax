/**
 * Detecta delimitador e encoding do CSV.
 * Retorna { delimiter, encoding }.
 */

const DELIMITERS = [",", ";", "\t"] as const;

function countDelimiter(line: string, delim: string): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (!inQuotes && c === delim) count++;
  }
  return count;
}

export function detectDelimiter(firstLines: string): "," | ";" | "\t" {
  const lines = firstLines.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return ",";

  let best: { delim: "," | ";" | "\t"; score: number } = { delim: ",", score: -1 };
  for (const d of DELIMITERS) {
    const counts = lines.slice(0, 5).map((l) => countDelimiter(l, d));
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const consistent = counts.every((c) => c === counts[0]);
    const score = consistent ? avg : avg * 0.5;
    if (score > best.score && avg > 0) {
      best = { delim: d, score };
    }
  }
  return best.delim;
}

/**
 * Detecta encoding. Buffer com BOM UTF-8 (EF BB BF) ou assume UTF-8.
 */
export function detectEncoding(buffer: Buffer): "utf-8" | "utf-8-bom" {
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return "utf-8-bom";
  }
  return "utf-8";
}
