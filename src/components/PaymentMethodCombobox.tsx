"use client";

import { SearchableCombobox } from "./SearchableCombobox";
import { PAYMENT_METHODS } from "@/constants/paymentMethods";

type PaymentMethodComboboxProps = {
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
};

export function PaymentMethodCombobox({
  value,
  onChange,
  placeholder = "Selecione a forma de pagamento…",
  disabled = false,
  error,
}: PaymentMethodComboboxProps) {
  return (
    <SearchableCombobox
      value={value}
      options={PAYMENT_METHODS}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      error={error}
      searchPlaceholder="Buscar forma de pagamento…"
      alwaysShowOther={true}
      otherOption="Outro"
    />
  );
}
