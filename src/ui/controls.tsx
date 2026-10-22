import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Check, Minus, Plus } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'ghost-danger';
type ButtonSize = 'xl' | 'l' | 'm' | 's';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
}

export function Button({ variant = 'primary', size = 'l', block, loading, className = '', children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`btn btn--${variant} btn--${size}${block ? ' btn--block' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Dots /> : children}
    </button>
  );
}

/** 토스식 로딩: 쉬머 대신 점 세 개 */
export function Dots({ label = '불러오는 중' }: { label?: string }) {
  return (
    <span className="dots" role="status" aria-label={label}>
      <i />
      <i />
      <i />
    </span>
  );
}

interface FieldShellProps {
  label?: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  id: string;
  children: ReactNode;
}

function FieldShell({ label, help, error, id, children }: FieldShellProps) {
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      {label && (
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
      )}
      {children}
      {(error || help) && (
        <p className="field__help" id={`${id}-help`}>
          {error || help}
        </p>
      )}
    </div>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  suffix?: string;
  icon?: ReactNode;
}

export function TextField({ label, help, error, suffix, icon, className = '', id, ...rest }: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell label={label} help={help} error={error} id={fieldId}>
      <div className="field__control">
        {icon && <span className="field__icon">{icon}</span>}
        <input
          id={fieldId}
          className={`input${suffix ? ' input--suffix' : ''}${icon ? ' input--search' : ''} ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || help ? `${fieldId}-help` : undefined}
          {...rest}
        />
        {suffix && <span className="field__suffix">{suffix}</span>}
      </div>
    </FieldShell>
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  help?: ReactNode;
}

export function TextArea({ label, help, id, className = '', ...rest }: TextAreaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell label={label} help={help} id={fieldId}>
      <textarea id={fieldId} className={`input ${className}`} {...rest} />
    </FieldShell>
  );
}

interface SegmentedProps<T extends string | number> {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
  label: string;
  size?: 'md' | 'sm';
  /** 선택된 값을 다시 누르면 선택을 해제한다 */
  allowClear?: boolean;
  onClear?: () => void;
}

export function Segmented<T extends string | number>({ options, value, onChange, label, size = 'md', allowClear, onClear }: SegmentedProps<T>) {
  return (
    <div className={`seg${size === 'sm' ? ' seg--sm' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className="seg__item"
          onClick={() => (allowClear && value === o.value ? onClear?.() : onChange(o.value))}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface ChipsProps<T extends string> {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T | undefined) => void;
  label: string;
  grid?: boolean;
}

/** 하나만 고르는 칩. 고른 칩을 다시 누르면 해제된다 */
export function Chips<T extends string>({ options, value, onChange, label, grid }: ChipsProps<T>) {
  return (
    <div className={`chips${grid ? ' chips--grid' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="chip"
          aria-pressed={value === o.value}
          onClick={() => onChange(value === o.value ? undefined : o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

export function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span className="checkbox" data-checked={checked} aria-hidden="true">
      {checked && <Check size={16} strokeWidth={3} />}
    </span>
  );
}

interface SpinnerProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  label: string;
}

export function NumericSpinner({ value, onChange, min = 0, max = 99, step = 1, unit = '', label }: SpinnerProps) {
  return (
    <div className="spinner" role="group" aria-label={label}>
      <button type="button" aria-label={`${label} 줄이기`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
        <Minus size={18} />
      </button>
      <span className="spinner__value" aria-live="polite">
        {value}
        {unit}
      </span>
      <button type="button" aria-label={`${label} 늘리기`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
        <Plus size={18} />
      </button>
    </div>
  );
}
