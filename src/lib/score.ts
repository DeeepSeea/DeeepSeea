import {
  CRITERIA,
  INFRA_KEYS,
  type Candidate,
  type CostMode,
  type CriterionKey,
  type FieldRecord,
  type InfraKey,
  type MoldLevel,
  type Settings,
  type WindowDirection,
} from '../types';
import { costBasis } from './cost';

/**
 * 항목별 도보 시간 기준(분). good 이하면 100점, bad 이상이면 0점, 사이는 직선으로 깎는다.
 * 설정 화면에 그대로 보여 주어 점수가 어떻게 나왔는지 설명할 수 있게 한다.
 */
export const INFRA_THRESHOLDS: Record<InfraKey, { good: number; bad: number }> = {
  school: { good: 5, bad: 30 },
  bus: { good: 2, bad: 10 },
  subway: { good: 5, bad: 25 },
  mart: { good: 5, bad: 20 },
  convenience: { good: 1, bad: 8 },
  park: { good: 3, bad: 15 },
};

/** 가장 싼 후보보다 1% 비쌀 때마다 깎는 점수 */
export const COST_POINTS_PER_PERCENT = 2;

export function infraScore(key: InfraKey, walkMin: number | undefined): number | null {
  if (walkMin === undefined) return null;
  const { good, bad } = INFRA_THRESHOLDS[key];
  if (walkMin <= good) return 100;
  if (walkMin >= bad) return 0;
  return Math.round((100 * (bad - walkMin)) / (bad - good));
}

export const DIRECTION_SCORE: Record<WindowDirection, number> = {
  남: 5,
  남동: 4,
  남서: 4,
  동: 3,
  서: 3,
  북동: 2,
  북서: 2,
  북: 1,
};

export const MOLD_SCORE: Record<MoldLevel, number> = { none: 5, some: 3, lots: 1 };
export const MOLD_LABEL: Record<MoldLevel, string> = { none: '없어요', some: '조금 있어요', lots: '많아요' };

export function ventilationScore(f: FieldRecord): number | undefined {
  if (f.crossVentilation === undefined && f.windowCount === undefined) return undefined;
  if (f.crossVentilation) return 5;
  const n = f.windowCount ?? 0;
  return n >= 2 ? 3 : n === 1 ? 2 : 1;
}

export interface ConditionPart {
  key: 'light' | 'air' | 'water' | 'mold' | 'noise';
  label: string;
  value: number;
}

/** 현장 기록 항목별 1~5점. 기록하지 않은 항목은 빠진다 */
export function conditionParts(f: FieldRecord): ConditionPart[] {
  const parts: ConditionPart[] = [];
  if (f.windowDirection) parts.push({ key: 'light', label: '채광', value: DIRECTION_SCORE[f.windowDirection] });
  const air = ventilationScore(f);
  if (air !== undefined) parts.push({ key: 'air', label: '환기', value: air });
  if (f.waterPressure !== undefined) parts.push({ key: 'water', label: '수압', value: f.waterPressure });
  if (f.mold) parts.push({ key: 'mold', label: '곰팡이', value: MOLD_SCORE[f.mold] });
  if (f.quietness !== undefined) parts.push({ key: 'noise', label: '소음', value: f.quietness });
  return parts;
}

/** 방 상태 점수(0~100). 기록이 하나도 없으면 null */
export function conditionScore(f: FieldRecord): number | null {
  const parts = conditionParts(f);
  if (parts.length === 0) return null;
  const avg = parts.reduce((s, p) => s + p.value, 0) / parts.length;
  return Math.round(((avg - 1) / 4) * 100);
}

/** 가장 싼 후보 100점. 그보다 1% 비쌀 때마다 2점씩 깎는다(50% 비싸면 0점) */
export function costScoreOf(cost: number, cheapest: number): number {
  const base = Math.max(cheapest, 1);
  const overPercent = ((cost - cheapest) / base) * 100;
  return Math.max(0, Math.min(100, Math.round(100 - overPercent * COST_POINTS_PER_PERCENT)));
}

export interface Scored {
  candidate: Candidate;
  /** 비교 기준 금액(월 총 주거비 또는 월세+관리비) */
  cost: number;
  /** 0~100. 반영할 항목이 하나도 없으면 null */
  total: number | null;
  parts: Record<CriterionKey, number | null>;
  /** 중요도가 0보다 큰데 정보가 없어 점수에서 빠진 항목 */
  missing: CriterionKey[];
  /** 점수 순위(1부터) */
  rank: number;
}

export function scoreCandidates(cands: Candidate[], s: Settings, mode: CostMode = 'total'): Scored[] {
  if (cands.length === 0) return [];
  const costs = cands.map((c) => costBasis(c, s, mode));
  const cheapest = Math.min(...costs);

  const scored = cands.map((c, i) => {
    const parts = {} as Record<CriterionKey, number | null>;
    for (const k of INFRA_KEYS) parts[k] = infraScore(k, c.infra[k]?.walkMin);
    parts.cost = costScoreOf(costs[i], cheapest);
    parts.condition = conditionScore(c.field);

    let sum = 0;
    let wsum = 0;
    const missing: CriterionKey[] = [];
    for (const k of CRITERIA) {
      const w = s.weights[k];
      const v = parts[k];
      if (w <= 0) continue;
      // 모르는 항목은 0점으로 치지 않고 빼서, 기록을 덜 한 후보가 무조건 불리해지지 않게 한다
      if (v === null) {
        missing.push(k);
        continue;
      }
      sum += w * v;
      wsum += w;
    }
    return { candidate: c, cost: costs[i], total: wsum === 0 ? null : Math.round(sum / wsum), parts, missing, rank: 0 };
  });

  const byScore = [...scored].sort(compareByScore);
  byScore.forEach((x, i) => (x.rank = i + 1));
  return byScore;
}

/** 점수 높은 순. 같으면 싼 순, 그것도 같으면 먼저 넣은 순 */
export function compareByScore(a: Scored, b: Scored): number {
  const at = a.total ?? -1;
  const bt = b.total ?? -1;
  if (at !== bt) return bt - at;
  if (a.cost !== b.cost) return a.cost - b.cost;
  return a.candidate.createdAt - b.candidate.createdAt;
}

export type SortKey = 'score' | 'cost' | 'school';

export function sortScored(list: Scored[], key: SortKey): Scored[] {
  const copy = [...list];
  if (key === 'score') return copy.sort(compareByScore);
  if (key === 'cost') return copy.sort((a, b) => a.cost - b.cost || compareByScore(a, b));
  const school = (x: Scored) => x.candidate.infra.school?.walkMin ?? Number.POSITIVE_INFINITY;
  return copy.sort((a, b) => school(a) - school(b) || compareByScore(a, b));
}
