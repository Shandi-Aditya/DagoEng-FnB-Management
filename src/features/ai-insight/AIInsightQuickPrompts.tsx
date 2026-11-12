"use client";

import React from "react";

export interface AIInsightQuickPromptsProps {
  prompts: string[];
  onSelectPrompt: (prompt: string) => void;
}

export function AIInsightQuickPrompts({
  prompts,
  onSelectPrompt,
}: AIInsightQuickPromptsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <span className="text-[11px] font-semibold text-muted-foreground shrink-0">
        Pilihan Cepat:
      </span>
      {prompts.map((prompt, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => onSelectPrompt(prompt)}
          className="text-xs px-3 py-1.5 rounded-full bg-card border border-border text-foreground hover:bg-muted hover:border-primary/40 transition-colors shrink-0 shadow-2xs font-medium cursor-pointer"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
