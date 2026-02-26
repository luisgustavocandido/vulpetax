"use client";

export type StageSummaryItem = {
  order: number;
  title: string;
  count: number;
};

type Props = {
  stageSummary: StageSummaryItem[];
  doneCount: number;
};

export default function StageSummaryCards({ stageSummary, doneCount }: Props) {
  if (stageSummary.length === 0 && doneCount === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {stageSummary.map((stage) => (
        <div
          key={stage.order}
          className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
        >
          <p className="line-clamp-2 text-xs font-medium text-slate-600">
            {stage.title}
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {stage.count} processo{stage.count !== 1 ? "s" : ""}
          </p>
        </div>
      ))}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 shadow-sm">
        <p className="text-xs font-medium text-emerald-700">Concluídos</p>
        <p className="mt-1 text-lg font-semibold text-emerald-900">
          {doneCount} processo{doneCount !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}
