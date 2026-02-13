"use client";

import { useState, useRef, useEffect } from "react";
import { UNIQUE_COUNTRY_CODES } from "@/lib/countryCodes";

type Props = {
  name: string;
  defaultValue?: string;
  required?: boolean;
  className?: string;
};

/**
 * Select de país para endereço. Armazena o nome do país (ex: "Brasil") como valor.
 */
export function CountrySelectForAddress({
  name,
  defaultValue = "",
  required = false,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => {
    const found = UNIQUE_COUNTRY_CODES.find(
      (c) => c.name === defaultValue || c.name.toLowerCase() === defaultValue?.toLowerCase()
    );
    return found ?? null;
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? UNIQUE_COUNTRY_CODES.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.code.includes(query.replace(/\D/g, ""))
      )
    : UNIQUE_COUNTRY_CODES;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(c: { code: string; name: string }) {
    setSelected(c);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input type="hidden" name={name} value={selected?.name ?? ""} />
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <span className={!selected?.name ? "text-gray-500" : ""}>
          {selected?.name ?? (required ? "Selecione o país" : "Selecione (opcional)")}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar país..."
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">Nenhum resultado</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.code + c.name}
                  type="button"
                  onClick={() => handleSelect(c)}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${
                    selected?.name === c.name ? "bg-blue-50 font-medium text-blue-700" : ""
                  }`}
                >
                  {c.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
