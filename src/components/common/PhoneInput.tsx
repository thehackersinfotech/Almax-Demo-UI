import { useEffect, useState } from "react";
import { Input, Select, Space } from "antd";
import {
  COUNTRY_OPTIONS,
  DEFAULT_COUNTRY_CODE,
  formatPhone,
  getPhoneRule,
  parsePhone,
} from "@/utils/phone";

export interface PhoneInputProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  id?: string;
}

export default function PhoneInput({ value, onChange, disabled, id }: PhoneInputProps) {
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [nationalNumber, setNationalNumber] = useState("");

  useEffect(() => {
    const parsed = parsePhone(value);
    setCountryCode(parsed.countryCode);
    setNationalNumber(parsed.nationalNumber);
  }, [value]);

  const rule = getPhoneRule(countryCode);

  const emitChange = (code: string, national: string) => {
    onChange?.(formatPhone(code, national));
  };

  return (
    <Space.Compact id={id} style={{ width: "100%" }}>
      <Select
        value={countryCode}
        disabled={disabled}
        options={COUNTRY_OPTIONS}
        onChange={(code) => {
          setCountryCode(code);
          const trimmed = nationalNumber.slice(0, getPhoneRule(code).digits);
          setNationalNumber(trimmed);
          emitChange(code, trimmed);
        }}
        style={{ width: 148 }}
        popupMatchSelectWidth={220}
      />
      <Input
        value={nationalNumber}
        disabled={disabled}
        inputMode="numeric"
        maxLength={rule.digits}
        placeholder={`${rule.digits}-digit number`}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, rule.digits);
          setNationalNumber(digits);
          emitChange(countryCode, digits);
        }}
        style={{ flex: 1 }}
      />
    </Space.Compact>
  );
}
