'use client';

interface QtyStepperProps {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (next: number) => void;
}

/** Large +/- quantity stepper for touch. */
export function QtyStepper({ value, min = 1, max = 99, disabled, onChange }: QtyStepperProps) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));

  return (
    <div className="flex select-none items-center gap-2">
      <button
        type="button"
        onClick={dec}
        disabled={disabled || value <= min}
        aria-label="decrease"
        className="flex h-12 w-12 items-center justify-center rounded-xl border border-gray-300 text-2xl font-bold text-gray-700 active:scale-95 disabled:opacity-40"
      >
        −
      </button>
      <span className="w-8 text-center text-xl font-bold tabular-nums">{value}</span>
      <button
        type="button"
        onClick={inc}
        disabled={disabled || value >= max}
        aria-label="increase"
        className="flex h-12 w-12 items-center justify-center rounded-xl border border-gray-300 text-2xl font-bold text-gray-700 active:scale-95 disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
