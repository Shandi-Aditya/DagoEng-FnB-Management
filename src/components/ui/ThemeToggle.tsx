"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
  variant?: "header" | "landing" | "compact" | "pill";
  showLabel?: boolean;
}

export function ThemeToggle({
  className = "",
  variant = "header",
  showLabel = false,
}: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  // Prevent hydration mismatch by rendering a stable placeholder until mounted
  if (!mounted) {
    return (
      <button
        type="button"
        className={`p-2 rounded-xl text-slate-400 bg-slate-100/50 dark:bg-slate-800/50 transition-colors opacity-70 ${className}`}
        aria-label="Ubah Tema Tampilan (Light/Dark)"
        disabled
      >
        <div className="w-4 h-4" />
      </button>
    );
  }

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57]/50 active:scale-95 shadow-xs ${
          isDark
            ? "bg-slate-900/90 text-amber-300 border-slate-700 hover:bg-slate-800 hover:text-amber-200 hover:border-slate-600"
            : "bg-white text-slate-800 border-slate-300 hover:bg-slate-100 hover:text-[#3B7A57] hover:border-slate-400"
        } ${className}`}
        aria-label={`Beralih ke mode ${isDark ? "terang" : "gelap"}`}
        title={`Tema saat ini: ${isDark ? "Gelap (Dark)" : "Terang (Light)"}. Klik untuk beralih.`}
      >
        {isDark ? (
          <Sun className="w-3.5 h-3.5 text-amber-400 animate-in spin-in-90 duration-300 flex-shrink-0" />
        ) : (
          <Moon className="w-3.5 h-3.5 text-[#3B7A57] animate-in spin-in-90 duration-300 flex-shrink-0" />
        )}
        <span className="text-[11px] font-bold">
          {isDark ? "Dark" : "Light"}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative p-2.5 rounded-xl border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7A57]/50 active:scale-95 group shadow-xs ${
        isDark
          ? "bg-slate-900/90 text-amber-300 border-slate-700 hover:bg-slate-800 hover:text-amber-200 hover:border-slate-600"
          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:text-[#3B7A57] hover:border-slate-400"
      } ${className}`}
      aria-label={`Beralih ke mode ${isDark ? "terang" : "gelap"}`}
      title={`Tema saat ini: ${isDark ? "Gelap (Dark)" : "Terang (Light)"}. Klik untuk beralih tema.`}
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 group-hover:rotate-45" />
        ) : (
          <Moon className="w-4 h-4 text-[#3B7A57] transition-transform duration-300 group-hover:-rotate-12" />
        )}
      </div>
      {showLabel && (
        <span className="ml-2 text-xs font-bold">
          {isDark ? "Light Mode" : "Dark Mode"}
        </span>
      )}
    </button>
  );
}
