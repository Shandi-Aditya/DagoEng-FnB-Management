"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { LoyaltyMember, LoyaltyTier, LoyaltyPointTransaction, LoyaltyTierChangeLog } from "@/types/loyalty";
import { useAuth } from "./AuthContext";
import { useOutlet } from "./OutletContext";
import { useSettings } from "./SettingsContext";
import { useActivityLog } from "./ActivityLogContext";
import { useNotifications } from "./NotificationContext";
import { syncWithOutbox } from "@/lib/sync-outbox";
import { INITIAL_MEMBERS, normalizeLoyaltyPhone } from "@/lib/master-data-defaults";
export { INITIAL_MEMBERS, normalizeLoyaltyPhone } from "@/lib/master-data-defaults";

interface LoyaltyContextType {
  members: LoyaltyMember[];
  filteredMembers: LoyaltyMember[];
  calculateTierForPoints: (points: number) => LoyaltyTier;
  createMember: (memberData: { name: string; phone: string; email?: string; identityNo?: string; initialPoints?: number }) => LoyaltyMember;
  getOrCreateMember: (memberData: { name: string; phone: string; email?: string; identityNo?: string; initialPoints?: number }) => LoyaltyMember;
  addPoints: (memberId: string, points: number, reason: string, transactionId?: string, spendAmount?: number) => void;
  reverseTransactionPoints: (memberId: string, transactionId: string, reason?: string) => void;
  redeemPoints: (memberId: string, points: number, reason: string) => boolean;
  manualOverrideTier: (memberId: string, newTier: LoyaltyTier, reason: string) => void;
  resetLoyaltyData: () => void;
}

const LoyaltyContext = createContext<LoyaltyContextType | undefined>(undefined);
const STORAGE_KEY_LOYALTY = "dagoeng_loyalty_members_v3";

export function LoyaltyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeOutletId, activeOutlet, isAllOutlets } = useOutlet();
  const { settings } = useSettings();
  const { logActivity } = useActivityLog();
  const { addNotification } = useNotifications();

  const [members, setMembers] = useState<LoyaltyMember[]>(INITIAL_MEMBERS);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LOYALTY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMembers(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load loyalty members", e);
    } finally {
      setIsInitialized(true);
    }

    // Hydrate authoritative loyalty members from server storage (V-06)
    if (typeof window !== "undefined") {
      fetch("/api/loyalty/members")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.members) && data.members.length > 0) {
            setMembers((prev) => {
              const serverMap = new Map(data.members.map((m: LoyaltyMember) => [m.id, m]));
              const localCustom = prev.filter((m) => !serverMap.has(m.id));
              return [...data.members, ...localCustom];
            });
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY_LOYALTY, JSON.stringify(members));
    } catch (e) {
      console.error("Failed to save loyalty members", e);
    }
  }, [members, isInitialized]);

  // Calculate Tier dynamically based on configurable point settings
  const calculateTierForPoints = (points: number): LoyaltyTier => {
    const config = settings.loyaltyTiers;
    if (points >= config.platinumMin) return "Platinum";
    if (points >= config.goldMin) return "Gold";
    if (points >= config.silverMin) return "Silver";
    return "Bronze";
  };

  const filteredMembers = members.filter((m) => {
    if (isAllOutlets) return true;
    return m.registeredOutletId === activeOutletId || !m.registeredOutletId;
  });

  // Create member: only identity input required. Default points = 0, Tier = Bronze (or auto calculated)
  const createMember = (memberData: {
    name: string;
    phone: string;
    email?: string;
    identityNo?: string;
    initialPoints?: number;
  }): LoyaltyMember => {
    // POS-09 / TC-D04: Deduplication guard preventing duplicate customer records
    const normPhone = normalizeLoyaltyPhone(memberData.phone);
    const existing = members.find((m) => {
      const mNorm = normalizeLoyaltyPhone(m.phone);
      return normPhone && mNorm && normPhone === mNorm;
    });

    if (existing) {
      return existing;
    }

    const nowIso = new Date().toISOString();
    const points = memberData.initialPoints || 0;
    const computedTier = calculateTierForPoints(points);

    const targetOutletId = activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr";
    const targetOutletName = activeOutlet?.name || "Singaraja";

    const newMember: LoyaltyMember = {
      id: `mem-${Date.now()}`,
      name: memberData.name.trim(),
      phone: memberData.phone.trim(),
      email: memberData.email?.trim() || undefined,
      identityNo: memberData.identityNo?.trim() || undefined,
      tier: computedTier,
      points,
      totalSpend: 0,
      totalVisits: 1,
      favoriteItem: "-",
      registeredOutletId: targetOutletId,
      registeredOutletName: targetOutletName,
      status: "ACTIVE",
      joinedDate: new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
      lastVisit: new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
      pointHistory: points > 0 ? [
        {
          id: `ptx-${Date.now()}`,
          memberId: `mem-${Date.now()}`,
          type: "EARN",
          points,
          balanceAfter: points,
          reason: "Poin Awal Pendaftaran Member",
          timestamp: nowIso,
          actorName: user?.name || "Kasir / Admin",
          outletId: targetOutletId,
        },
      ] : [],
      tierHistory: [],
    };

    setMembers((prev) => [newMember, ...prev]);

    logActivity({
      module: "LOYALTY",
      action: "CREATE_MEMBER",
      recordId: newMember.id,
      newValue: `${newMember.name} (Tier: ${newMember.tier}, ${newMember.points} Pts)`,
      description: `Registrasi member baru: ${newMember.name} (${newMember.phone})`,
      reason: "Member baru ditambahkan ke CRM",
      status: "SUCCESS",
      outletId: targetOutletId,
      outletName: targetOutletName,
    });

    syncWithOutbox({
      id: newMember.id,
      endpoint: "/api/loyalty/members",
      method: "POST",
      payload: { member: newMember },
    }).catch(() => {});

    return newMember;
  };

  const getOrCreateMember = (memberData: {
    name: string;
    phone: string;
    email?: string;
    identityNo?: string;
    initialPoints?: number;
  }): LoyaltyMember => {
    const normPhone = normalizeLoyaltyPhone(memberData.phone);
    const cleanEmail = memberData.email?.trim().toLowerCase();

    // Deduplication: Check if member already exists by phone or email
    const existing = members.find((m) => {
      const mPhone = normalizeLoyaltyPhone(m.phone);
      const mEmail = m.email?.trim().toLowerCase();
      if (normPhone && mPhone && normPhone === mPhone) return true;
      if (cleanEmail && mEmail && cleanEmail === mEmail) return true;
      return false;
    });

    if (existing) {
      return existing;
    }

    return createMember(memberData);
  };

  const addPoints = (
    memberId: string,
    pointsEarned: number,
    reason: string,
    transactionId?: string,
    spendAmount?: number
  ) => {
    const target = members.find((m) => m.id === memberId);
    if (!target || pointsEarned <= 0) return;

    // Idempotency: prevent double awarding for the same transaction
    if (
      transactionId &&
      target.pointHistory.some((ptx) => ptx.relatedTransactionId === transactionId)
    ) {
      console.warn(`[Loyalty] Points for transaction ${transactionId} already awarded to member ${memberId}. Skipping duplicate.`);
      return;
    }

    const newPoints = target.points + pointsEarned;
    const newTier = calculateTierForPoints(newPoints);
    const tierChanged = newTier !== target.tier;
    const nowIso = new Date().toISOString();
    const effectiveSpend =
      spendAmount !== undefined && spendAmount > 0
        ? Math.round(spendAmount)
        : pointsEarned * 1000;

    const ptx: LoyaltyPointTransaction = {
      id: `ptx-${Date.now()}`,
      memberId,
      type: "EARN",
      points: pointsEarned,
      balanceAfter: newPoints,
      reason,
      relatedTransactionId: transactionId,
      timestamp: nowIso,
      actorName: user?.name || "Kasir / Sistem",
      outletId: target.registeredOutletId,
    };

    let newTierHistory = [...target.tierHistory];
    if (tierChanged) {
      const th: LoyaltyTierChangeLog = {
        id: `th-${Date.now()}`,
        memberId,
        previousTier: target.tier,
        newTier,
        pointsAtChange: newPoints,
        reason: `Poin mencapai ${newPoints} (Auto Tier Upgrade)`,
        isManualOverride: false,
        actorName: "Sistem Loyalty",
        timestamp: nowIso,
      };
      newTierHistory = [th, ...newTierHistory];

      // Send system notification
      addNotification({
        type: "TIER_UPGRADE",
        title: "Kenaikan Loyalty Tier Member",
        detail: `Member ${target.name} otomatis naik dari tier ${target.tier} ke ${newTier} (${newPoints} Poin)!`,
        relatedModule: "LOYALTY",
        actionUrl: "/customers",
        outletId: target.registeredOutletId,
        outletName: target.registeredOutletName,
      });

      logActivity({
        module: "LOYALTY",
        action: "TIER_CHANGE_AUTO",
        recordId: memberId,
        previousValue: `Tier: ${target.tier} (${target.points} Pts)`,
        newValue: `Tier: ${newTier} (${newPoints} Pts)`,
        description: `Kenaikan tier loyalty otomatis: ${target.name} (${target.tier} ➔ ${newTier})`,
        reason: `Poin mencapai ${newPoints}`,
        status: "SUCCESS",
        outletId: target.registeredOutletId,
        outletName: target.registeredOutletName,
      });
    }

    // POS-08 / TC-D03: Atomically increment totalSpend, totalVisits, and lastVisit alongside points and tier
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              points: newPoints,
              tier: newTier,
              totalSpend: (m.totalSpend || 0) + effectiveSpend,
              totalVisits: (m.totalVisits || 0) + 1,
              lastVisit: new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
              pointHistory: [ptx, ...m.pointHistory],
              tierHistory: newTierHistory,
            }
          : m
      )
    );

    logActivity({
      module: "LOYALTY",
      action: "EARN_POINTS",
      recordId: memberId,
      previousValue: `Poin: ${target.points}`,
      newValue: `Poin: ${newPoints} (+${pointsEarned})`,
      description: `Penambahan ${pointsEarned} poin untuk member ${target.name}. Belanja: Rp ${effectiveSpend.toLocaleString("id-ID")}`,
      reason,
      status: "SUCCESS",
      outletId: target.registeredOutletId,
      outletName: target.registeredOutletName,
    });

    syncWithOutbox({
      id: memberId,
      endpoint: "/api/loyalty/members",
      method: "PUT",
      payload: {
        id: memberId,
        updates: {
          points: newPoints,
          tier: newTier,
          totalSpend: (target.totalSpend || 0) + effectiveSpend,
          totalVisits: (target.totalVisits || 0) + 1,
          lastVisit: new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
          pointHistory: [ptx, ...target.pointHistory],
          tierHistory: newTierHistory,
        },
      },
    }).catch(() => {});
  };

  const reverseTransactionPoints = (memberId: string, transactionId: string, reason?: string) => {
    const target = members.find((m) => m.id === memberId);
    if (!target) return;

    const earnTx = target.pointHistory.find(
      (ptx) => ptx.type === "EARN" && ptx.relatedTransactionId === transactionId
    );
    if (!earnTx) return;

    const revTxId = `rev-${transactionId}`;
    if (target.pointHistory.some((ptx) => ptx.relatedTransactionId === revTxId)) {
      return;
    }

    const pointsToDeduct = earnTx.points;
    const newPoints = Math.max(0, target.points - pointsToDeduct);
    const newTier = calculateTierForPoints(newPoints);
    const tierChanged = newTier !== target.tier;
    const nowIso = new Date().toISOString();

    const ptx: LoyaltyPointTransaction = {
      id: `ptx-${Date.now()}`,
      memberId,
      type: "ADJUSTMENT",
      points: -pointsToDeduct,
      balanceAfter: newPoints,
      reason: reason || `Pembatalan/Refund transaksi #${transactionId}`,
      relatedTransactionId: revTxId,
      timestamp: nowIso,
      actorName: user?.name || "Sistem Loyalty",
      outletId: target.registeredOutletId,
    };

    let newTierHistory = [...target.tierHistory];
    if (tierChanged) {
      const th: LoyaltyTierChangeLog = {
        id: `th-${Date.now()}`,
        memberId,
        previousTier: target.tier,
        newTier,
        pointsAtChange: newPoints,
        reason: `Poin disesuaikan menjadi ${newPoints} (Auto Tier Downgrade/Adjustment)`,
        isManualOverride: false,
        actorName: "Sistem Loyalty",
        timestamp: nowIso,
      };
      newTierHistory = [th, ...newTierHistory];
    }

    const refundedSpend = earnTx.points * 1000;

    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              points: newPoints,
              tier: newTier,
              totalSpend: Math.max(0, (m.totalSpend || 0) - refundedSpend),
              totalVisits: Math.max(0, (m.totalVisits || 0) - 1),
              pointHistory: [ptx, ...m.pointHistory],
              tierHistory: newTierHistory,
            }
          : m
      )
    );

    logActivity({
      module: "LOYALTY",
      action: "REVERSE_POINTS",
      recordId: memberId,
      previousValue: `Poin: ${target.points}`,
      newValue: `Poin: ${newPoints} (-${pointsToDeduct})`,
      description: `Penarikan kembali ${pointsToDeduct} poin transaksi ${transactionId} untuk member ${target.name}`,
      reason: reason || "Pembatalan / Refund Transaksi",
      status: "SUCCESS",
      outletId: target.registeredOutletId,
      outletName: target.registeredOutletName,
    });

    syncWithOutbox({
      id: memberId,
      endpoint: "/api/loyalty/members",
      method: "PUT",
      payload: {
        id: memberId,
        updates: {
          points: newPoints,
          tier: newTier,
          totalSpend: Math.max(0, (target.totalSpend || 0) - refundedSpend),
          totalVisits: Math.max(0, (target.totalVisits || 0) - 1),
          pointHistory: [ptx, ...target.pointHistory],
          tierHistory: newTierHistory,
        },
      },
    }).catch(() => {});
  };

  const redeemPoints = (memberId: string, pointsToRedeem: number, reason: string): boolean => {
    const target = members.find((m) => m.id === memberId);
    if (!target || target.points < pointsToRedeem) return false;

    const newPoints = target.points - pointsToRedeem;
    const newTier = calculateTierForPoints(newPoints);
    const tierChanged = newTier !== target.tier;
    const nowIso = new Date().toISOString();

    const ptx: LoyaltyPointTransaction = {
      id: `ptx-${Date.now()}`,
      memberId,
      type: "REDEEM",
      points: -pointsToRedeem,
      balanceAfter: newPoints,
      reason,
      timestamp: nowIso,
      actorName: user?.name || "Kasir POS",
      outletId: target.registeredOutletId,
    };

    let newTierHistory = [...target.tierHistory];
    if (tierChanged) {
      const th: LoyaltyTierChangeLog = {
        id: `th-${Date.now()}`,
        memberId,
        previousTier: target.tier,
        newTier,
        pointsAtChange: newPoints,
        reason: `Poin berkurang menjadi ${newPoints} setelah penukaran reward (Auto Tier Adjustment)`,
        isManualOverride: false,
        actorName: "Sistem Loyalty",
        timestamp: nowIso,
      };
      newTierHistory = [th, ...newTierHistory];
    }

    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              points: newPoints,
              tier: newTier,
              pointHistory: [ptx, ...m.pointHistory],
              tierHistory: newTierHistory,
            }
          : m
      )
    );

    logActivity({
      module: "LOYALTY",
      action: "REDEEM_POINTS",
      recordId: memberId,
      previousValue: `Poin: ${target.points}`,
      newValue: `Poin: ${newPoints} (-${pointsToRedeem})`,
      description: `Penukaran voucher ${pointsToRedeem} poin oleh ${target.name}`,
      reason,
      status: "SUCCESS",
      outletId: target.registeredOutletId,
      outletName: target.registeredOutletName,
    });

    syncWithOutbox({
      id: memberId,
      endpoint: "/api/loyalty/members",
      method: "PUT",
      payload: {
        id: memberId,
        updates: {
          points: newPoints,
          tier: newTier,
          pointHistory: [ptx, ...target.pointHistory],
          tierHistory: newTierHistory,
        },
      },
    }).catch(() => {});

    return true;
  };

  const manualOverrideTier = (memberId: string, newTier: LoyaltyTier, reason: string) => {
    const target = members.find((m) => m.id === memberId);
    if (!target) return;

    const nowIso = new Date().toISOString();
    const th: LoyaltyTierChangeLog = {
      id: `th-${Date.now()}`,
      memberId,
      previousTier: target.tier,
      newTier,
      pointsAtChange: target.points,
      reason: reason || "Manual override oleh Owner / Admin",
      isManualOverride: true,
      actorName: user?.name || "Owner Dago",
      timestamp: nowIso,
    };

    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              tier: newTier,
              tierHistory: [th, ...m.tierHistory],
            }
          : m
      )
    );

    logActivity({
      module: "LOYALTY",
      action: "MANUAL_TIER_OVERRIDE",
      recordId: memberId,
      previousValue: `Tier: ${target.tier}`,
      newValue: `Tier: ${newTier} (Manual Override)`,
      description: `Perubahan tier manual untuk ${target.name} (${target.tier} ➔ ${newTier})`,
      reason: reason || "Manual override oleh Owner/Admin",
      status: "SUCCESS",
      outletId: target.registeredOutletId,
      outletName: target.registeredOutletName,
    });

    syncWithOutbox({
      id: memberId,
      endpoint: "/api/loyalty/members",
      method: "PUT",
      payload: {
        id: memberId,
        updates: {
          tier: newTier,
          tierHistory: [th, ...target.tierHistory],
        },
      },
    }).catch(() => {});
  };

  const resetLoyaltyData = () => {
    setMembers(INITIAL_MEMBERS);
    try {
      localStorage.removeItem(STORAGE_KEY_LOYALTY);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <LoyaltyContext.Provider
      value={{
        members,
        filteredMembers,
        calculateTierForPoints,
        createMember,
        getOrCreateMember,
        addPoints,
        reverseTransactionPoints,
        redeemPoints,
        manualOverrideTier,
        resetLoyaltyData,
      }}
    >
      {children}
    </LoyaltyContext.Provider>
  );
}

export function useLoyalty() {
  const context = useContext(LoyaltyContext);
  if (!context) {
    throw new Error("useLoyalty must be used within a LoyaltyProvider");
  }
  return context;
}
