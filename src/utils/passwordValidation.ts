export interface PasswordRules {
  min_length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  digit: boolean;
  special: boolean;
}

export interface PasswordStrength {
  level: "weak" | "medium" | "strong";
  rules: PasswordRules;
  valid: boolean;
}

const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export function evaluatePasswordStrength(password: string, minLength = 8): PasswordStrength {
  const rules: PasswordRules = {
    min_length: password.length >= minLength,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    digit: /\d/.test(password),
    special: SPECIAL_RE.test(password),
  };
  const passed = Object.values(rules).filter(Boolean).length;
  let level: PasswordStrength["level"] = "weak";
  if (passed >= 5) level = "strong";
  else if (passed >= 3) level = "medium";
  return { level, rules, valid: passed === 5 };
}

export const PASSWORD_RULE_LABELS: { key: keyof PasswordRules; label: string }[] = [
  { key: "min_length", label: "At least 8 characters" },
  { key: "uppercase", label: "One uppercase letter" },
  { key: "lowercase", label: "One lowercase letter" },
  { key: "digit", label: "One number" },
  { key: "special", label: "One special character" },
];

export function passwordMatchValidator(getPassword: () => string) {
  return (_: unknown, value: string) => {
    if (!value || getPassword() === value) return Promise.resolve();
    return Promise.reject(new Error("Passwords do not match"));
  };
}
