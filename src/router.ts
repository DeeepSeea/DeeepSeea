import { useSyncExternalStore } from 'react';

/*
 * 해시 라우터. GitHub Pages처럼 정적 호스팅에서도 새로고침과 휴대폰 뒤로 가기가 그대로 동작한다.
 * history.state.idx에 앱 안에서 몇 번째 화면인지 적어 두고, 0이면 뒤로 가기 대신 홈으로 보낸다.
 */

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  window.addEventListener('popstate', cb);
  return () => {
    window.removeEventListener('hashchange', cb);
    window.removeEventListener('popstate', cb);
  };
};
const getPath = () => window.location.hash.replace(/^#/, '') || '/';
const currentIdx = (): number => (window.history.state as { idx?: number } | null)?.idx ?? 0;

export function usePath(): string {
  return useSyncExternalStore(subscribe, getPath, () => '/');
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  const idx = currentIdx();
  if (opts.replace) window.history.replaceState({ idx }, '', `#${path}`);
  else window.history.pushState({ idx: idx + 1 }, '', `#${path}`);
  // pushState는 hashchange를 일으키지 않으므로 직접 알린다
  window.dispatchEvent(new Event('hashchange'));
  window.scrollTo(0, 0);
}

export function back(fallback = '/') {
  if (currentIdx() > 0) window.history.back();
  else navigate(fallback, { replace: true });
}

/** '/c/:id/record' 같은 패턴과 맞으면 파라미터를, 아니면 null을 돌려준다 */
export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('?')[0].split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}
