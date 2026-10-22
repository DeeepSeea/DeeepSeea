import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Info } from 'lucide-react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  desc?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}

/** 모바일에서 다이얼로그 대신 쓰는 바텀시트 */
export function BottomSheet({ open, onClose, title, desc, children, actions }: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  // 부모가 매번 새 함수를 넘겨도 열려 있는 동안 포커스를 다시 잡지 않도록 ref로 들고 있는다
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    sheetRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="sheet-root">
      <div className="sheet-scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabIndex={-1} ref={sheetRef}>
        <h2 className="sheet__title" id="sheet-title">
          {title}
        </h2>
        {desc && <p className="sheet__desc">{desc}</p>}
        {children && <div className="sheet__content">{children}</div>}
        {actions && <div className="sheet__actions">{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}

interface ToastItem {
  id: number;
  text: string;
  tone: 'success' | 'info';
}

const ToastContext = createContext<(text: string, tone?: ToastItem['tone']) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timer = useRef<number>(undefined);

  const show = useCallback((text: string, tone: ToastItem['tone'] = 'success') => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), text, tone });
    timer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
            <span className={`toast__icon${toast.tone === 'info' ? ' toast__icon--info' : ''}`} aria-hidden="true">
              {toast.tone === 'success' ? <Check size={13} strokeWidth={3} /> : <Info size={13} strokeWidth={3} />}
            </span>
            {toast.text}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
