#!/usr/bin/env node
/* public/favicon.svg로 홈 화면 아이콘 PNG를 만든다. 아이콘을 바꿨을 때만 다시 실행한다: node scripts/make-icons.mjs */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const pub = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const svg = await readFile(resolve(pub, 'favicon.svg'), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();

// iOS는 투명 영역을 검게 칠하므로 둥근 모서리 없이 꽉 찬 사각형으로 그린다
const square = svg.replace(/rx="\d+"/, 'rx="0"');
for (const [name, size] of [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${square}`);
  await page.screenshot({ path: resolve(pub, name), omitBackground: false });
  console.log(`${name} ${size}px`);
}
await browser.close();
