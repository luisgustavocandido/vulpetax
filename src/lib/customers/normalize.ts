/**
 * Normaliza email para comparação e armazenamento (case-insensitive, trim).
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
