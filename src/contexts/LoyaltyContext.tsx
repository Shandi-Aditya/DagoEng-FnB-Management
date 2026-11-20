"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
export type { LoyaltyMember } from "@/types/loyalty";
import {
  type LoyaltyMember,
  LoyaltyTier,
  LoyaltyPointTransaction,
  LoyaltyTierChangeLog,
} from "@/types/loyalty";
import { useAuth } from "./AuthContext";
import { useOutlet } from "./OutletContext";
import { useSettings } from "./SettingsContext";
import { useActivityLog } from "./ActivityLogContext";
import { useNotifications } from "./NotificationContext";
import {
  ensureGlobalOutboxAutoFlush,
  flushOutbox,
  OUTBOX_FLUSHED_EVENT,
  reconcileCollectionWithOutbox,
  syncWithOutbox,
} from "@/lib/sync-outbox";
import { INITIAL_MEMBERS, normalizeLoyaltyPhone } from "@/lib/master-data-defaults";
import {
  maskCustomerPhone,
  maskCustomerEmail,
  canUserViewFullCustomerContacts,
  resolveAuthoritativeMemberTier,
  calculateTierFromPoints,
} from "@/features/customers/customers-domain";
export { INITIAL_MEMBERS, normalizeLoyaltyPhone } from "@/lib/master-data-defaults";

interface LoyaltyContextType {
  members: LoyaltyMember[];
  filteredMembers: LoyaltyMember[];
  calculateTierForPoints: (points: number) => LoyaltyTier;
  createMember: (memberData: {
    name: string;
    phone: string;
    email?: string;
    identityNo?: string;
    initialPoints?: number;
  }) => LoyaltyMember;
  getOrCreateMember: (memberData: {
    name: string;
    phone: string;
    email?: string;
    identityNo?: string;
    initialPoints?: number;
  }) => LoyaltyMember;
  updateMember: (id: string, updates: Partial<LoyaltyMember>) => void;
  deleteMember: (id: string) => void;
  addPoints: (
    memberId: string,
    points: number,
    reason: string,
    transactionId?: string,
    spendAmount?: number
  ) => void;
  reverseTransactionPoints: (
    memberId: string,
    transactionId: string,
    reason?: string,
    exactRefundAmount?: number
  ) => void;
  redeemPoints: (
    memberId: string,
    points: number,
    reason: string,
    relatedTransactionId?: string
  ) => boolean;
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
  const membersRef = useRef<LoyaltyMember[]>(INITIAL_MEMBERS);
  const syncChainRef = useRef<Map<string, Promise<void>>>(new Map());
  const [isInitialized, setIsInitialized] = useState(false);

  const commitMembers = (
    updater: (prev: LoyaltyMember[]) => LoyaltyMember[]
  ): LoyaltyMember[] => {
    const next = updater(membersRef.current);
    membersRef.current = next;
    setMembers(next);
    return next;
  };

  const enqueueMemberSync = (
    memberId: string,
    params: Parameters<typeof syncWithOutbox>[0]
  ) => {
    const prevChain = syncChainRef.current.get(memberId) || Promise.resolve();
    const nextChain = prevChain
      .then(() => syncWithOutbox(params).then(() => undefined))
      .catch(() => undefined);
    syncChainRef.current.set(memberId, nextChain);
  };

  const calculateTierForPoints = (points: number): LoyaltyTier => {
    const config = settings.loyaltyTiers;
    if (points >= config.platinumMin) return "Platinum";
    if (points >= config.goldMin) return "Gold";
    if (points >= config.silverMin) return "Silver";
    return "Bronze";
  };

  const normalizeLoadedMembers = (list: LoyaltyMember[]): LoyaltyMember[] => {
    const roleSlug = user?.role?.slug;
    const canView = canUserViewFullCustomerContacts(roleSlug);
    const sessionEmail = user?.email?.toLowerCase().trim();
    const isCustomer = roleSlug === "CUSTOMER";
    return list.map((m) => {
      const tier = resolveAuthoritativeMemberTier(m, settings.loyaltyTiers);
      if (canView) {
        return { ...m, tier };
      }
      const isOwnCustomerRecord =
        isCustomer &&
        Boolean(sessionEmail) &&
        Boolean(m.email && m.email.toLowerCase().trim() === sessionEmail);
      if (isOwnCustomerRecord) {
        return {
          ...m,
          tier,
          identityNo: "",
        };
      }
      return {
        ...m,
        tier,
        phone: maskCustomerPhone(m.phone),
        email: maskCustomerEmail(m.email),
        identityNo: "",
      };
    });
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LOYALTY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const sanitized = normalizeLoadedMembers(parsed);
          membersRef.current = sanitized;
          setMembers(sanitized);
        }
      }
    } catch (e) {
      console.error("Failed to load loyalty members", e);
    } finally {
      setIsInitialized(true);
    }
    ensureGlobalOutboxAutoFlush();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    commitMembers((prev) => normalizeLoadedMembers(prev));

    const hydrateMembers = async () => {
      await flushOutbox().catch(() => {});
      if (cancelled) return;
      try {
        const res = await fetch("/api/loyalty/members");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data && Array.isArray(data.members) && !cancelled) {
          commitMembers((prev) =>
            normalizeLoadedMembers(
              reconcileCollectionWithOutbox<LoyaltyMember>({
                serverItems: data.members,
                localItems: prev,
                endpoint: "/api/loyalty/members",
                getId: (m) => m.id,
              })
            )
          );
        }
      } catch {
        if (!cancelled) {
          commitMembers((prev) => normalizeLoadedMembers(prev));
        }
      }
    };

    void hydrateMembers();

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY_LOYALTY) return;
      if (event.newValue === null) {
        const normalizedDefaults = normalizeLoadedMembers(INITIAL_MEMBERS);
        membersRef.current = normalizedDefaults;
        setMembers(normalizedDefaults);
        return;
      }
      try {
        const parsed = JSON.parse(event.newValue);
        if (Array.isArray(parsed)) {
          const normalized = normalizeLoadedMembers(parsed);
          membersRef.current = normalized;
          setMembers(normalized);
        }
      } catch (e) {
        console.error("Failed to sync loyalty storage update", e);
      }
    };

    const handleOutboxFlushed = () => {
      void hydrateMembers();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(OUTBOX_FLUSHED_EVENT, handleOutboxFlushed);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(OUTBOX_FLUSHED_EVENT, handleOutboxFlushed);
    };
  }, [user?.id, user?.role?.slug, user?.email, settings.loyaltyTiers]);

  useEffect(() => {
    if (!isInitialized) return;
    if (!canUserViewFullCustomerContacts(user?.role?.slug)) {
      try {
        localStorage.removeItem(STORAGE_KEY_LOYALTY);
      } catch {}
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY_LOYALTY, JSON.stringify(members));
    } catch (e) {
      console.error("Failed to save loyalty members", e);
    }
  }, [members, isInitialized, user?.role?.slug]);

  const filteredMembers = members.filter((m) => {
    if (isAllOutlets) return true;
    return m.registeredOutletId === activeOutletId || !m.registeredOutletId;
  });

  const createMember = (memberData: {
    name: string;
    phone: string;
    email?: string;
    identityNo?: string;
    initialPoints?: number;
  }): LoyaltyMember => {
    const normPhone = normalizeLoyaltyPhone(memberData.phone);
    const existing = membersRef.current.find((m) => {
      const mNorm = normalizeLoyaltyPhone(m.phone);
      return normPhone && mNorm && normPhone === mNorm;
    });

    if (existing) {
      return existing;
    }

    const nowIso = new Date().toISOString();
    const newId = `mem-${Date.now()}`;
    const points = memberData.initialPoints || 0;
    const computedTier = calculateTierForPoints(points);

    const targetOutletId = activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr";
    const targetOutletName = activeOutlet?.name || "Singaraja";

    const newMember: LoyaltyMember = {
      id: newId,
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
      joinedDate: new Date().toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      lastVisit: new Date().toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      pointHistory:
        points > 0
          ? [
              {
                id: `ptx-${Date.now()}`,
                memberId: newId,
                type: "EARN",
                points,
                balanceAfter: points,
                reason: "Poin Awal Pendaftaran Member",
                timestamp: nowIso,
                actorName: user?.name || "Kasir / Admin",
                outletId: targetOutletId,
              },
            ]
          : [],
      tierHistory: [],
    };

    commitMembers((prev) => [newMember, ...prev]);

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

    enqueueMemberSync(newMember.id, {
      id: newMember.id,
      endpoint: "/api/loyalty/members",
      method: "POST",
      isCreate: true,
      payload: { id: newMember.id, member: newMember },
    });

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

    const existing = membersRef.current.find((m) => {
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

  const updateMember = (id: string, updates: Partial<LoyaltyMember>) => {
    const target = membersRef.current.find((m) => m.id === id);
    if (!target) return;

    const nextPoints = updates.points !== undefined ? updates.points : target.points;
    const historyToCheck = updates.tierHistory ?? target.tierHistory;
    const isManualOverride = historyToCheck?.[0]?.isManualOverride === true;
    const nextTier =
      updates.tier !== undefined
        ? updates.tier
        : isManualOverride
        ? target.tier
        : calculateTierForPoints(nextPoints);

    const mergedUpdates: Partial<LoyaltyMember> = {
      ...updates,
      points: nextPoints,
      tier: nextTier,
    };

    commitMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...mergedUpdates, id } : m))
    );

    logActivity({
      module: "LOYALTY",
      action: "UPDATE_MEMBER",
      recordId: id,
      previousValue: `${target.name} (${target.phone})`,
      newValue: `${mergedUpdates.name || target.name} (${mergedUpdates.phone || target.phone})`,
      description: `Pembaruan data member loyalty: ${mergedUpdates.name || target.name}`,
      reason: "Pembaruan profil member CRM",
      status: "SUCCESS",
      outletId: target.registeredOutletId,
      outletName: target.registeredOutletName,
    });

    enqueueMemberSync(id, {
      id,
      endpoint: "/api/loyalty/members",
      method: "PUT",
      payload: { id, updates: mergedUpdates },
    });
  };

  const deleteMember = (id: string) => {
    const target = membersRef.current.find((m) => m.id === id);
    if (!target) return;

    commitMembers((prev) => prev.filter((m) => m.id !== id));

    logActivity({
      module: "LOYALTY",
      action: "DELETE_MEMBER",
      recordId: id,
      previousValue: `${target.name} (${target.phone})`,
      newValue: "DELETED",
      description: `Penghapusan member loyalty: ${target.name} (${target.phone})`,
      reason: "Data member dihapus dari CRM",
      status: "SUCCESS",
      outletId: target.registeredOutletId,
      outletName: target.registeredOutletName,
    });

    enqueueMemberSync(id, {
      id,
      endpoint: "/api/loyalty/members",
      method: "DELETE",
      payload: { id },
    });
  };

  const addPoints = (
    memberId: string,
    pointsEarned: number,
    reason: string,
    transactionId?: string,
    spendAmount?: number
  ) => {
    const target = membersRef.current.find((m) => m.id === memberId);
    if (!target || pointsEarned < 0) return;

    const hasSpendUpdate =
      Boolean(transactionId) && spendAmount !== undefined && spendAmount >= 0;
    if (pointsEarned === 0 && !hasSpendUpdate) return;

    if (
      transactionId &&
      target.pointHistory.some(
        (ptx) => ptx.type === "EARN" && ptx.relatedTransactionId === transactionId
      )
    ) {
      console.warn(
        `[Loyalty] Points for transaction ${transactionId} already awarded to member ${memberId}. Skipping duplicate.`
      );
      return;
    }

    const newPoints = target.points + pointsEarned;
    const newTier = calculateTierForPoints(newPoints);
    const tierChanged = newTier !== target.tier;
    const nowIso = new Date().toISOString();
    const effectiveSpend =
      spendAmount !== undefined && spendAmount >= 0
        ? Math.round(spendAmount)
        : pointsEarned * 1000;
    const lastVisitStr = new Date().toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const ptx: LoyaltyPointTransaction = {
      id: `ptx-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      memberId,
      type: "EARN",
      points: pointsEarned,
      spendAmount: effectiveSpend,
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

      addNotification({
        type: "TIER_UPGRADE",
        title: "Kenaikan Loyalty Tier Member",
        detail: `Member ${target.name} otomatis naik dari tier ${target.tier} ke ${newTier} (${newPoints} Poin)`,
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
        description: `Kenaikan tier loyalty otomatis: ${target.name} (${target.tier} ke ${newTier})`,
        reason: `Poin mencapai ${newPoints}`,
        status: "SUCCESS",
        outletId: target.registeredOutletId,
        outletName: target.registeredOutletName,
      });
    }

    const updatedPointHistory = [ptx, ...target.pointHistory];
    const nextSpend = (target.totalSpend || 0) + effectiveSpend;
    const nextVisits = (target.totalVisits || 0) + 1;

    commitMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              points: newPoints,
              tier: newTier,
              totalSpend: nextSpend,
              totalVisits: nextVisits,
              lastVisit: lastVisitStr,
              pointHistory: updatedPointHistory,
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

    enqueueMemberSync(memberId, {
      id: memberId,
      endpoint: "/api/loyalty/members",
      method: "PUT",
      payload: {
        id: memberId,
        updates: {
          points: newPoints,
          tier: newTier,
          totalSpend: nextSpend,
          totalVisits: nextVisits,
          lastVisit: lastVisitStr,
          pointHistory: updatedPointHistory,
          tierHistory: newTierHistory,
        },
      },
    });
  };

  const reverseTransactionPoints = (
    memberId: string,
    transactionId: string,
    reason?: string,
    exactRefundAmount?: number
  ) => {
    const target = membersRef.current.find((m) => m.id === memberId);
    if (!target) return;

    const earnTx = target.pointHistory.find(
      (ptx) => ptx.type === "EARN" && ptx.relatedTransactionId === transactionId
    );
    const redeemTx = target.pointHistory.find(
      (ptx) => ptx.type === "REDEEM" && ptx.relatedTransactionId === transactionId
    );

    const revTxId = `rev-${transactionId}`;
    const revRedeemTxId = `rev-redeem-${transactionId}`;
    const alreadyReversedEarn = target.pointHistory.some(
      (ptx) => ptx.relatedTransactionId === revTxId
    );
    const alreadyReversedRedeem = target.pointHistory.some(
      (ptx) => ptx.relatedTransactionId === revRedeemTxId
    );

    const canReverseEarn = Boolean(earnTx && !alreadyReversedEarn);
    const canReverseRedeem = Boolean(redeemTx && !alreadyReversedRedeem);
    if (!canReverseEarn && !canReverseRedeem) return;

    const pointsToDeduct = canReverseEarn && earnTx ? earnTx.points : 0;
    const pointsToRestore = canReverseRedeem && redeemTx ? Math.abs(redeemTx.points) : 0;
    const newPoints = Math.max(0, target.points - pointsToDeduct + pointsToRestore);
    const newTier = calculateTierForPoints(newPoints);
    const tierChanged = newTier !== target.tier;
    const nowIso = new Date().toISOString();

    const appendedEntries: LoyaltyPointTransaction[] = [];
    if (canReverseRedeem && redeemTx) {
      appendedEntries.push({
        id: `ptx-${Date.now()}-redeem-rev`,
        memberId,
        type: "ADJUSTMENT",
        points: pointsToRestore,
        balanceAfter: newPoints,
        reason: reason || `Pengembalian poin voucher transaksi #${transactionId}`,
        relatedTransactionId: revRedeemTxId,
        timestamp: nowIso,
        actorName: user?.name || "Sistem Loyalty",
        outletId: target.registeredOutletId,
      });
    }
    if (canReverseEarn && earnTx) {
      appendedEntries.push({
        id: `ptx-${Date.now()}-earn-rev`,
        memberId,
        type: "ADJUSTMENT",
        points: -pointsToDeduct,
        balanceAfter: newPoints,
        reason: reason || `Pembatalan/Refund transaksi #${transactionId}`,
        relatedTransactionId: revTxId,
        timestamp: nowIso,
        actorName: user?.name || "Sistem Loyalty",
        outletId: target.registeredOutletId,
      });
    }

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

    const refundedSpend = canReverseEarn
      ? exactRefundAmount ?? earnTx?.spendAmount ?? (earnTx ? earnTx.points * 1000 : 0)
      : 0;
    const nextSpend = Math.max(0, (target.totalSpend || 0) - refundedSpend);
    const nextVisits = Math.max(0, (target.totalVisits || 0) - (canReverseEarn ? 1 : 0));
    const updatedPointHistory = [...appendedEntries, ...target.pointHistory];

    commitMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              points: newPoints,
              tier: newTier,
              totalSpend: nextSpend,
              totalVisits: nextVisits,
              pointHistory: updatedPointHistory,
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
      newValue: `Poin: ${newPoints} (${pointsToRestore - pointsToDeduct >= 0 ? "+" : ""}${pointsToRestore - pointsToDeduct})`,
      description: `Penarikan/penyesuaian poin transaksi ${transactionId} untuk member ${target.name}`,
      reason: reason || "Pembatalan / Refund Transaksi",
      status: "SUCCESS",
      outletId: target.registeredOutletId,
      outletName: target.registeredOutletName,
    });

    enqueueMemberSync(memberId, {
      id: memberId,
      endpoint: "/api/loyalty/members",
      method: "PUT",
      payload: {
        id: memberId,
        updates: {
          points: newPoints,
          tier: newTier,
          totalSpend: nextSpend,
          totalVisits: nextVisits,
          pointHistory: updatedPointHistory,
          tierHistory: newTierHistory,
        },
      },
    });
  };

  const redeemPoints = (
    memberId: string,
    pointsToRedeem: number,
    reason: string,
    relatedTransactionId?: string
  ): boolean => {
    const target = membersRef.current.find((m) => m.id === memberId);
    if (!target || pointsToRedeem <= 0 || target.points < pointsToRedeem) return false;

    const newPoints = target.points - pointsToRedeem;
    const newTier = calculateTierForPoints(newPoints);
    const tierChanged = newTier !== target.tier;
    const nowIso = new Date().toISOString();

    const ptx: LoyaltyPointTransaction = {
      id: `ptx-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      memberId,
      type: "REDEEM",
      points: -pointsToRedeem,
      balanceAfter: newPoints,
      reason,
      relatedTransactionId,
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

    const updatedPointHistory = [ptx, ...target.pointHistory];

    commitMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              points: newPoints,
              tier: newTier,
              pointHistory: updatedPointHistory,
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

    enqueueMemberSync(memberId, {
      id: memberId,
      endpoint: "/api/loyalty/members",
      method: "PUT",
      payload: {
        id: memberId,
        updates: {
          points: newPoints,
          tier: newTier,
          pointHistory: updatedPointHistory,
          tierHistory: newTierHistory,
        },
      },
    });

    return true;
  };

  const manualOverrideTier = (memberId: string, newTier: LoyaltyTier, reason: string) => {
    const target = membersRef.current.find((m) => m.id === memberId);
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

    const updatedTierHistory = [th, ...target.tierHistory];

    commitMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              tier: newTier,
              tierHistory: updatedTierHistory,
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
      description: `Perubahan tier manual untuk ${target.name} (${target.tier} ke ${newTier})`,
      reason: reason || "Manual override oleh Owner/Admin",
      status: "SUCCESS",
      outletId: target.registeredOutletId,
      outletName: target.registeredOutletName,
    });

    enqueueMemberSync(memberId, {
      id: memberId,
      endpoint: "/api/loyalty/members",
      method: "PUT",
      payload: {
        id: memberId,
        updates: {
          tier: newTier,
          tierHistory: updatedTierHistory,
        },
      },
    });
  };

  const resetLoyaltyData = () => {
    const normalizedDefaults = normalizeLoadedMembers(INITIAL_MEMBERS);
    membersRef.current = normalizedDefaults;
    setMembers(normalizedDefaults);
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
        updateMember,
        deleteMember,
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
