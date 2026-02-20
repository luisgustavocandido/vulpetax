"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { US_STATES } from "@/constants/usStates";

type USStateComboboxProps = {
  value: string | null; // código do estado (ex.: "WY") ou null
  onChange: (code: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
};

export function USStateCombobox({
  value,
  onChange,
  placeholder = "Selecione o estado",
  disabled = false,
  error,
}: USStateComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedState = value ? US_STATES.find((s) => s.code === value) : null;
  const displayValue = selectedState ? `${selectedState.name} (${selectedState.code})` : "";

  // Filtrar estados por nome ou código
  const filteredStates = useMemo(() => {
    if (!query.trim()) return US_STATES;
    const q = query.toLowerCase();
    return US_STATES.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase() === q ||
        s.code.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [highlightedIndex, open]);

  function handleSelect(stateCode: string) {
    onChange(stateCode);
    setOpen(false);
    setQuery("");
    setHighlightedIndex(0);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;

    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setQuery("");
        setHighlightedIndex(0);
        break;
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredStates.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredStates.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (filteredStates[highlightedIndex]) {
          handleSelect(filteredStates[highlightedIndex].code);
        }
        break;
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
          error
            ? "border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500"
            : "border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        } ${
          disabled
            ? "cursor-not-allowed bg-gray-50 text-gray-500"
            : "bg-white hover:border-gray-400"
        }`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={!displayValue ? "text-gray-500" : ""}>
          {displayValue || placeholder}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar estado…"
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div
            ref={listRef}
            className="max-h-48 overflow-y-auto py-1"
            role="listbox"
          >
            {filteredStates.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">
                Nenhum resultado
              </div>
            ) : (
              filteredStates.map((state, index) => {
                const isSelected = value === state.code;
                const isHighlighted = index === highlightedIndex;

                return (
                  <button
                    key={state.code}
                    type="button"
                    onClick={() => handleSelect(state.code)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`block w-full px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? "bg-blue-50 font-medium text-blue-700"
                        : isHighlighted
                        ? "bg-gray-50"
                        : ""
                    } hover:bg-blue-50`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    {state.name} ({state.code})
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
