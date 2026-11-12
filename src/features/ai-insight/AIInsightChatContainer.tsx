"use client";

import React, { useRef, useEffect } from "react";
import Link from "next/link";
import { Bot, User as UserIcon, Lightbulb, RefreshCw, Send, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AIChatMessage } from "@/features/ai-insight/ai-insight-domain";
import { cn } from "@/lib/utils";

export interface AIInsightChatContainerProps {
  messages: AIChatMessage[];
  isTyping: boolean;
  inputQuery: string;
  onInputChange: (query: string) => void;
  onSendMessage: (query?: string) => void;
  outletName: string;
}

export function AIInsightChatContainer({
  messages,
  isTyping,
  inputQuery,
  onInputChange,
  onSendMessage,
  outletName,
}: AIInsightChatContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  return (
    <Card className="flex flex-col h-[560px] overflow-hidden">
      <CardContent ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-4 bg-muted/20">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex items-start gap-3",
              msg.sender === "USER" && "flex-row-reverse"
            )}
          >
            {/* Avatar Icon */}
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-full shrink-0 shadow-xs",
                msg.sender === "AI"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground border"
              )}
            >
              {msg.sender === "AI" ? (
                <Bot className="size-4" />
              ) : (
                <UserIcon className="size-4" />
              )}
            </div>

            {/* Bubble Content */}
            <div
              className={cn(
                "max-w-xl space-y-1.5",
                msg.sender === "USER" ? "text-right" : "text-left"
              )}
            >
              {msg.sender === "USER" ? (
                <div className="inline-block bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl rounded-tr-xs text-xs font-medium shadow-xs">
                  {msg.query}
                </div>
              ) : (
                <div className="bg-card border rounded-2xl rounded-tl-xs p-4 shadow-xs space-y-3">
                  {/* Live System Data Box */}
                  {msg.systemData && msg.systemData.length > 0 && (
                    <div className="rounded-lg border bg-muted/50 p-3 space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        Data sistem · {outletName}
                      </p>
                      <ul className="text-xs text-foreground space-y-1 list-disc list-inside">
                        {msg.systemData.map((d, i) => (
                          <li key={i}>
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* AI Strategic Analysis */}
                  {msg.aiAnalysis && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <Lightbulb className="size-3.5 text-muted-foreground" />
                        <span>Ringkasan dan saran</span>
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {msg.aiAnalysis}
                      </p>
                    </div>
                  )}

                  {/* Suggested Action Link */}
                  {msg.actionRecommendation && (
                    <div className="pt-2.5 border-t flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {msg.actionRecommendation}
                      </span>
                      {msg.actionLabel && msg.actionUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          render={<Link href={msg.actionUrl} />}
                          nativeButton={false}
                        >
                          <span>{msg.actionLabel}</span>
                          <ArrowUpRight />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground px-1 font-mono tabular-nums">
                {msg.timestamp}
              </p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pl-11">
            <RefreshCw className="size-3.5 animate-spin text-muted-foreground" />
            <span>Menghitung data {outletName}</span>
          </div>
        )}
      </CardContent>

      {/* Input Bar */}
      <div className="p-3 border-t bg-card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <Input
            type="text"
            placeholder="Tanya soal penjualan, stok, atau ruang kerja…"
            value={inputQuery}
            onChange={(e) => onInputChange(e.target.value)}
            className="flex-1 text-xs"
            aria-label="Pertanyaan analisis data"
          />
          <Button
            type="submit"
            size="default"
            disabled={!inputQuery.trim() || isTyping}
          >
            <Send />
            <span>Kirim</span>
          </Button>
        </form>
      </div>
    </Card>
  );
}
