/**
 * Metas de mix (Express / Holding / Anônimo) para o dashboard.
 * Valores em percentual 0–100. Podem ser movidos para tabela dashboard_mix_targets depois.
 */

export const MIX_TARGETS_PCT = {
  express: 20,
  holding: 10,
  anonymous: 5,
} as const;

export type MixKey = keyof typeof MIX_TARGETS_PCT;

export function getMixTargetPct(key: MixKey): number {
  return MIX_TARGETS_PCT[key];
}

/** Retorna se o valor atual está acima ou igual à meta. */
export function isMixAboveOrAtTarget(key: MixKey, actualPct: number): boolean {
  return actualPct >= getMixTargetPct(key);
}
