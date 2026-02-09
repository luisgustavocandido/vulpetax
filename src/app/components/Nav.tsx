import Link from "next/link";

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-neutral-900">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 text-sm font-semibold text-white">
            V
          </span>
          <span className="text-base">VulpeTax</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/" className="btn btn-ghost px-3 py-2">
            Clientes
          </Link>
          <Link href="/client/new" className="btn btn-primary px-3 py-2">
            Novo cliente
          </Link>
          <Link href="/audit" className="btn btn-ghost px-3 py-2 text-sm">
            Audit
          </Link>
          <Link href="/login" className="btn btn-ghost px-3 py-2 text-sm">
            Entrar
          </Link>
        </div>
      </div>
    </nav>
  );
}
