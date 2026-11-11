"use client";

import React, { useRef, useEffect } from "react";
import Link from "next/link";
import { Bot, User as UserIcon, Lightbulb, RefreshCw, Send, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
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
    <Card className="flex flex-col h-[520px] overflow-hidden">
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
                "flex h-8 w-8 items-center justify-center rounded-full shrink-0 shadow-2xs",
                msg.sender === "AI"
                  ? "bg-primary text-primary-foreground"
                  : "bg-foreground text-background"
              )}
            >
              {msg.sender === "AI" ? (
                <Bot className="h-4 w-4" />
              ) : (
                <UserIcon className="h-4 w-4" />
              )}
            </div>

            {/* Bubble Content */}
            <div
              className={cn(
                "max-w-2xl space-y-2",
                msg.sender === "USER" ? "text-right" : "text-left"
              )}
            >
              {msg.sender === "USER" ? (
                <div className="inline-block bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl rounded-tr-xs text-xs font-medium shadow-2xs">
                  {msg.query}
                </div>
              ) : (
                <div className="bg-card border border-border rounded-2xl rounded-tl-xs p-4 shadow-2xs space-y-3">
                  {/* Live System Data Box */}
                  {msg.systemData && msg.systemData.length > 0 && (
                    <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Data Aktual Sistem ({outletName})
                      </p>
                      <ul className="text-xs text-foreground space-y-0.5 list-disc list-inside">
                        {msg.systemData.map((d, i) => (
                          <li key={i} className="font-medium">
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* AI Strategic Analysis */}
                  {msg.aiAnalysis && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                        <Lightbulb className="h-3.5 w-3.5" />
                        <span>Analisis & Rekomendasi AI</span>
                      </p>
                      <p className="text-xs text-foreground leading-relaxed font-normal">
                        {msg.aiAnalysis}
                      </p>
                    </div>
                  )}

                  {/* Suggested Action Link */}
                  {msg.actionRecommendation && (
                    <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground italic">
                        {msg.actionRecommendation}
                      </span>
                      {msg.actionLabel && msg.actionUrl && (
                        <Link
                          href={msg.actionUrl}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline shrink-0"
                        >
                          <span>{msg.actionLabel}</span>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground px-1 font-mono tabular-nums">
                {msg.timestamp}
              </p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pl-11">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
            <span>AI sedang menganalisis data riil gerai {outletName}...</span>
          </div>
        )}
      </CardContent>

      {/* Input Bar */}
      <div className="p-3 border-t border-border bg-card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <Input
            type="text"
            placeholder={`Tanyakan performa bisnis, stok kritis, atau omset di gerai ${outletName}...`}
            value={inputQuery}
            onChange={(e) => onInputChange(e.target.value)}
            className="flex-1 text-xs h-9"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!inputQuery.trim() || isTyping}
            className="gap-1.5 h-9 px-4"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Kirim</span>
          </Button>
        </form>
      </div>
    </Card>
  );
}
