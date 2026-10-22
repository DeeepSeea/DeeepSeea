import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { back } from '../router';

interface ScreenProps {
  children: ReactNode;
  wide?: boolean;
}

export function Screen({ children, wide }: ScreenProps) {
  return <div className={`screen${wide ? ' screen--wide' : ''}`}>{children}</div>;
}

interface TopBarProps {
  title?: ReactNode;
  /** 뒤로 가기 버튼을 보이지 않으려면 false */
  backButton?: boolean;
  onBack?: () => void;
  brand?: boolean;
  line?: boolean;
  right?: ReactNode;
}

export function TopBar({ title, backButton = true, onBack, brand, line, right }: TopBarProps) {
  return (
    <header className={`topbar${brand ? ' topbar--brand' : ''}${line ? ' topbar--line' : ''}`}>
      {backButton && !brand && (
        <button type="button" className="icon-btn" aria-label="뒤로 가기" onClick={onBack ?? (() => back())}>
          <ChevronLeft size={26} />
        </button>
      )}
      <h1 className="topbar__title">{title}</h1>
      {right}
    </header>
  );
}

export function Body({ children, cta }: { children: ReactNode; cta?: boolean }) {
  return <main className={`screen__body${cta ? ' screen__body--cta' : ''}`}>{children}</main>;
}

export function BottomCTA({ children, info }: { children: ReactNode; info?: ReactNode }) {
  return (
    <div className="bottom-cta">
      {info && <p className="bottom-info">{info}</p>}
      {children}
    </div>
  );
}

interface ListRowProps {
  lead?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  badges?: ReactNode;
  trail?: ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  compact?: boolean;
  as?: 'div' | 'button' | 'label';
  className?: string;
}

export function ListRow({ lead, title, sub, badges, trail, chevron, onClick, compact, as, className = '' }: ListRowProps) {
  const Tag = as ?? (onClick ? 'button' : 'div');
  return (
    <Tag
      className={`list-row${compact ? ' list-row--compact' : ''} ${className}`}
      onClick={onClick}
      {...(Tag === 'button' ? { type: 'button' as const } : {})}
    >
      {lead}
      <span className="list-row__body">
        <span className="list-row__title">{title}</span>
        {sub && <span className="list-row__sub">{sub}</span>}
        {badges && <span className="list-row__badges">{badges}</span>}
      </span>
      {(trail || chevron) && (
        <span className="list-row__trail">
          {trail}
          {chevron && <ChevronRight size={20} className="chevron" />}
        </span>
      )}
    </Tag>
  );
}

export function ListHeader({ title, right }: { title: ReactNode; right?: ReactNode }) {
  return (
    <div className="list-header">
      <h2 className="list-header__title">{title}</h2>
      {right}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      {right}
    </div>
  );
}

export function Badge({ tone = 'grey', children }: { tone?: 'grey' | 'blue' | 'red' | 'green'; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function Note({ children, flush }: { children: ReactNode; flush?: boolean }) {
  return (
    <p className={`note${flush ? ' note--flush' : ''}`}>
      <Info size={16} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function KV({ label, value, sub, total }: { label: ReactNode; value: ReactNode; sub?: ReactNode; total?: boolean }) {
  return (
    <div className={`kv${total ? ' kv--total' : ''}`}>
      <span className="kv__label">
        {label}
        {sub && <small>{sub}</small>}
      </span>
      <span className="kv__value">{value}</span>
    </div>
  );
}

export function EmptyState({ icon, title, desc, children }: { icon: ReactNode; title: ReactNode; desc?: ReactNode; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="asset-circle" aria-hidden="true">
        {icon}
      </div>
      <p className="t-h4">{title}</p>
      {desc && <p className="t-body2 c-secondary pre-line">{desc}</p>}
      {children}
    </div>
  );
}

export function Band() {
  return <div className="band" aria-hidden="true" />;
}
