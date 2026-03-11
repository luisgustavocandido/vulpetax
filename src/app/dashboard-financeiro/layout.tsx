import Link from "next/link";

export const dynamic = "force-dynamic";

export default function DashboardFinanceiroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/dashboard-financeiro"
            className="font-semibold text-slate-800"
          >
            Dashboard Financeira
          </Link>
          <form method="POST" action="/api/finance/logout" className="inline">
            <button
              type="submit"
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Sair
            </button>
          </form>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
