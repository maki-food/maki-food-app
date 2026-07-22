import React from 'react';
import { Input } from '@/components/ui/input';

function isoToDisplay(iso) {
  if (!iso) return '';
  const parts = String(iso).split('-');
  if (parts.length !== 3) return '';
  const [y, m, d] = parts;
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

function displayToIso(display) {
  const digits = display.replace(/\D/g, '');
  if (digits.length < 8) return '';
  const d = digits.slice(0, 2);
  const m = digits.slice(2, 4);
  const y = digits.slice(4, 8);
  return `${y}-${m}-${d}`;
}

function applyMask(value) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

export default function DateInput({ value, onChange, className, ...props }) {
  const [display, setDisplay] = React.useState(isoToDisplay(value));

  React.useEffect(() => {
    setDisplay(isoToDisplay(value));
  }, [value]);

  const handleChange = (e) => {
    const masked = applyMask(e.target.value);
    setDisplay(masked);
    onChange?.(displayToIso(masked));
  };

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      placeholder="DD/MM/AAAA"
      maxLength={10}
      value={display}
      onChange={handleChange}
      className={className}
    />
  );
}