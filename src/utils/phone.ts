import type { Rule } from "antd/es/form";

export interface CountryPhoneRule {
  code: string;
  label: string;
  digits: number;
  /** National number must match (digits only, no country code). */
  pattern: RegExp;
}

export const DEFAULT_COUNTRY_CODE = "+91";

export const COUNTRY_PHONE_RULES: CountryPhoneRule[] = [
  { code: "+91",  label: "India (+91)",          digits: 10, pattern: /^[6-9]\d{9}$/ },
  { code: "+1",   label: "United States (+1)",   digits: 10, pattern: /^\d{10}$/ },
  { code: "+44",  label: "United Kingdom (+44)", digits: 10, pattern: /^\d{10}$/ },
  { code: "+971", label: "UAE (+971)",           digits: 9,  pattern: /^\d{9}$/ },
  { code: "+65",  label: "Singapore (+65)",      digits: 8,  pattern: /^\d{8}$/ },
  { code: "+61",  label: "Australia (+61)",      digits: 9,  pattern: /^\d{9}$/ },
];

const RULE_BY_CODE = Object.fromEntries(
  COUNTRY_PHONE_RULES.map((r) => [r.code, r]),
) as Record<string, CountryPhoneRule>;

export const COUNTRY_OPTIONS = COUNTRY_PHONE_RULES.map((r) => ({
  value: r.code,
  label: r.label,
}));

export function getPhoneRule(countryCode: string): CountryPhoneRule {
  return RULE_BY_CODE[countryCode] ?? RULE_BY_CODE[DEFAULT_COUNTRY_CODE];
}

/** Strip to digits and leading + for parsing. */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Parse stored phone value into country code + national number.
 * Bare 10-digit numbers default to India (+91).
 */
export function parsePhone(value?: string | null): {
  countryCode: string;
  nationalNumber: string;
} {
  if (!value?.trim()) {
    return { countryCode: DEFAULT_COUNTRY_CODE, nationalNumber: "" };
  }

  const trimmed = value.trim();
  const codes = [...COUNTRY_PHONE_RULES]
    .map((r) => r.code)
    .sort((a, b) => b.length - a.length);

  for (const code of codes) {
    if (trimmed.startsWith(code)) {
      const national = digitsOnly(trimmed.slice(code.length));
      return { countryCode: code, nationalNumber: national };
    }
  }

  const allDigits = digitsOnly(trimmed);
  if (allDigits.length === 10) {
    return { countryCode: DEFAULT_COUNTRY_CODE, nationalNumber: allDigits };
  }

  return { countryCode: DEFAULT_COUNTRY_CODE, nationalNumber: allDigits };
}

/** Canonical display/storage format: "+91 9876543210" */
export function formatPhone(countryCode: string, nationalNumber: string): string {
  const digits = digitsOnly(nationalNumber);
  if (!digits) return "";
  return `${countryCode} ${digits}`;
}

export function validatePhone(
  value: string | undefined | null,
  fieldLabel = "Phone number",
): string | null {
  if (!value?.trim()) return null;

  const { countryCode, nationalNumber } = parsePhone(value);
  const rule = getPhoneRule(countryCode);

  if (!nationalNumber) {
    return `${fieldLabel} is required`;
  }

  if (nationalNumber.length !== rule.digits) {
    return `${fieldLabel} must be ${rule.digits} digits for ${rule.label}`;
  }

  if (!rule.pattern.test(nationalNumber)) {
    if (countryCode === "+91") {
      return `${fieldLabel} must be a valid 10-digit Indian mobile number`;
    }
    return `${fieldLabel} is not valid for ${rule.label}`;
  }

  return null;
}

export function phoneFormRules(options?: {
  required?: boolean;
  label?: string;
}): Rule[] {
  const label = options?.label ?? "Phone number";
  const rules: Rule[] = [];

  if (options?.required) {
    rules.push({ required: true, message: `${label} is required` });
  }

  rules.push({
    validator: async (_, value) => {
      if (!value?.trim()) return;
      const err = validatePhone(value, label);
      if (err) throw new Error(err);
    },
  });

  return rules;
}
