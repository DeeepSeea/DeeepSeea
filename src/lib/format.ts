/** 원 단위 금액을 '45만원', '45만 5,000원', '1억 3,000만원'처럼 읽기 쉽게 쓴다 */
export function formatWon(won: number): string {
  const v = Math.round(won);
  if (v < 0) return `-${formatWon(-v)}`;
  if (v < 10000) return `${v.toLocaleString('ko-KR')}원`;
  const eok = Math.floor(v / 1e8);
  const man = Math.floor((v % 1e8) / 1e4);
  const rest = v % 1e4;
  const parts: string[] = [];
  if (eok) parts.push(`${eok.toLocaleString('ko-KR')}억`);
  if (man) parts.push(`${man.toLocaleString('ko-KR')}만`);
  if (rest) return `${parts.join(' ')} ${rest.toLocaleString('ko-KR')}원`;
  return `${parts.join(' ')}원`;
}

/** 만원 입력값(문자열) → 원. 비었거나 숫자가 아니면 0 */
export function manwonToWon(input: string): number {
  const n = Number(input.replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10000) : 0;
}

/** 원 → 만원 입력값(문자열). 0이면 빈 문자열 */
export function wonToManwonInput(won: number): string {
  if (!won) return '';
  return String(Math.round(won / 100) / 100);
}

export function formatMin(min: number): string {
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

/** 초 → '3분 12초' */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}초`;
  return s ? `${m}분 ${s}초` : `${m}분`;
}

/** 초 → '03:12' (타이머 표시용) */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * 받침에 따라 조사를 고른다. josa('정문 앞 원룸', '이', '가') → '이'.
 * 한글과 숫자가 아니면 받침을 알 수 없어 '이(가)'처럼 둘 다 쓴다.
 */
export function josa(word: string, withBatchim: string, withoutBatchim: string): string {
  const last = word.trim().slice(-1);
  if (!last) return withBatchim;
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 ? withBatchim : withoutBatchim;
  if (/[0-9]/.test(last)) return '013678'.includes(last) ? withBatchim : withoutBatchim;
  return `${withBatchim}(${withoutBatchim})`;
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
