import { describe, it, expect } from "vitest";
import {
  getTenantPayoutAccount,
  maskAccountNumber,
  DEFAULT_TENANT_PAYOUT_ACCOUNTS,
} from "../src/lib/settlement";

describe("Tenant Bank Account & Payout Isolation Tests", () => {
  it("1. Should resolve default payout accounts for each of the 4 official partners", () => {
    const ks = getTenantPayoutAccount("tenant-ks");
    expect(ks.bankName).toBe("BCA");
    expect(ks.accountNumber).toBe("8830192841");
    expect(ks.accountHolder).toBe("Kopi Senja Utama");
    expect(ks.isConfigured).toBe(true);

    const kitchen = getTenantPayoutAccount("tenant-kitchen");
    expect(kitchen.bankName).toBe("Mandiri");
    expect(kitchen.accountNumber).toBe("1420019283741");
    expect(kitchen.accountHolder).toBe("Dapur Mama Kuliner");
    expect(kitchen.isConfigured).toBe(true);

    const bakery = getTenantPayoutAccount("tenant-bakery");
    expect(bakery.bankName).toBe("BCA");
    expect(bakery.accountNumber).toBe("7720194821");

    const tea = getTenantPayoutAccount("tenant-tea");
    expect(tea.bankName).toBe("BRI");
    expect(tea.accountNumber).toBe("002101928374501");
  });

  it("2. Should mask account numbers properly for operational display", () => {
    expect(maskAccountNumber("8830192841")).toBe("•••• •••• 2841");
    expect(maskAccountNumber("1420019283741")).toBe("•••• •••• 3741");
    expect(maskAccountNumber("1234")).toBe("1234");
    expect(maskAccountNumber("")).toBe("-");
  });

  it("3. Should enforce strict tenant isolation when reading/saving custom accounts", () => {
    const customTenantMap: Record<string, any> = {
      "tenant-ks": {
        bankName: "BCA",
        bankAccountNumber: "9900112233",
        bankAccountHolder: "Kopi Senja New Account",
      },
      "tenant-kitchen": {
        bankName: "Mandiri",
        bankAccountNumber: "5544332211",
        bankAccountHolder: "Dapur Mama Official",
      },
    };

    // Kopi Senja reads its custom account
    const ksResult = getTenantPayoutAccount("tenant-ks", customTenantMap);
    expect(ksResult.accountNumber).toBe("9900112233");
    expect(ksResult.accountHolder).toBe("Kopi Senja New Account");

    // Dapur Mama reads its custom account, completely isolated from Kopi Senja
    const kitchenResult = getTenantPayoutAccount("tenant-kitchen", customTenantMap);
    expect(kitchenResult.accountNumber).toBe("5544332211");
    expect(kitchenResult.accountHolder).toBe("Dapur Mama Official");

    // Manis Bakery has no custom override, falls back to its own default without leaking KS or Kitchen
    const bakeryResult = getTenantPayoutAccount("tenant-bakery", customTenantMap);
    expect(bakeryResult.accountNumber).toBe(DEFAULT_TENANT_PAYOUT_ACCOUNTS["tenant-bakery"].accountNumber);
    expect(bakeryResult.accountHolder).toBe(DEFAULT_TENANT_PAYOUT_ACCOUNTS["tenant-bakery"].accountHolder);
  });

  it("4. Should handle unconfigured unknown tenant gracefully", () => {
    const unknown = getTenantPayoutAccount("tenant-unknown-999");
    expect(unknown.isConfigured).toBe(false);
    expect(unknown.accountNumber).toBe("-");
    expect(unknown.accountHolder).toBe("-");
  });
});
