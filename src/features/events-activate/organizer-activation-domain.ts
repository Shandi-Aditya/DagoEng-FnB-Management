/**
 * Pure domain logic for Organizer Account Activation.
 * Handles credential validation, expiration formatting, and error message mapping.
 */

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates password creation rules:
 * - Minimum 8 characters
 * - Confirmation must match password
 */
export function validatePasswordInput(
  password: string,
  confirmPassword: string
): PasswordValidationResult {
  if (!password || password.length < 8) {
    return {
      valid: false,
      error: "Password wajib memiliki minimal 8 karakter.",
    };
  }

  if (password !== confirmPassword) {
    return {
      valid: false,
      error: "Konfirmasi password tidak cocok dengan password baru.",
    };
  }

  return {
    valid: true,
  };
}

/**
 * Formats token expiration information.
 */
export function formatActivationExpiry(_expiresAt?: string | null): string {
  return "48 jam sejak penerbitan";
}

/**
 * Maps error keys or server messages to user-friendly copy.
 */
export function getActivationErrorMessage(errorKeyOrMessage?: string | null): string {
  if (!errorKeyOrMessage) {
    return "Tautan aktivasi tidak valid atau telah kedaluwarsa.";
  }

  switch (errorKeyOrMessage) {
    case "TOKEN_MISSING":
      return "Tautan aktivasi tidak valid. Parameter token tidak ditemukan pada URL.";
    case "TOKEN_EXPIRED":
      return "Tautan aktivasi tidak valid atau telah kedaluwarsa.";
    case "NETWORK_ERROR":
      return "Gagal menghubungi server untuk memvalidasi token aktivasi.";
    default:
      return errorKeyOrMessage;
  }
}
