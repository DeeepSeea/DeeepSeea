#!/usr/bin/env node
/*
 * 배포된 사이트에서 실제 카카오 지도로 후보를 하나 추가해 본다(배포 뒤 GitHub Actions에서 실행).
 *   SITE_URL=https://deeepseea.github.io/DeeepSeea/ node e2e/smoke.mjs
 */
import { chromium } from 'playwright';

const url = process.env.SITE_URL ?? 'https://deeepseea.github.io/DeeepSeea/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
await ctx.addInitScript(() => localStorage.setItem('hannunbang.settings.v1', JSON.stringify({ onboarded: true })));
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => m.type() === 'error' && logs.push(m.text()));
page.on('response', (r) => r.url().includes('kakao') && r.status() >= 400 && logs.push(`${r.status()} ${r.url()}`));

let ok = false;
try {
  await page.goto(url);
  await page.getByRole('button', { name: '후보 추가하기' }).click();
  await page.getByLabel('위치', { exact: true }).fill('성남대로 1342');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  const results = page.getByRole('list', { name: '검색 결과' });
  await results.waitFor({ timeout: 20000 });
  console.log('검색 결과:', (await results.getByRole('button').allInnerTexts()).slice(0, 3));
  await results.getByRole('button').first().click();
  await page.getByLabel('월세', { exact: true }).fill('45');
  await page.getByRole('button', { name: '추가하기', exact: true }).click();
  await page.getByText(/걸어서 \d+분/).first().waitFor({ timeout: 30000 });
  const rows = await page.locator('ul .list-row').allInnerTexts();
  console.log('인프라 계산 결과:\n' + rows.map((r) => '  ' + r.replace(/\n+/g, ' | ')).join('\n'));
  ok = true;
} catch (e) {
  console.error('실패:', e.message);
  await page.screenshot({ path: 'e2e/screenshots/smoke-fail.png', fullPage: true }).catch(() => {});
}
if (logs.length) console.log('오류 기록:\n' + logs.join('\n'));
await browser.close();
process.exit(ok ? 0 : 1);
