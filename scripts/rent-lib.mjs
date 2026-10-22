/*
 * 국토교통부 전월세 실거래가 응답(XML)을 읽고 동별 통계를 내는 순수 함수 모음.
 * 2024년 개편된 영문 필드(umdNm, deposit, monthlyRent …)와 예전 한글 필드(법정동, 보증금액, 월세금액 …)를 모두 받는다.
 */

const decodeXml = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? decodeXml(m[1].trim()) : undefined;
}

/** 응답 헤더. 게이트웨이 오류(키 미등록, 트래픽 초과 등)는 authError로 돌려준다 */
export function readHeader(xml) {
  return {
    resultCode: tag(xml, 'resultCode'),
    resultMsg: tag(xml, 'resultMsg'),
    totalCount: Number(tag(xml, 'totalCount') ?? 0),
    authError: tag(xml, 'returnAuthMsg') ?? tag(xml, 'errMsg'),
  };
}

export const isSuccessCode = (code) => code === '00' || code === '000';

export function parseItems(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml))) {
    const obj = {};
    const fieldRe = /<([^\s>/]+)>([\s\S]*?)<\/\1>/g;
    let f;
    while ((f = fieldRe.exec(m[1]))) obj[f[1]] = decodeXml(f[2].trim());
    items.push(obj);
  }
  return items;
}

const toNum = (v) => (v === undefined || v === null || String(v).trim() === '' ? NaN : Number(String(v).replace(/,/g, '').trim()));

function pick(item, ...keys) {
  for (const k of keys) if (item[k] !== undefined && item[k] !== '') return item[k];
  return undefined;
}

/** 항목 하나 → { dong, deposit, rent, area, ym }. 금액은 만원 단위. 읽을 수 없으면 null */
export function normalizeItem(item) {
  const dong = pick(item, 'umdNm', '법정동');
  const deposit = toNum(pick(item, 'deposit', '보증금액', '보증금'));
  const rent = toNum(pick(item, 'monthlyRent', '월세금액', '월세'));
  const year = pick(item, 'dealYear', '년', '계약년도');
  const month = pick(item, 'dealMonth', '월', '계약월');
  const area = toNum(pick(item, 'excluUseAr', 'totalFloorAr', '전용면적', '계약면적'));
  if (!dong || !Number.isFinite(deposit) || !Number.isFinite(rent)) return null;
  return {
    dong: dong.trim(),
    deposit,
    rent,
    area: Number.isFinite(area) ? area : undefined,
    ym: year && month ? `${year}-${String(month).padStart(2, '0')}` : undefined,
  };
}

/** 정렬된 배열의 q 분위수(직선 보간) */
export function quantile(sorted, q) {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const round1 = (v) => Math.round(v * 10) / 10;

/**
 * 월세 계약(월세 0원인 전세 제외)만 모아 동·유형별 통계를 낸다.
 * 표본이 minCount보다 적은 동은 시세라고 부르기 어려워 뺀다.
 */
export function aggregate(records, minCount = 5) {
  const groups = new Map();
  for (const r of records) {
    if (!(r.rent > 0)) continue;
    const key = `${r.type}|${r.dong}`;
    if (!groups.has(key)) groups.set(key, { dong: r.dong, type: r.type, rents: [], deposits: [] });
    const g = groups.get(key);
    g.rents.push(r.rent);
    g.deposits.push(r.deposit);
  }
  const stats = [];
  for (const g of groups.values()) {
    if (g.rents.length < minCount) continue;
    const rents = [...g.rents].sort((a, b) => a - b);
    const deposits = [...g.deposits].sort((a, b) => a - b);
    stats.push({
      dong: g.dong,
      type: g.type,
      count: rents.length,
      rent: { p25: round1(quantile(rents, 0.25)), p50: round1(quantile(rents, 0.5)), p75: round1(quantile(rents, 0.75)) },
      rentDeciles: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((q) => round1(quantile(rents, q))),
      deposit: { p25: round1(quantile(deposits, 0.25)), p50: round1(quantile(deposits, 0.5)), p75: round1(quantile(deposits, 0.75)) },
    });
  }
  return stats.sort((a, b) => a.type.localeCompare(b.type) || a.dong.localeCompare(b.dong, 'ko'));
}

/** 이번 달을 빼고 최근 n개월을 오래된 순으로. 이번 달은 신고 기한(30일)이 안 지나 자료가 덜 찼다 */
export function recentMonths(n, now = new Date()) {
  const out = [];
  for (let i = n; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/** 공공데이터포털의 Encoding 키를 넣어도 두 번 인코딩되지 않게 원래 값으로 되돌린다 */
export function normalizeServiceKey(key) {
  const k = String(key ?? '').trim();
  if (!k.includes('%')) return k;
  try {
    return decodeURIComponent(k);
  } catch {
    return k;
  }
}
