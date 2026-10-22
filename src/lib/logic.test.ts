import { describe, expect, it } from 'vitest';
import type { Candidate, Settings, TestSession } from '../types';
import { formatClock, formatDuration, formatWon, josa, manwonToWon, wonToManwonInput } from './format';
import { estimateWalkMin, haversineM } from './geo';
import { costBasis, monthlyCommuteCost, monthlyCommuteDays, monthlyTotalCost, usesTransit } from './cost';
import { conditionScore, costScoreOf, infraScore, scoreCandidates, sortScored } from './score';
import { DEFAULT_SETTINGS, normalizeCandidate, normalizeSettings } from './storage';
import { parseBackup } from './backup';
import { sessionsToCsv, summarize } from './testExport';
import { rentPercentile } from './rentStats';
import { match } from '../router';

const settings: Settings = { ...DEFAULT_SETTINGS, onboarded: true };

function cand(over: Partial<Candidate> & { id: string }): Candidate {
  return {
    name: over.id,
    address: '',
    houseType: 'dagagu',
    deposit: 5_000_000,
    monthlyRent: 450_000,
    maintenanceFee: 50_000,
    commuteMode: 'auto',
    infra: {},
    field: { photoIds: [] },
    createdAt: 1,
    updatedAt: 1,
    ...over,
  };
}

describe('format', () => {
  it('금액을 만원·억 단위로 읽기 쉽게 쓴다', () => {
    expect(formatWon(0)).toBe('0원');
    expect(formatWon(1650)).toBe('1,650원');
    expect(formatWon(450_000)).toBe('45만원');
    expect(formatWon(455_000)).toBe('45만 5,000원');
    expect(formatWon(10_000_000)).toBe('1,000만원');
    expect(formatWon(130_000_000)).toBe('1억 3,000만원');
    expect(formatWon(100_000_000)).toBe('1억원');
  });

  it('만원 입력을 원으로 바꾸고 되돌린다', () => {
    expect(manwonToWon('45')).toBe(450_000);
    expect(manwonToWon('4.5')).toBe(45_000);
    expect(manwonToWon('1,000')).toBe(10_000_000);
    expect(manwonToWon('')).toBe(0);
    expect(manwonToWon('abc')).toBe(0);
    expect(wonToManwonInput(455_000)).toBe('45.5');
    expect(wonToManwonInput(0)).toBe('');
  });

  it('받침에 맞는 조사를 고른다', () => {
    expect(josa('정문 앞 원룸', '이', '가')).toBe('이');
    expect(josa('복정동 투룸', '이', '가')).toBe('이');
    expect(josa('태평동 빌라', '이', '가')).toBe('가');
    expect(josa('후보 3', '이', '가')).toBe('이');
    expect(josa('후보 2', '이', '가')).toBe('가');
    expect(josa('Room A', '이', '가')).toBe('이(가)');
  });

  it('시간을 읽기 쉽게 쓴다', () => {
    expect(formatDuration(192_000)).toBe('3분 12초');
    expect(formatDuration(45_000)).toBe('45초');
    expect(formatClock(192_000)).toBe('03:12');
  });
});

describe('geo', () => {
  it('직선 거리와 도보 시간을 어림한다', () => {
    const d = haversineM({ lat: 37.4508, lng: 127.1274 }, { lat: 37.4553, lng: 127.1274 });
    expect(d).toBeGreaterThan(480);
    expect(d).toBeLessThan(520);
    expect(estimateWalkMin(500)).toBe(10);
    expect(estimateWalkMin(0)).toBe(1);
  });
});

describe('cost', () => {
  it('주 5일 통학은 한 달 22일로 본다', () => {
    expect(monthlyCommuteDays(5)).toBe(22);
    expect(monthlyCommuteDays(3)).toBe(13);
  });

  it('학교까지 기준보다 멀면 통학 교통비를 더한다', () => {
    const near = cand({ id: 'near', infra: { school: { name: '학교', walkMin: 8, source: 'auto' } } });
    const far = cand({ id: 'far', infra: { school: { name: '학교', walkMin: 25, source: 'auto' } } });
    const unknown = cand({ id: 'unknown' });
    expect(usesTransit(near, settings)).toBe(false);
    expect(usesTransit(far, settings)).toBe(true);
    expect(usesTransit(unknown, settings)).toBe(false);
    expect(monthlyCommuteCost(far, settings)).toBe(1650 * 2 * 22);
    expect(monthlyTotalCost(far, settings)).toBe(450_000 + 50_000 + 72_600);
    expect(costBasis(far, settings, 'rentOnly')).toBe(500_000);
  });

  it('통학 방법을 직접 고르면 그대로 따른다', () => {
    const c = cand({ id: 'x', commuteMode: 'transit' });
    expect(monthlyCommuteCost(c, settings)).toBe(72_600);
    expect(monthlyCommuteCost({ ...c, commuteMode: 'walk', infra: { school: { name: '', walkMin: 40, source: 'auto' } } }, settings)).toBe(0);
  });
});

describe('score', () => {
  it('도보 시간 기준에 따라 0~100점을 매긴다', () => {
    expect(infraScore('school', 5)).toBe(100);
    expect(infraScore('school', 30)).toBe(0);
    expect(infraScore('school', 17.5)).toBe(50);
    expect(infraScore('bus', undefined)).toBeNull();
  });

  it('가장 싼 후보보다 1% 비쌀 때마다 2점씩 깎는다', () => {
    expect(costScoreOf(500_000, 500_000)).toBe(100);
    expect(costScoreOf(550_000, 500_000)).toBe(80);
    expect(costScoreOf(800_000, 500_000)).toBe(0);
  });

  it('방 상태는 기록한 항목만 평균 낸다', () => {
    expect(conditionScore({ photoIds: [] })).toBeNull();
    expect(conditionScore({ photoIds: [], windowDirection: '남', mold: 'none' })).toBe(100);
    expect(conditionScore({ photoIds: [], windowDirection: '북', quietness: 1 })).toBe(0);
    expect(conditionScore({ photoIds: [], crossVentilation: false, windowCount: 2, waterPressure: 3 })).toBe(50);
  });

  it('정보가 없는 항목은 점수에서 빼고 순위를 매긴다', () => {
    const a = cand({ id: 'a', monthlyRent: 400_000, infra: { school: { name: '', walkMin: 5, source: 'auto' } } });
    const b = cand({ id: 'b', monthlyRent: 500_000, infra: { school: { name: '', walkMin: 25, source: 'auto' } } });
    const s: Settings = { ...settings, weights: { cost: 3, school: 3, bus: 0, subway: 0, mart: 0, convenience: 0, park: 0, condition: 2 } };
    const [first, second] = scoreCandidates([b, a], s);
    expect(first.candidate.id).toBe('a');
    expect(first.rank).toBe(1);
    expect(first.total).toBe(100);
    expect(first.missing).toEqual(['condition']);
    expect(second.rank).toBe(2);
    expect(sortScored([first, second], 'cost')[0].candidate.id).toBe('a');
  });

  it('중요도를 모두 0으로 고르면 점수가 없다', () => {
    const zero: Settings = { ...settings, weights: { cost: 0, school: 0, bus: 0, subway: 0, mart: 0, convenience: 0, park: 0, condition: 0 } };
    expect(scoreCandidates([cand({ id: 'a' })], zero)[0].total).toBeNull();
  });
});

describe('storage normalize', () => {
  it('깨진 후보 데이터를 고치거나 버린다', () => {
    expect(normalizeCandidate(null)).toBeNull();
    expect(normalizeCandidate({ name: 'id 없음' })).toBeNull();
    const c = normalizeCandidate({ id: 'x', monthlyRent: -5, field: { photoIds: ['p1', 3], waterPressure: 9 }, infra: { bus: { walkMin: 3.6 }, park: { walkMin: 'a' } } });
    expect(c?.monthlyRent).toBe(0);
    expect(c?.field.photoIds).toEqual(['p1']);
    expect(c?.field.waterPressure).toBeUndefined();
    expect(c?.infra.bus?.walkMin).toBe(4);
    expect(c?.infra.park).toBeUndefined();
    expect(c?.houseType).toBe('unknown');
  });

  it('설정의 빈 값은 기본값으로 채운다', () => {
    const s = normalizeSettings({ weights: { cost: 7 } as unknown as Settings['weights'], fareType: 'subway' });
    expect(s.weights.cost).toBe(DEFAULT_SETTINGS.weights.cost);
    expect(s.fareType).toBe('subway');
    expect(s.school).toEqual(DEFAULT_SETTINGS.school);
  });
});

describe('backup', () => {
  it('한눈방 파일이 아니면 알아듣게 거절한다', () => {
    expect(() => parseBackup('not json')).toThrow('JSON');
    expect(() => parseBackup('{"app":"other","candidates":[]}')).toThrow('한눈방에서 내려받은');
    expect(() => parseBackup('{"app":"hannunbang","version":99,"candidates":[]}')).toThrow('새로운');
  });

  it('후보와 사진을 읽어 온다', () => {
    const file = parseBackup(
      JSON.stringify({
        app: 'hannunbang',
        version: 1,
        settings: { weights: { cost: 1 } },
        candidates: [{ id: 'a', name: 'A', field: { photoIds: ['p'] } }, { bad: true }],
        photos: { p: 'data:image/jpeg;base64,AAAA', q: 'javascript:alert(1)' },
      }),
    );
    expect(file.candidates).toHaveLength(1);
    expect(file.settings.weights.cost).toBe(1);
    expect(Object.keys(file.photos)).toEqual(['p']);
  });
});

describe('test export', () => {
  const session: TestSession = {
    id: 's',
    participant: 'P1',
    round: 1,
    method: 'app',
    rentFirst: true,
    startedAt: 1_000,
    endedAt: 301_000,
    phase: 'total',
    helpCount: 2,
    notes: [{ at: 50_000, screen: '홈', text: '추가 버튼을 "못" 찾음, 잠시 멈춤' }],
    events: [
      { at: 1_000, type: 'start' },
      { at: 2_000, type: 'screen', detail: '홈' },
      { at: 3_000, type: 'candidate:add', detail: 'A' },
    ],
    picks: [
      { phase: 'rentOnly', at: 121_000, candidateIds: ['a', 'b'], names: ['A', 'B'], reason: '싸서' },
      { phase: 'total', at: 241_000, candidateIds: ['c', 'a'], names: ['C', 'A'], reason: '교통비까지 보니' },
    ],
  };

  it('걸린 시간과 선택 변화를 요약한다', () => {
    const m = summarize(session);
    expect(m.totalMs).toBe(300_000);
    expect(m.firstPickMs).toBe(120_000);
    expect(m.changed).toBe(true);
    expect(m.candidatesAdded).toBe(1);
  });

  it('엑셀용 CSV는 BOM과 따옴표 처리를 한다', () => {
    const csv = sessionsToCsv([session]);
    expect(csv.startsWith('﻿참가자,')).toBe(true);
    expect(csv).toContain('"[홈] 추가 버튼을 ""못"" 찾음, 잠시 멈춤"');
    expect(csv).toContain(',300,120,2,1,1,');
  });
});

describe('rent percentile', () => {
  it('10분위 사이를 보간해 하위 몇 %인지 어림한다', () => {
    const d = [30, 35, 38, 40, 45, 48, 50, 55, 60];
    expect(rentPercentile(45, d)).toBe(50);
    expect(rentPercentile(42.5, d)).toBe(45);
    expect(rentPercentile(70, d)).toBe(95);
    expect(rentPercentile(15, d)).toBe(5);
  });
});

describe('router', () => {
  it('경로 패턴에서 값을 꺼낸다', () => {
    expect(match('/c/:id', '/c/abc')).toEqual({ id: 'abc' });
    expect(match('/c/:id/record', '/c/abc/record')).toEqual({ id: 'abc' });
    expect(match('/c/:id', '/c/abc/record')).toBeNull();
    expect(match('/compare', '/compare')).toEqual({});
  });
});
