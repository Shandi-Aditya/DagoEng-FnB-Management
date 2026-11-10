/**
 * Payout Guard & Bank Validation Helpers
 * Ensures community organizers have complete and valid bank account credentials
 * before payout requests can be initiated or approved.
 */

export interface PayoutFieldValidationError {
  field: "bankName" | "accountNumber" | "accountHolder";
  message: string;
}

export interface MissingPayoutFieldsResult {
  isValid: boolean;
  missingFields: Array<"bankName" | "accountNumber" | "accountHolder">;
  errors: PayoutFieldValidationError[];
  errorSummary: string;
}

export interface BankAccountHolderCandidate {
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  branch?: string | null;
  [key: string]: any;
}

/**
 * Masks bank account number for privacy in logs and UI errors (e.g. ****2831)
 */
export function maskAccountNumber(acc?: string | null): string {
  if (!acc) return "-";
  const clean = acc.replace(/[^0-9]/g, "");
  if (clean.length === 0) return "-";
  if (clean.length <= 4) return "****" + clean;
  return "****" + clean.slice(-4);
}

/**
 * Validates bank credentials for organizer payout.
 * Requirements:
 * - bankName: non-empty string
 * - accountNumber: only digits (8-20 digits)
 * - accountHolder: non-empty string, min 3 characters
 */
export function getMissingPayoutFields(
  organizer?: BankAccountHolderCandidate | null
): MissingPayoutFieldsResult {
  const errors: PayoutFieldValidationError[] = [];
  const missingFields: Array<"bankName" | "accountNumber" | "accountHolder"> = [];

  if (!organizer) {
    return {
      isValid: false,
      missingFields: ["bankName", "accountNumber", "accountHolder"],
      errors: [
        { field: "bankName", message: "Nama bank wajib diisi." },
        { field: "accountNumber", message: "Nomor rekening wajib diisi (8-20 digit angka)." },
        { field: "accountHolder", message: "Nama pemilik rekening wajib diisi (minimal 3 karakter)." },
      ],
      errorSummary: "Data rekening belum diisi sama sekali.",
    };
  }

  // Support both flat bank credentials and nested bankDetails
  const candidateBankName = organizer.bankName ?? organizer.bankDetails?.bankName;
  const candidateAccountNumber = organizer.accountNumber ?? organizer.bankDetails?.accountNumber;
  const candidateAccountHolder = organizer.accountHolder ?? organizer.bankDetails?.accountHolder;

  // 1. Bank Name Validation
  const bankName = typeof candidateBankName === "string" ? candidateBankName.trim() : "";
  if (!bankName) {
    missingFields.push("bankName");
    errors.push({ field: "bankName", message: "Nama bank wajib diisi." });
  }

  // 2. Account Number Validation (8 to 20 digits only)
  const rawAcc = typeof candidateAccountNumber === "string" ? candidateAccountNumber.trim() : "";
  if (!rawAcc) {
    missingFields.push("accountNumber");
    errors.push({
      field: "accountNumber",
      message: "Nomor rekening wajib diisi.",
    });
  } else if (!/^\d{8,20}$/.test(rawAcc)) {
    missingFields.push("accountNumber");
    errors.push({
      field: "accountNumber",
      message: "Nomor rekening hanya boleh berisi angka (8-20 digit) tanpa karakter lain.",
    });
  }

  // 3. Account Holder Name Validation (min 3 chars)
  const rawHolder = typeof candidateAccountHolder === "string" ? candidateAccountHolder.trim() : "";
  if (!rawHolder) {
    missingFields.push("accountHolder");
    errors.push({
      field: "accountHolder",
      message: "Nama pemilik rekening wajib diisi.",
    });
  } else if (rawHolder.length < 3) {
    missingFields.push("accountHolder");
    errors.push({
      field: "accountHolder",
      message: "Nama pemilik rekening minimal terdiri dari 3 karakter.",
    });
  }

  const isValid = errors.length === 0;
  const errorSummary = isValid
    ? ""
    : `Field rekening belum lengkap/valid: ${errors.map((e) => e.message).join(" ")}`;

  return {
    isValid,
    missingFields,
    errors,
    errorSummary,
  };
}

