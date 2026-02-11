"use client";

import Link from "next/link";

type PaginationProps = {
  page: number;
  total: number;
  limit: number;
  basePath: string;
  searchParams: Record<string, string>;
};

/**
 * Client: links com querystring para Anterior/Próximo.
 */
export function Pagination({
  page,
  total,
  limit,
  basePath,
  searchParams,
}: PaginationProps) {
  const totalPages = Math.ceil(total / limit) || 1;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const buildHref = (p: number) => {
    const params = new URLSearchParams({ ...searchParams, page: String(p) });
    return `${basePath}?${params.toString()}`;
  };

  if (totalPages <= 1) return null;

  return (
    <nav className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
      <div className="text-sm text-gray-600">
        Página {page} de {totalPages}
      </div>
      <div className="flex gap-2">
        {hasPrev ? (
          <Link
            href={buildHref(page - 1)}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Anterior
          </Link>
        ) : (
          <span className="rounded border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-400">
            Anterior
          </span>
        )}
        {hasNext ? (
          <Link
            href={buildHref(page + 1)}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Próximo
          </Link>
        ) : (
          <span className="rounded border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-400">
            Próximo
          </span>
        )}
      </div>
    </nav>
  );
}
