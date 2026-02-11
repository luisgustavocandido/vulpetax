type BarItem = {
  label: string;
  count: number;
  totalCents: number;
};

type Props = {
  title: string;
  items: BarItem[];
  formatValue: (cents: number) => string;
  maxCount: number;
};

export function BarChart({ title, items, formatValue, maxCount }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">{title}</h3>
        <p className="text-sm text-gray-500">Nenhum dado</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-4 text-sm font-semibold text-gray-700">{title}</h3>
      <div className="space-y-3">
        {items.map((item) => {
          const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
          return (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-gray-700">{item.label}</span>
                <span className="text-gray-500">
                  {item.count} · {formatValue(item.totalCents)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
