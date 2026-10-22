import { useEffect, useState } from 'react';
import type { HouseType } from '../types';

/** scripts/fetch-rent-stats.mjs가 만드는 public/rent-stats.json 형식. 금액은 만원 단위 */
export interface RentStat {
  dong: string;
  type: Exclude<HouseType, 'unknown'>;
  count: number;
  rent: { p25: number; p50: number; p75: number };
  /** 월세 10, 20, … 90 백분위 */
  rentDeciles: number[];
  deposit: { p25: number; p50: number; p75: number };
}

export interface RentStatsFile {
  generatedAt: string;
  period: { from: string; to: string };
  region: string;
  source: string;
  stats: RentStat[];
}

type State = { status: 'loading' } | { status: 'none' } | { status: 'ready'; data: RentStatsFile };

let cache: Promise<RentStatsFile | null> | null = null;

function fetchStats(): Promise<RentStatsFile | null> {
  cache ??= fetch(`${import.meta.env.BASE_URL}rent-stats.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? (r.json() as Promise<RentStatsFile>) : null))
    .then((d) => (d && Array.isArray(d.stats) && d.stats.length > 0 ? d : null))
    .catch(() => null);
  return cache;
}

export function useRentStats(): State {
  const [state, setState] = useState<State>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    fetchStats().then((d) => alive && setState(d ? { status: 'ready', data: d } : { status: 'none' }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

export function findStat(file: RentStatsFile, dong: string | undefined, type: HouseType): RentStat | undefined {
  if (!dong || type === 'unknown') return undefined;
  return file.stats.find((s) => s.dong === dong && s.type === type);
}

/** 월세(만원)가 동 실거래 월세 중 아래에서 몇 % 자리인지 어림한다(10분위 사이는 직선 보간) */
export function rentPercentile(rentManwon: number, deciles: number[]): number {
  if (deciles.length !== 9) return 50;
  if (rentManwon <= deciles[0]) return Math.max(1, Math.round((rentManwon / Math.max(deciles[0], 1)) * 10));
  if (rentManwon >= deciles[8]) return 95;
  for (let i = 0; i < 8; i++) {
    const lo = deciles[i];
    const hi = deciles[i + 1];
    if (rentManwon <= hi) {
      const t = hi === lo ? 0.5 : (rentManwon - lo) / (hi - lo);
      return Math.round((i + 1) * 10 + t * 10);
    }
  }
  return 95;
}

export function percentileWord(p: number): string {
  if (p < 35) return '낮은 편';
  if (p <= 65) return '중간쯤';
  return '높은 편';
}

/** 'YYYY-MM' → 'YYYY년 M월' */
export function formatYm(ym: string): string {
  const [y, m] = ym.split('-');
  return `${y}년 ${Number(m)}월`;
}
