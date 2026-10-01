export type LoyaltyTier = "Bronze" | "Silver" | "Gold" | "Platinum";

export interface LoyaltyPointTransaction {
  id: string;
  memberId: string;
  type: "EARN" | "REDEEM" | "ADJUSTMENT";
  points: number; // positive for EARN/ADJUSTMENT+, negative for REDEEM
  balanceAfter: number;
  reason: string;
  relatedTransactionId?: string;
  timestamp: string;
  actorName: string;
  outletId: string;
}

export interface LoyaltyTierChangeLog {
  id: string;
  memberId: string;
  previousTier: LoyaltyTier;
  newTier: LoyaltyTier;
  pointsAtChange: number;
  reason: string;
  isManualOverride: boolean;
  actorName: string;
  timestamp: string;
}

export interface LoyaltyMember {
  id: string;
  name: string;
  phone: string;
  email?: string;
  identityNo?: string;
  tier: LoyaltyTier;
  points: number;
  totalSpend: number;
  totalVisits: number;
  favoriteItem: string;
  registeredOutletId: string;
  registeredOutletName: string;
  status: "ACTIVE" | "INACTIVE";
  joinedDate: string;
  lastVisit: string;
  pointHistory: LoyaltyPointTransaction[];
  tierHistory: LoyaltyTierChangeLog[];
}
