#!/usr/bin/env node
/*
 * 국토교통부 전월세 실거래가(공공데이터포털)를 받아 동별 월세 시세를 public/rent-stats.json으로 만든다.
 *
 *   DATA_GO_KR_KEY=발급받은키 npm run fetch:rent
 *   DATA_GO_KR_KEY=... node scripts/fetch-rent-stats.mjs --months 12 --lawd 41131,41133
 *
 * 필요한 활용신청: 국토교통부_단독/다가구 전월세 실거래가 자료(15126472), 국토교통부_오피스텔 전월세 실거래가 자료(15126475)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregate, isSuccessCode, normalizeItem, normalizeServiceKey, parseItems, readHeader, recentMonths } from './rent-lib.mjs';

const ENDPOINTS = {
  dagagu: 'https://apis.data.go.kr/1613000/RTMSDataSvcSHRent/getRTMSDataSvcSHRent',
  officetel: 'https://apis.data.go.kr/1613000/RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent',
};
const TYPE_LABEL = { dagagu: '단독/다가구', officetel: '오피스텔' };
const REGION_NAMES = {
  41131: '성남시 수정구',
  41133: '성남시 중원구',
  41135: '성남시 분당구',
  11710: '서울 송파구',
};

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const key = normalizeServiceKey(process.env.DATA_GO_KR_KEY);
if (!key) {
  console.error('DATA_GO_KR_KEY 환경 변수에 공공데이터포털 인증키를 넣어 주세요.');
  process.exit(1);
}
const months = recentMonths(Number(arg('months', '12')));
const lawdCodes = arg('lawd', '41131').split(',').map((s) => s.trim()).filter(Boolean);
const out = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'rent-stats.json');

class FatalError extends Error {}

async function fetchXml(url) {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      const text = await res.text();
      if (res.status === 401 || res.status === 403) {
        throw new FatalError(`인증 오류(HTTP ${res.status}): ${text.slice(0, 120)}. 활용신청 승인 뒤 키가 반영되기까지 1~2시간 걸릴 수 있어요.`);
      }
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
      return text;
    } catch (e) {
      if (e instanceof FatalError) throw e;
      lastErr = e;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)));
    }
  }
  throw lastErr;
}

async function fetchMonth(type, lawd, ym) {
  const records = [];
  for (let page = 1; page <= 20; page++) {
    const params = new URLSearchParams({ serviceKey: key, LAWD_CD: lawd, DEAL_YMD: ym, pageNo: String(page), numOfRows: '1000' });
    const xml = await fetchXml(`${ENDPOINTS[type]}?${params}`);
    const head = readHeader(xml);
    if (head.authError) throw new FatalError(`인증 오류(${TYPE_LABEL[type]}): ${head.authError}. 활용신청이 승인됐는지, 키가 맞는지 확인해 주세요.`);
    if (head.resultCode && !isSuccessCode(head.resultCode)) throw new Error(`${head.resultCode} ${head.resultMsg ?? ''}`);
    if (!head.resultCode) throw new Error(`알 수 없는 응답: ${xml.slice(0, 200)}`);
    const items = parseItems(xml);
    for (const it of items) {
      const r = normalizeItem(it);
      if (r) records.push({ ...r, type });
    }
    if (items.length === 0 || page * 1000 >= head.totalCount) break;
  }
  return records;
}

const all = [];
let failures = 0;
for (const lawd of lawdCodes) {
  for (const type of Object.keys(ENDPOINTS)) {
    for (const ym of months) {
      try {
        const recs = await fetchMonth(type, lawd, ym);
        all.push(...recs);
        console.log(`${REGION_NAMES[lawd] ?? lawd} ${TYPE_LABEL[type]} ${ym}: ${recs.length}건`);
      } catch (e) {
        if (e instanceof FatalError) {
          console.error(e.message);
          process.exit(1);
        }
        failures++;
        console.warn(`${REGION_NAMES[lawd] ?? lawd} ${TYPE_LABEL[type]} ${ym}: 실패 (${e.message})`);
      }
    }
  }
}

const stats = aggregate(all);
if (stats.length === 0) {
  console.error(`시세를 만들 자료가 없어요(받은 계약 ${all.length}건, 실패 ${failures}회). 파일은 그대로 둡니다.`);
  process.exit(1);
}

const toYm = (s) => `${s.slice(0, 4)}-${s.slice(4)}`;
const file = {
  generatedAt: new Date().toISOString(),
  period: { from: toYm(months[0]), to: toYm(months[months.length - 1]) },
  region: lawdCodes.map((c) => REGION_NAMES[c] ?? c).join(', '),
  source: '국토교통부 전월세 실거래가(단독/다가구, 오피스텔)',
  stats,
};
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(file, null, 2)}\n`);
console.log(`\n월세 계약 ${all.filter((r) => r.rent > 0).length}건으로 동·유형 ${stats.length}개 시세를 만들었어요 → ${out}`);
if (failures) console.warn(`요청 ${failures}회는 실패해서 빠졌어요.`);
