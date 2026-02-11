/**
 * Sessão por passcode — usa Web Crypto API (Edge + Node).
 */

const COOKIE_NAME = "vulpeinc_session";
const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

type SessionPayload = {
  exp: number; // epoch seconds
  actor: "internal";
};

/** Segredo atual para assinar novos cookies. Fallback: PASSCODE. */
function getSigningSecret(): string {
  const current = process.env.PASSCODE_CURRENT ?? process.env.PASSCODE;
  if (!current) {
    throw new Error("PASSCODE ou PASSCODE_CURRENT deve estar definido em .env");
  }
  return current;
}

/** Segredos válidos para validar cookie (current ou previous). */
function getValidationSecrets(): string[] {
  const current = process.env.PASSCODE_CURRENT ?? process.env.PASSCODE;
  const prev = process.env.PASSCODE_PREVIOUS;
  const out: string[] = [];
  if (current) out.push(current);
  if (prev && prev !== current) out.push(prev);
  return out;
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
  if (!str || str.trim() === "") {
    return new Uint8Array(0);
  }
  try {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    if (pad) base64 += "=".repeat(4 - pad);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return new Uint8Array(0);
  }
}

async function sign(data: string, secret?: string): Promise<string> {
  const s = secret ?? getSigningSecret();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(s),
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
    if (!encoded || encoded.trim() === "") {
      return null;
    }
    const bytes = base64urlDecode(encoded);
    if (bytes.length === 0) {
      return null;
    }
    const json = new TextDecoder().decode(bytes);
    if (!json || json.trim() === "") {
      return null;
    }
    const parsed = JSON.parse(json);
    if (typeof parsed.exp !== "number" || parsed.actor !== "internal") {
      return null;
    }
    return parsed as SessionPayload;
  } catch (error) {
    // Log error in development for debugging
    if (process.env.NODE_ENV === "development") {
      console.error("decodePayload error:", error);
    }
    return null;
  }
}

export async function createSessionValue(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    exp: now + SEVEN_DAYS_IN_SECONDS,
    actor: "internal",
  };
  const encoded = encodePayload(payload);
  const signature = await sign(encoded);
  return `${encoded}.${signature}`;
}

/**
 * Valida se o passcode informado está correto (CURRENT ou PREVIOUS).
 */
export function validatePasscode(passcode: string): boolean {
  const secrets = getValidationSecrets();
  return secrets.some((s) => passcode === s);
}

export async function verifySessionValue(
  value: string | undefined | null
): Promise<SessionPayload | null> {
  if (!value || value.trim() === "") return null;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature || encoded.trim() === "" || signature.trim() === "") return null;

  const secrets = getValidationSecrets();
  let valid = false;
  for (const secret of secrets) {
    const expected = await sign(encoded, secret);
    if (signature.length !== expected.length) continue;
    let match = true;
    for (let i = 0; i < signature.length; i++) {
      if (signature[i] !== expected[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      valid = true;
      break;
    }
  }
  if (!valid) return null;

  const payload = decodePayload(encoded);
  if (!payload) return null;

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) return null;

  return payload;
}

export function getSessionCookieName() {
  return COOKIE_NAME;
}
