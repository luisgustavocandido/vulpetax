/**
 * Logger de segurança — eventos para auditoria e monitoramento.
 * Em produção, usa console em JSON.
 */

export type SecurityEventType =
  | "login_rate_limited"
  | "sync_manual_attempt"
  | "sync_failed"
  | "tax_remove"
  | "import_failed";

export type SecurityEvent = {
  type: SecurityEventType;
  ts: string;
  data: Record<string, unknown>;
};

function formatEvent(type: SecurityEventType, data: Record<string, unknown>): SecurityEvent {
  return {
    type,
    ts: new Date().toISOString(),
    data,
  };
}

export function logSecurityEvent(type: SecurityEventType, data: Record<string, unknown>): void {
  const event = formatEvent(type, data);
  const line = JSON.stringify(event);
  if (process.env.NODE_ENV === "production") {
    console.log(line);
  } else {
    console.warn("[SECURITY]", line);
  }
}
