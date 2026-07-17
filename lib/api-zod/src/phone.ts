import { z } from "zod/v4";

const arabicDigits: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

export function normalizeEgyptianPhone(value: string): string | null {
  let digits = value.trim().replace(/[٠-٩۰-۹]/g, digit => arabicDigits[digit] || digit).replace(/\D/g, "");
  if (digits.startsWith("0020")) digits = digits.slice(4);
  else if (digits.startsWith("20")) digits = digits.slice(2);
  if (!digits.startsWith("0")) digits = `0${digits}`;
  return /^01[0125]\d{8}$/.test(digits) ? digits : null;
}

export const egyptianPhoneSchema = z.string().trim().transform((value, ctx) => {
  const normalized = normalizeEgyptianPhone(value);
  if (!normalized) {
    ctx.addIssue({ code: "custom", message: "رقم موبايل مصري غير صحيح" });
    return z.NEVER;
  }
  return normalized;
});

export const optionalEgyptianPhoneSchema = z.preprocess(
  value => typeof value === "string" && !value.trim() ? null : value,
  egyptianPhoneSchema.nullable().optional(),
);

export function toWhatsAppInternational(phone: string): string | null {
  const normalized = normalizeEgyptianPhone(phone);
  return normalized ? `20${normalized.slice(1)}` : null;
}

export function resolvePreferredWhatsAppPhone(input: {
  primaryPhone: string;
  primaryPhoneHasWhatsApp: boolean;
  alternatePhone?: string | null;
  alternatePhoneHasWhatsApp: boolean;
  preferredWhatsAppPhone?: string | null;
}): string | null {
  const primary = normalizeEgyptianPhone(input.primaryPhone);
  const alternate = input.alternatePhone ? normalizeEgyptianPhone(input.alternatePhone) : null;
  const preferred = input.preferredWhatsAppPhone ? normalizeEgyptianPhone(input.preferredWhatsAppPhone) : null;
  if (preferred && preferred === primary && input.primaryPhoneHasWhatsApp) return preferred;
  if (preferred && preferred === alternate && input.alternatePhoneHasWhatsApp) return preferred;
  if (input.primaryPhoneHasWhatsApp && primary) return primary;
  if (input.alternatePhoneHasWhatsApp && alternate) return alternate;
  return null;
}
