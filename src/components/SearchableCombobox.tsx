"use client";

import { useState, useRef, useEffect, useMemo } from "react";

type SearchableComboboxProps = {
  value: string | null; // valor final exibido (quando não "Outro") OU null
  options: readonly string[]; // Lista de opções
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  searchPlaceholder?: string;
  alwaysShowOther?: boolean; // Se true, "Outro" sempre aparece no final mesmo com filtro
  otherOption?: string; // Nome da opção "Outro" (padrão: "Outro")
};

export function SearchableCombobox({
  value,
  options,
  onChange,
  placeholder = "Selecione…",
  disabled = false,
  error,
  searchPlaceholder = "Buscar…",
  alwaysShowOther = true,
  otherOption = "Outro",
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filtrar opções (exceto "Outro" que sempre aparece no final se alwaysShowOther = true)
  const filteredOptions = useMemo(() => {
    if (!alwaysShowOther) {
      // Se não precisa mostrar "Outro" sempre, apenas filtrar normalmente
      return query.trim()
        ? options.filter((opt) =>
            opt.toLowerCase().includes(query.toLowerCase())
          )
        : [...options];
    }

    const otherOptions = options.filter((opt) => opt !== otherOption);
    const filtered = query.trim()
      ? otherOptions.filter((opt) =>
          opt.toLowerCase().includes(query.toLowerCase())
        )
      : otherOptions;
    
    // "Outro" sempre no final, mesmo com filtro
    return [...filtered, otherOption];
  }, [options, query, alwaysShowOther, otherOption]);

  // Resetar índice destacado quando filtrar
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  // Fechar ao clicar fora
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

  // Scroll para item destacado
  useEffect(() => {
    if (open && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [highlightedIndex, open]);

  function handleSelect(selectedValue: string) {
    onChange(selectedValue);
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
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
    }
  }

  const displayValue = value && value.trim() ? value : "";

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
              placeholder={searchPlaceholder}
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div
            ref={listRef}
            className="max-h-48 overflow-y-auto py-1"
            role="listbox"
          >
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">
                Nenhum resultado
              </div>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = value === option;
                const isHighlighted = index === highlightedIndex;
                const isOtherOption = alwaysShowOther && option === otherOption;

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`block w-full px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? "bg-blue-50 font-medium text-blue-700"
                        : isHighlighted
                        ? "bg-gray-50"
                        : ""
                    } ${
                      isOtherOption ? "border-t border-gray-200 mt-1 pt-2" : ""
                    } hover:bg-blue-50`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    {option}
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
