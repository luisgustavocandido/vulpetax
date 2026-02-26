type Props = {
  title: string;
  current: number;
  target: number | null;
  /** 0..1 progress. If null, show "Sem meta cadastrada". */
  progressPct: number | null;
  formatValue: (value: number) => string;
};

export function ProgressKpiCard({
  title,
  current,
  target,
  progressPct,
  formatValue,
}: Props) {
  const hasTarget = target != null && target > 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      {hasTarget ? (
        <>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {formatValue(current)} / {formatValue(target)}
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
              style={{
                width: `${Math.min(100, Math.max(0, (progressPct ?? 0) * 100))}%`,
              }}
            />
          </div>
          {progressPct != null && (
            <p className="mt-1 text-xs text-gray-500">
              {((progressPct ?? 0) * 100).toFixed(0)}% da meta
            </p>
          )}
        </>
      ) : (
        <p className="mt-1 text-lg font-medium text-gray-500">Sem meta cadastrada</p>
      )}
    </div>
  );
}
