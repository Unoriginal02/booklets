import type { ReactNode } from 'react';

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="border-b border-stone-200 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold tracking-wider text-stone-500 uppercase">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; disabled?: boolean; title?: string }[];
  onChange(v: T): void;
}) {
  return (
    <div className="flex rounded-md bg-stone-200/70 p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o.value}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded px-2 py-1 transition ${
            value === o.value ? 'bg-white font-medium shadow-sm' : 'text-stone-600 hover:text-stone-900'
          } disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  disabled,
  variant = 'ghost',
  title,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'ghost' | 'primary' | 'outline' | 'danger';
  title?: string;
  className?: string;
}) {
  const styles = {
    ghost: 'hover:bg-stone-200 text-stone-700',
    outline: 'border border-stone-300 bg-white hover:bg-stone-50 text-stone-800',
    primary: 'bg-orange-700 text-white hover:bg-orange-800 shadow-sm',
    danger: 'text-red-700 hover:bg-red-50',
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function NumField({
  label,
  value,
  placeholder,
  onChange,
  disabled,
}: {
  label: string;
  value: number | undefined;
  placeholder?: number;
  onChange(v: number | undefined): void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-[11px] text-stone-500">
      {label}
      <div className="flex items-center rounded-md border border-stone-300 bg-white focus-within:border-orange-500">
        <input
          type="number"
          min={0}
          step={0.5}
          disabled={disabled}
          value={value ?? ''}
          placeholder={placeholder != null ? String(placeholder) : undefined}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') return onChange(undefined);
            const n = Number(raw);
            if (Number.isFinite(n) && n >= 0) onChange(n);
          }}
          className="w-full min-w-0 bg-transparent px-2 py-1 text-sm text-stone-900 outline-none placeholder:text-stone-400"
        />
        <span className="pr-2 text-stone-400">mm</span>
      </div>
    </label>
  );
}
