import type { LatLng } from '../types';

/** 성인 평균 보행 속도 약 4km/h */
export const WALK_M_PER_MIN = 67;
/** 실제 도보 경로는 직선보다 길다. 도시 지역에서 흔히 쓰는 우회 계수 */
export const DETOUR_FACTOR = 1.3;

export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 직선 거리(m) → 추정 도보 시간(분, 올림) */
export function estimateWalkMin(straightM: number): number {
  return Math.max(1, Math.ceil((straightM * DETOUR_FACTOR) / WALK_M_PER_MIN));
}
