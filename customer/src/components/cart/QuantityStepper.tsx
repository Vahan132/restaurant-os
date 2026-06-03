'use client';

interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  ariaLabel?: string;
}

export default function QuantityStepper({ value, onChange, min = 1, max = 99, ariaLabel }: Props) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  return (
    <div
      className="inline-flex items-center rounded-full border border-gray-200"
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        aria-label="Decrease quantity"
        className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-gray-700 disabled:opacity-30"
      >
        −
      </button>
      <span className="min-w-[2ch] text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        aria-label="Increase quantity"
        className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-gray-700 disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}
