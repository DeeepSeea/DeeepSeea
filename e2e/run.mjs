#!/usr/bin/env node
/*
 * 실제 빌드 결과를 브라우저로 끝까지 써 보는 e2e 테스트.
 * 카카오맵은 e2e/fake-kakao.js로 바꿔 끼워 키 없이도 주소 검색과 거리 계산 흐름을 검사한다.
 *
 *   npm run e2e   # 배포 키(.env.production)가 들어가지 않도록 e2e 모드로 dist-e2e에 따로 빌드한다
 *   SHOTS=e2e/screenshots npm run e2e   # 화면 캡처 저장 위치
 */
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { build, preview } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shotsDir = resolve(root, process.env.SHOTS ?? 'e2e/screenshots');
await mkdir(shotsDir, { recursive: true });
const fakeKakao = await readFile(resolve(root, 'e2e/fake-kakao.js'), 'utf8');

const RENT_STATS = {
  generatedAt: '2026-10-03T00:00:00.000Z',
  period: { from: '2025-10', to: '2026-09' },
  region: '성남시 수정구',
  source: '국토교통부 전월세 실거래가(단독/다가구, 오피스텔)',
  stats: [
    { dong: '복정동', type: 'dagagu', count: 132, rent: { p25: 40, p50: 45, p75: 52 }, rentDeciles: [35, 38, 40, 43, 45, 47, 50, 53, 58], deposit: { p25: 300, p50: 500, p75: 1000 } },
    { dong: '태평동', type: 'dagagu', count: 211, rent: { p25: 35, p50: 40, p75: 45 }, rentDeciles: [30, 33, 35, 38, 40, 42, 44, 47, 52], deposit: { p25: 200, p50: 500, p75: 1000 } },
    { dong: '신흥동', type: 'officetel', count: 48, rent: { p25: 42, p50: 48, p75: 55 }, rentDeciles: [38, 40, 42, 45, 48, 50, 53, 56, 62], deposit: { p25: 500, p50: 1000, p75: 1000 } },
  ],
};

await build({ root, mode: 'e2e', logLevel: 'warn', build: { outDir: 'dist-e2e', emptyOutDir: true } });
const server = await preview({ root, mode: 'e2e', build: { outDir: 'dist-e2e' }, preview: { port: 4173, strictPort: true }, logLevel: 'warn' });
const base = 'http://localhost:4173/';
const browser = await chromium.launch();
const problems = [];
let step = 0;

function check(cond, msg) {
  if (!cond) throw new Error(`확인 실패: ${msg}`);
}

async function newPage({ kakao, rent }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR', acceptDownloads: true });
  if (kakao) {
    await ctx.addInitScript(() => {
      localStorage.setItem('hannunbang.settings.v1', JSON.stringify({ onboarded: true, kakaoKey: 'e2e-test-key' }));
    });
    await ctx.route(/dapi\.kakao\.com/, (route) => route.fulfill({ contentType: 'application/javascript', body: fakeKakao }));
  }
  await ctx.route(/rent-stats\.json/, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(rent ? RENT_STATS : { stats: [] }) }),
  );
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
  return page;
}

async function shot(page, name, fullPage = false) {
  step += 1;
  // 토스트가 사라진 깨끗한 화면을 남긴다
  await page.locator('.toast').waitFor({ state: 'detached', timeout: 4000 }).catch(() => undefined);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${shotsDir}/${String(step).padStart(2, '0')}-${name}.png`, fullPage });
}

const btn = (page, name, exact = true) => page.getByRole('button', { name, exact });

async function fillMoney(page, deposit, rent, fee) {
  await page.getByLabel('보증금', { exact: true }).fill(deposit);
  await page.getByLabel('월세', { exact: true }).fill(rent);
  await page.getByLabel('관리비', { exact: true }).fill(fee);
}

try {
  // ───────── 1. 키 없이 처음 쓰기(직접 입력 모드) ─────────
  {
    const page = await newPage({ kakao: false, rent: false });
    await page.goto(base);
    await page.getByText('한 표에서 비교해요').waitFor();
    await shot(page, 'onboarding-intro');
    await btn(page, '시작하기').click();
    await page.getByText('무엇이 중요한가요?').waitFor();
    await page.getByRole('radiogroup', { name: '공원 중요도' }).getByRole('radio', { name: '상관없음' }).click();
    await shot(page, 'onboarding-criteria');
    await btn(page, '다음').click();
    await page.getByText('통학 정보를 알려 주세요').waitFor();
    await btn(page, '일주일 통학 일수 줄이기').click();
    check(await page.getByText('한 달에 약 17일').isVisible(), '주 4일이면 한 달 17일');
    await shot(page, 'onboarding-commute');
    await btn(page, '완료').click();

    await page.getByText('아직 비교할 방이 없어요').waitFor();
    await shot(page, 'home-empty');
    await btn(page, '후보 추가하기').click();
    await page.getByLabel('이름', { exact: true }).fill('수동 입력 원룸');
    await page.getByLabel('주소', { exact: true }).fill('복정동 어딘가');
    await btn(page, '추가하기').click();
    check(await page.getByText('월세를 넣어 주세요').isVisible(), '월세 없이 추가하면 안내');
    await fillMoney(page, '500', '42', '5');
    await shot(page, 'add-manual');
    await btn(page, '추가하기').click();
    await page.getByText('내 기준 1위').waitFor();
    await page.getByRole('button', { name: /^학교/ }).click();
    await page.getByLabel('걸어서 걸리는 시간').fill('7');
    await shot(page, 'infra-manual-sheet');
    await btn(page, '저장하기').click();
    await page.getByText('걸어서 7분', { exact: true }).waitFor();
    await shot(page, 'detail-manual', true);
    await page.context().close();
  }

  // ───────── 2. 카카오 연결 상태로 후보 3곳 비교 ─────────
  const page = await newPage({ kakao: true, rent: true });
  await page.goto(base);
  await page.getByText('아직 비교할 방이 없어요').waitFor();

  const addViaSearch = async ({ name, query, type, money }) => {
    await btn(page, '후보 추가하기').click();
    await page.getByLabel('이름', { exact: true }).fill(name);
    await page.getByLabel('위치', { exact: true }).fill(query);
    await btn(page, '검색').click();
    const results = page.getByRole('list', { name: '검색 결과' });
    await results.waitFor();
    if (name === '정문 앞 원룸') await shot(page, 'add-search-results');
    await results.getByRole('button').first().click();
    await btn(page, '바꾸기').waitFor();
    if (type) await page.getByRole('radiogroup', { name: '방 유형' }).getByRole('radio', { name: type }).click();
    await fillMoney(page, ...money);
    await btn(page, '추가하기').click();
    await page.getByText('생활 인프라').waitFor();
    await page.getByText(/걸어서 \d+분/).first().waitFor();
  };

  await addViaSearch({ name: '정문 앞 원룸', query: '정문 원룸', money: ['500', '45', '5'] });
  check(await page.getByText('GS25 가천점').isVisible(), '편의점 자동 계산');
  check(await page.getByText('복정동 원룸·다가구 월세 중간값').isVisible(), '동네 시세 표시');
  await shot(page, 'detail-auto', true);

  // 현장 기록
  await btn(page, '현장 기록하기').click();
  await page.getByText('큰 창이 어느 쪽을 보나요?').waitFor();
  await btn(page, '남').click();
  await btn(page, '창문 개수 늘리기').click();
  await btn(page, '창문 개수 늘리기').click();
  await page.getByRole('switch', { name: '맞통풍' }).click();
  await page.getByRole('radiogroup', { name: '수압' }).getByRole('radio', { name: '4' }).click();
  await btn(page, '없어요').click();
  await page.getByRole('radiogroup', { name: '소음' }).getByRole('radio', { name: '4' }).click();
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 480;
    c.height = 360;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 480, 360);
    grad.addColorStop(0, '#dbe7f7');
    grad.addColorStop(1, '#f6efe3');
    g.fillStyle = grad;
    g.fillRect(0, 0, 480, 360);
    g.fillStyle = '#ffffff';
    g.fillRect(150, 60, 180, 150);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'room.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.locator('.photos img').first().waitFor();
  await page.getByLabel('메모').fill('창틀 실리콘 새로 함, 인터넷 관리비 포함');
  await shot(page, 'field-record', true);
  await btn(page, '기록 마치기').click();
  await page.getByText('5/5').first().waitFor();
  check(await page.getByText('남향').isVisible(), '채광 기록 보임');

  await btn(page, '뒤로 가기').click();
  await addViaSearch({ name: '태평동 투룸', query: '태평 투룸', money: ['300', '39', '5'] });
  await btn(page, '뒤로 가기').click();
  await addViaSearch({ name: '신흥 오피스텔', query: '신흥 오피스텔', type: '오피스텔', money: ['1000', '38', '7'] });
  check(await page.getByText(/1,650원 × 왕복/).isVisible(), '먼 후보는 통학 교통비 계산');
  await btn(page, '뒤로 가기').click();

  await page.getByText('후보 3곳을 비교하고 있어요').waitFor();
  await shot(page, 'home-ranking');
  await page.getByRole('radiogroup', { name: '정렬' }).getByRole('radio', { name: '총 주거비순' }).click();
  await shot(page, 'home-sort-cost');
  await page.getByRole('radiogroup', { name: '정렬' }).getByRole('radio', { name: '점수순' }).click();

  // 비교표와 지도
  await btn(page, '비교표 보기').click();
  await page.locator('table.cmp').waitFor();
  check((await page.locator('table.cmp thead th').count()) === 4, '후보 3곳 열');
  await shot(page, 'compare-table');
  await page.setViewportSize({ width: 1280, height: 860 });
  await shot(page, 'compare-table-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('radiogroup', { name: '보기 방식' }).getByRole('radio', { name: '지도' }).click();
  await page.locator('.pin--candidate').first().waitFor();
  check((await page.locator('.pin--candidate').count()) === 3, '지도에 후보 3곳');
  await shot(page, 'compare-map');
  await btn(page, '뒤로 가기').click();

  // 설정: 백업 내려받기 → 모두 지우기 → 다시 불러오기
  await btn(page, '설정').click();
  await page.getByText('내 기준').first().waitFor();
  await shot(page, 'settings', true);
  await page.getByRole('button', { name: /백업 파일 내려받기/ }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), btn(page, '내려받기').click()]);
  const backupPath = await download.path();
  const backup = JSON.parse(await readFile(backupPath, 'utf8'));
  check(backup.app === 'hannunbang' && backup.candidates.length === 3, '백업에 후보 3곳');
  check(Object.keys(backup.photos).length === 1, '백업에 사진 1장');
  check(!('kakaoKey' in backup.settings), '백업에 카카오 키를 넣지 않음');

  await page.getByRole('button', { name: /모든 후보 지우기/ }).click();
  await btn(page, '지우기').click();
  await page.getByText('모든 후보를 지웠어요').waitFor();
  await page.locator('input[type=file][accept*="json"]').setInputFiles(backupPath);
  await page.getByText('후보 3곳을 불러올게요').waitFor();
  await btn(page, '바꾸기').click();
  await page.getByText('후보 3곳을 불러왔어요').waitFor();
  await btn(page, '뒤로 가기').click();
  await page.getByText('후보 3곳을 비교하고 있어요').waitFor();
  await page.getByRole('button', { name: /정문 앞 원룸/ }).click();
  await page.locator('.photo-strip img').first().waitFor();
  await btn(page, '뒤로 가기').click();

  // ───────── 3. 사용성 테스트 모드(가정 5) ─────────
  await btn(page, '설정').click();
  await page.getByRole('button', { name: /테스트 시작하기/ }).click();
  await page.getByLabel('참가자').fill('P1');
  await shot(page, 'test-start');
  await btn(page, '테스트 시작하기').click();
  await page.getByText('사용성 테스트 과제').waitFor();
  check(await page.getByText('월세를 보고 마음에 드는 방 2곳을 골라 주세요').isVisible(), '월세만 보기 단계');
  await page.getByRole('button', { name: /도움 요청 기록하기/ }).click();
  await btn(page, '메모').click();
  await page.getByRole('textbox', { name: '메모' }).fill('정렬 버튼을 한참 찾음');
  await btn(page, '남기기').click();
  await shot(page, 'test-home-rent-only');
  await btn(page, '2곳 고르기').click();
  await page.getByRole('button', { name: /태평동 투룸/ }).click();
  await page.getByRole('button', { name: /신흥 오피스텔/ }).click();
  await page.getByLabel('고른 이유').fill('월세가 싸서');
  await shot(page, 'test-pick');
  await btn(page, '선택 완료').click();
  await page.getByText('이번에는 월 총 주거비를 보고 다시 2곳을 골라 주세요').waitFor();
  await btn(page, '2곳 고르기').click();
  await page.getByRole('button', { name: /정문 앞 원룸/ }).click();
  await page.getByRole('button', { name: /태평동 투룸/ }).click();
  await page.getByLabel('고른 이유').fill('통학비까지 더하니 정문 앞이 싸요');
  await btn(page, '선택 완료').click();
  await page.getByText('P1 테스트를 마쳤어요').waitFor();
  check(await page.getByText('바뀌었어요').isVisible(), '선택 변화 기록');
  await shot(page, 'test-result', true);
  const [csvDl] = await Promise.all([page.waitForEvent('download'), btn(page, 'CSV로 내려받기').click()]);
  const csv = await readFile(await csvDl.path(), 'utf8');
  check(csv.startsWith('﻿참가자') && csv.includes('P1') && csv.includes('태평동 투룸 / 신흥 오피스텔'), 'CSV 내용');

  // 기존 방법 조건
  await btn(page, '다음 참가자 준비하기').click();
  await page.getByLabel('참가자').fill('P2');
  await page.getByRole('radiogroup', { name: '방법' }).getByRole('radio', { name: '기존 방법으로' }).click();
  await btn(page, '테스트 시작하기').click();
  await page.getByText('지도 앱과 메모로').waitFor();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /도움 요청 \+1/ }).click();
  await page.getByLabel('고른 방').fill('A, C');
  await shot(page, 'baseline');
  await btn(page, '측정 끝내기').click();
  await page.getByText('P2 테스트를 마쳤어요').waitFor();
  await page.getByRole('button', { name: '뒤로 가기' }).click();
  await page.getByText('P1 · 1차 · 한눈방').waitFor();
  await shot(page, 'test-results');

  console.log(`e2e 통과: 화면 ${step}장 → ${shotsDir}`);
} catch (e) {
  console.error(e);
  problems.push(String(e.message ?? e));
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}

if (problems.length) {
  console.error(`\n문제 ${problems.length}개:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
