"use client";

import { Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useMarketStore } from "@/store/market-store";

interface SearchBoxProps {
  onSelect: (symbol: string) => void;
  placeholder?: string;
  exclude?: string[];
  /** Focus with the "/" key. */
  hotkey?: boolean;
  className?: string;
}

/** Combobox over the tracked universe. */
export function SearchBox({ onSelect, placeholder = "Search assets", exclude, hotkey, className }: SearchBoxProps) {
  const universe = useMarketStore((s) => s.universe);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo(() => {
    const q = query.trim().toUpperCase();
    const ex = new Set(exclude);
    return universe
      .filter((s) => !ex.has(s) && (q === "" || s.includes(q)))
      .sort((a, b) => Number(b.startsWith(q)) - Number(a.startsWith(q)))
      .slice(0, 8);
  }, [universe, query, exclude]);

  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key === "/" && el && !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey]);

  function choose(symbol: string) {
    onSelect(symbol);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const pick = results[active];
      if (pick) choose(pick);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-dim" aria-hidden />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        placeholder={hotkey ? `${placeholder}  (press /)` : placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        className="pl-8"
      />
      {open && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded border border-border bg-card py-1">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">{universe.length === 0 ? "Market data is still loading." : "No matching asset."}</li>
          ) : (
            results.map((s, i) => (
              <li
                key={s}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(s);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn("flex cursor-pointer items-center justify-between px-3 py-1.5", i === active && "bg-accent")}
              >
                <span className="font-medium">{s.replace(/USDT$/, "")}</span>
                <span className="text-xs text-dim">USDT</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
