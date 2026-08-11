"use client";

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
};

export function Range({ label, value, min, max, step = 1, suffix = "", onChange }: Props) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="rangeRow">
      <span className="controlLabel">{label}</span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ "--range-progress": `${pct}%` } as React.CSSProperties}
      />
      <span className="controlValue">{value}{suffix}</span>
    </label>
  );
}
