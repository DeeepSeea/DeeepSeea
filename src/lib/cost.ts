import type { Candidate, CostMode, FareType, Settings } from '../types';

/** 교통카드 성인 요금. 경기 일반형 시내버스는 2025.10.25, 수도권 지하철 기본요금은 2025.6.28 조정분 */
export const FARE_PRESETS: Record<Exclude<FareType, 'custom'>, { label: string; won: number }> = {
  bus: { label: '경기 시내버스', won: 1650 },
  subway: { label: '수도권 지하철', won: 1550 },
};

/** 주당 통학 일수 → 한 달 통학 일수(1년 52주 기준) */
export function monthlyCommuteDays(daysPerWeek: number): number {
  return Math.round((daysPerWeek * 52) / 12);
}

export function usesTransit(c: Candidate, s: Settings): boolean {
  if (c.commuteMode === 'walk') return false;
  if (c.commuteMode === 'transit') return true;
  const schoolMin = c.infra.school?.walkMin;
  // 학교까지 시간을 모르면 교통비를 넣지 않는다. 화면에는 '학교 거리 정보 없음'으로 보인다
  return schoolMin !== undefined && schoolMin > s.walkLimitMin;
}

/** 월 통학 교통비 = 왕복 요금 × 한 달 통학 일수 */
export function monthlyCommuteCost(c: Candidate, s: Settings): number {
  return usesTransit(c, s) ? s.oneWayFare * 2 * monthlyCommuteDays(s.commuteDaysPerWeek) : 0;
}

/** 월 총 주거비 = 월세 + 관리비 + 통학 교통비 */
export function monthlyTotalCost(c: Candidate, s: Settings): number {
  return c.monthlyRent + c.maintenanceFee + monthlyCommuteCost(c, s);
}

/** 비교 기준 금액. 'rentOnly'는 기존 부동산 앱처럼 월세와 관리비만 본다 */
export function costBasis(c: Candidate, s: Settings, mode: CostMode): number {
  return mode === 'total' ? monthlyTotalCost(c, s) : c.monthlyRent + c.maintenanceFee;
}

export const COST_LABEL: Record<CostMode, string> = {
  total: '월 총 주거비',
  rentOnly: '월세+관리비',
};
