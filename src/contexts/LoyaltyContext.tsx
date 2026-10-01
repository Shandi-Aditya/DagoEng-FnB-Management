"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { LoyaltyMember, LoyaltyTier, LoyaltyPointTransaction, LoyaltyTierChangeLog } from "@/types/loyalty";
import { useAuth } from "./AuthContext";
import { useOutlet } from "./OutletContext";
import { useSettings } from "./SettingsContext";
import { useActivityLog } from "./ActivityLogContext";
import { useNotifications } from "./NotificationContext";

export const INITIAL_MEMBERS: LoyaltyMember[] = [
  {
    id: "mem-001",
    name: "Ketut Dian",
    phone: "+62 819-1122-3344",
    email: "ketut.dian@gmail.com",
    identityNo: "NIK-510801990001",
    tier: "Silver",
    points: 840,
    totalSpend: 1420000,
    totalVisits: 18,
    favoriteItem: "Kopi Senja Aren",
    registeredOutletId: "outlet-sgr",
    registeredOutletName: "Singaraja",
    status: "ACTIVE",
    joinedDate: "12 Jan 2026",
    lastVisit: "16 Sep 2026",
    pointHistory: [
      {
        id: "ptx-1",
        memberId: "mem-001",
        type: "EARN",
        points: 40,
        balanceAfter: 840,
        reason: "Transaksi POS Meja T-03",
        relatedTransactionId: "ORD-20260914-0102",
        timestamp: "2026-09-14T10:40:00Z",
        actorName: "Ni Kadek Sri (Kasir)",
        outletId: "outlet-sgr",
      },
      {
        id: "ptx-2",
        memberId: "mem-001",
        type: "EARN",
        points: 800,
        balanceAfter: 800,
        reason: "Akumulasi Pembelanjaan F&B",
        timestamp: "2026-09-01T08:00:00Z",
        actorName: "Sistem Loyalty",
        outletId: "outlet-sgr",
      },
    ],
    tierHistory: [
      {
        id: "th-1",
        memberId: "mem-001",
        previousTier: "Bronze",
        newTier: "Silver",
        pointsAtChange: 500,
        reason: "Points mencapai 500 (Auto Tier Upgrade)",
        isManualOverride: false,
        actorName: "Sistem Loyalty",
        timestamp: "2026-08-20T14:30:00Z",
      },
    ],
  },
  {
    id: "mem-002",
    name: "Budi Santoso",
    phone: "+62 857-9988-7766",
    email: "budi.santoso@yahoo.com",
    identityNo: "NIK-510801990002",
    tier: "Bronze",
    points: 165,
    totalSpend: 280000,
    totalVisits: 4,
    favoriteItem: "Wagyu Beef Bowl",
    registeredOutletId: "outlet-sgr",
    registeredOutletName: "Singaraja",
    status: "ACTIVE",
    joinedDate: "05 Agu 2026",
    lastVisit: "14 Sep 2026",
    pointHistory: [
      {
        id: "ptx-3",
        memberId: "mem-002",
        type: "EARN",
        points: 165,
        balanceAfter: 165,
        reason: "Transaksi POS Meja T-01",
        relatedTransactionId: "ORD-20260914-0101",
        timestamp: "2026-09-14T10:30:00Z",
        actorName: "Ni Kadek Sri (Kasir)",
        outletId: "outlet-sgr",
      },
    ],
    tierHistory: [],
  },
  {
    id: "mem-003",
    name: "Ibu Maya Santika",
    phone: "+62 815-6677-8899",
    email: "maya.santika@corp.id",
    identityNo: "NIK-510801990003",
    tier: "Gold",
    points: 1850,
    totalSpend: 4600000,
    totalVisits: 26,
    favoriteItem: "Artisan Peach White Tea",
    registeredOutletId: "outlet-sgr",
    registeredOutletName: "Singaraja",
    status: "ACTIVE",
    joinedDate: "15 Mei 2026",
    lastVisit: "16 Sep 2026",
    pointHistory: [
      {
        id: "ptx-4",
        memberId: "mem-003",
        type: "EARN",
        points: 350,
        balanceAfter: 1850,
        reason: "Sewa Co-working Dedicated Desk 1 Bulan",
        timestamp: "2026-09-01T09:00:00Z",
        actorName: "Rian Hidayat (Manager Coworking)",
        outletId: "outlet-sgr",
      },
    ],
    tierHistory: [
      {
        id: "th-2",
        memberId: "mem-003",
        previousTier: "Silver",
        newTier: "Gold",
        pointsAtChange: 1500,
        reason: "Points mencapai 1.500 (Auto Tier Upgrade)",
        isManualOverride: false,
        actorName: "Sistem Loyalty",
        timestamp: "2026-08-10T11:00:00Z",
      },
    ],
  },
  {
    id: "mem-004",
    name: "Bpk. Hendra Wijaya",
    phone: "+62 811-2233-4455",
    email: "hendra.w@dagoeng.com",
    identityNo: "NIK-510801990004",
    tier: "Platinum",
    points: 3420,
    totalSpend: 9200000,
    totalVisits: 45,
    favoriteItem: "Signature Wagyu Beef Bowl",
    registeredOutletId: "outlet-sgr",
    registeredOutletName: "Singaraja",
    status: "ACTIVE",
    joinedDate: "01 Jan 2026",
    lastVisit: "17 Sep 2026",
    pointHistory: [],
    tierHistory: [
      {
        id: "th-3",
        memberId: "mem-004",
        previousTier: "Gold",
        newTier: "Platinum",
        pointsAtChange: 3000,
        reason: "Points mencapai 3.000 (Auto Tier Upgrade)",
        isManualOverride: false,
        actorName: "Sistem Loyalty",
        timestamp: "2026-07-15T15:00:00Z",
      },
    ],
  },
];

interface LoyaltyContextType {
  members: LoyaltyMember[];
  filteredMembers: LoyaltyMember[];
  calculateTierForPoints: (points: number) => LoyaltyTier;
  createMember: (memberData: { name: string; phone: string; email?: string; identityNo?: string; initialPoints?: number }) => LoyaltyMember;
  addPoints: (memberId: string, points: number, reason: string, transactionId?: string) => void;
  reverseTransactionPoints: (memberId: string, transactionId: string, reason?: string) => void;
  redeemPoints: (memberId: string, points: number, reason: string) => boolean;
  manualOverrideTier: (memberId: string, newTier: LoyaltyTier, reason: string) => void;
  resetLoyaltyData: () => void;
}

const LoyaltyContext = createContext<LoyaltyContextType | undefined>(undefined);
const STORAGE_KEY_LOYALTY = "dagoeng_loyalty_members_v1";

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

    return newMember;
  };

  const addPoints = (memberId: string, pointsEarned: number, reason: string, transactionId?: string) => {
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
      action: "EARN_POINTS",
      recordId: memberId,
      previousValue: `Poin: ${target.points}`,
      newValue: `Poin: ${newPoints} (+${pointsEarned})`,
      description: `Penambahan ${pointsEarned} poin untuk member ${target.name}`,
      reason,
      status: "SUCCESS",
      outletId: target.registeredOutletId,
      outletName: target.registeredOutletName,
    });
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
