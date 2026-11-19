"use client";

import React, { useState } from "react";
import { useOutlet } from "@/contexts/OutletContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOrders } from "@/contexts/OrderContext";
import { useInventory } from "@/contexts/InventoryContext";
import { useProducts } from "@/contexts/ProductContext";
import { useTables } from "@/contexts/TableContext";
import { useCoworking } from "@/contexts/CoworkingContext";
import { useCommercial } from "@/contexts/CommercialContext";
import { useLoyalty } from "@/contexts/LoyaltyContext";
import { useActivityLog } from "@/contexts/ActivityLogContext";
import {
  AIChatMessage,
  QUICK_PROMPTS,
  createWelcomeMessage,
  generateAIInsightResponse,
} from "@/features/ai-insight/ai-insight-domain";
import { AIInsightHeader } from "@/features/ai-insight/AIInsightHeader";
import { AIInsightQuickPrompts } from "@/features/ai-insight/AIInsightQuickPrompts";
import { AIInsightChatContainer } from "@/features/ai-insight/AIInsightChatContainer";
import { findTopProduct, isSettledPaidOrder } from "@/features/reports/reports-domain";

export default function AIInsightPage() {
  const { activeOutlet, activeOutletId } = useOutlet();
  const { user } = useAuth();
  const { orders } = useOrders();
  const { filteredIngredients } = useInventory();
  const { products } = useProducts();
  const { areas } = useTables();
  const { bookings } = useCoworking();
  const { filteredLeases } = useCommercial();
  const { members } = useLoyalty();
  const { logActivity } = useActivityLog();

  const [inputQuery, setInputQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Scoped Data calculations
  const scopedOrders = orders.filter(
    (o) => activeOutletId === "ALL" || o.outletId === activeOutletId || !o.outletId
  );
  const scopedMaterials = filteredIngredients;
  const scopedProducts = products.filter(
    (p) =>
      activeOutletId === "ALL" ||
      p.outletId === "ALL" ||
      p.outletId === activeOutletId ||
      !p.outletId
  );
  const scopedBookings = bookings.filter(
    (b: any) => activeOutletId === "ALL" || !b.outletId || b.outletId === activeOutletId
  );

  const paidScopedOrders = scopedOrders.filter(isSettledPaidOrder);
  const totalRev = paidScopedOrders.reduce((s, o) => s + o.total, 0);

  const criticalStockItems = scopedMaterials.filter((m) => m.stockNumber <= m.min);
  const outletName = activeOutlet?.name || "Semua outlet";

  const [messages, setMessages] = useState<AIChatMessage[]>([
    createWelcomeMessage({
      userName: user?.name || "Owner",
      outletName,
      totalRevenue: totalRev,
      ordersCount: paidScopedOrders.length,
      criticalItemsCount: criticalStockItems.length,
    }),
  ]);

  const handleSendMessage = (textToSend?: string) => {
    const q = textToSend || inputQuery;
    if (!q.trim()) return;

    const userMsg: AIChatMessage = {
      id: `user-${Date.now()}`,
      sender: "USER",
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      query: q.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputQuery("");
    setIsTyping(true);

    logActivity({
      module: "AI_INSIGHT",
      action: "AI_CONSULTATION",
      recordId: `ai-${Date.now()}`,
      newValue: q.trim(),
      description: `Konsultasi asisten data: "${q.trim().slice(0, 50)}"`,
      reason: "Permintaan analisis data operasional gerai",
      status: "SUCCESS",
      outletId: activeOutletId,
      outletName: activeOutlet?.name,
    });

    setTimeout(() => {
      const topMenu = findTopProduct(paidScopedOrders, scopedProducts);
      const aiResponse = generateAIInsightResponse({
        query: q,
        outletName,
        totalRevenue: totalRev,
        ordersCount: paidScopedOrders.length,
        materialsCount: scopedMaterials.length,
        criticalItems: criticalStockItems,
        topProductName: topMenu,
        areasCount: areas.length,
        bookingsCount: scopedBookings.length,
        leasesCount: filteredLeases.length,
        membersCount: members.length,
        productsCount: scopedProducts.length,
      });

      setMessages((prev) => [...prev, aiResponse]);
      setIsTyping(false);
    }, 600);
  };

  return (
    <div className="space-y-6">
      <AIInsightHeader outletName={outletName} />

      <AIInsightQuickPrompts prompts={QUICK_PROMPTS} onSelectPrompt={handleSendMessage} />

      <AIInsightChatContainer
        messages={messages}
        isTyping={isTyping}
        inputQuery={inputQuery}
        onInputChange={setInputQuery}
        onSendMessage={handleSendMessage}
        outletName={outletName}
      />
    </div>
  );
}
