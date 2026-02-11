/**
 * Parse CSV com suporte a campos entre aspas.
 */

export function parseCsv(
  content: string,
  delimiter: string
): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (c === '"') {
        if (next === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      continue;
    }

    if (c === delimiter) {
      current.push(cell);
      cell = "";
      continue;
    }

    if (c === "\n" || (c === "\r" && next === "\n")) {
      if (c === "\r") i++;
      current.push(cell);
      rows.push(current);
      current = [];
      cell = "";
      continue;
    }

    if (c === "\r") {
      current.push(cell);
      rows.push(current);
      current = [];
      cell = "";
      continue;
    }

    cell += c;
  }

  if (cell !== "" || current.length > 0) {
    current.push(cell);
    rows.push(current);
  }
  return rows;
}
