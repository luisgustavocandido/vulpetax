type Props = {
  title: string;
  value: string | number;
  /** Delta MoM: number in -1..1 (e.g. 0.123 = +12.3%). If null, show "— vs mês anterior". */
  deltaPct: number | null;
  subtitle?: string;
};

function formatDelta(pct: number): string {
  const signed = pct >= 0 ? `+${(pct * 100).toFixed(1)}%` : `${(pct * 100).toFixed(1)}%`;
  return `${signed} vs mês anterior`;
}

export function KpiCardWithDelta({ title, value, deltaPct, subtitle }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {subtitle != null && subtitle !== "" && (
        <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>
      )}
      <p className="mt-1 text-xs text-gray-500">
        {deltaPct != null ? formatDelta(deltaPct) : "— vs mês anterior"}
      </p>
    </div>
  );
}
