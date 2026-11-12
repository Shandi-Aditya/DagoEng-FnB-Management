"use client";

export interface AIInsightQuickPromptsProps {
  prompts: string[];
  onSelectPrompt: (prompt: string) => void;
}

export function AIInsightQuickPrompts({
  prompts,
  onSelectPrompt,
}: AIInsightQuickPromptsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
      <span className="text-xs font-medium text-muted-foreground shrink-0">
        Pilihan pertanyaan
      </span>
      {prompts.map((prompt, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => onSelectPrompt(prompt)}
          className="shrink-0 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
