/**
 * Sessão exclusiva da Dashboard Financeira (CEO) — cookie separado do login principal.
 * Usa Web Crypto (Edge + Node). Senha validada no backend.
 */

const COOKIE_NAME = "finance_dashboard_session";
const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

type SessionPayload = {
  exp: number;
  actor: "finance_dashboard";
};

function getSecret(): string {
  const s = process.env.FINANCE_DASHBOARD_SECRET ?? process.env.PASSCODE;
  if (!s) {
    throw new Error("FINANCE_DASHBOARD_SECRET ou PASSCODE deve estar definido em .env");
  }
  return s;
}

function arrayBufferToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  if (!str?.trim()) return new Uint8Array(0);
  try {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    if (pad) base64 += "=".repeat(4 - pad);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return new Uint8Array(0);
  }
}

async function sign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  return arrayBufferToBase64url(sig);
}

function encodePayload(payload: SessionPayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodePayload(encoded: string): SessionPayload | null {
  try {
    if (!encoded?.trim()) return null;
    const bytes = base64urlDecode(encoded);
    if (bytes.length === 0) return null;
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (typeof parsed.exp !== "number" || parsed.actor !== "finance_dashboard") return null;
    return parsed as SessionPayload;
  } catch {
    return null;
  }
}

export async function createFinanceSessionValue(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    exp: now + SEVEN_DAYS_IN_SECONDS,
    actor: "finance_dashboard",
  };
  const encoded = encodePayload(payload);
  const signature = await sign(encoded, getSecret());
  return `${encoded}.${signature}`;
}

/** Valida a senha da dashboard financeira (apenas no servidor). */
export function validateFinancePassword(password: string): boolean {
  const expected = process.env.FINANCE_DASHBOARD_PASSWORD;
  if (!expected) return false;
  return password.trim() === expected;
}

export async function verifyFinanceSessionValue(
  value: string | undefined | null
): Promise<SessionPayload | null> {
  if (!value?.trim()) return null;
  const [encoded, signature] = value.split(".");
  if (!encoded?.trim() || !signature?.trim()) return null;
  const expectedSig = await sign(encoded, getSecret());
  if (signature.length !== expectedSig.length) return null;
  for (let i = 0; i < signature.length; i++) {
    if (signature[i] !== expectedSig[i]) return null;
  }
  const payload = decodePayload(encoded);
  if (!payload) return null;
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) return null;
  return payload;
}

export function getFinanceSessionCookieName(): string {
  return COOKIE_NAME;
}
