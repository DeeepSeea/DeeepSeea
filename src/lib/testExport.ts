import type { TestPick, TestSession } from '../types';

export interface SessionSummary {
  totalMs: number | null;
  firstPickMs: number | null;
  rentOnly?: TestPick;
  total?: TestPick;
  /** 월세만 보고 고른 방과 총 주거비를 보고 고른 방이 달라졌는지(가정 5). 비교할 수 없으면 null */
  changed: boolean | null;
  candidatesAdded: number;
  screens: number;
}

export function summarize(s: TestSession): SessionSummary {
  const rentOnly = s.picks.find((p) => p.phase === 'rentOnly');
  const total = [...s.picks].reverse().find((p) => p.phase === 'total');
  let changed: boolean | null = null;
  if (rentOnly && total) {
    const a = [...rentOnly.candidateIds].sort().join();
    const b = [...total.candidateIds].sort().join();
    changed = a !== b;
  }
  return {
    totalMs: s.endedAt ? s.endedAt - s.startedAt : null,
    firstPickMs: s.picks[0] ? s.picks[0].at - s.startedAt : null,
    rentOnly,
    total,
    changed,
    candidatesAdded: s.events.filter((e) => e.type === 'candidate:add').length,
    screens: s.events.filter((e) => e.type === 'screen').length,
  };
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const sec = (ms: number | null) => (ms === null ? '' : Math.round(ms / 1000));

export const CSV_HEADER = [
  '참가자',
  '회차',
  '방법',
  '월세 먼저 보기',
  '시작 시각',
  '전체 걸린 시간(초)',
  '첫 선택까지(초)',
  '도움 요청 횟수',
  '추가한 후보 수',
  '화면 이동 수',
  '월세만 보고 고른 방',
  '월세만 보고 고른 이유',
  '총 주거비 보고 고른 방',
  '총 주거비 보고 고른 이유',
  '선택이 바뀌었나',
  '중간에 그만둠',
  '진행자 메모',
];

/** 엑셀에서 한글이 깨지지 않도록 BOM을 붙인 CSV */
export function sessionsToCsv(sessions: TestSession[]): string {
  const rows = sessions.map((s) => {
    const m = summarize(s);
    return [
      s.participant,
      `${s.round}차`,
      s.method === 'app' ? '한눈방' : '기존 방법',
      s.rentFirst ? '예' : '아니요',
      new Date(s.startedAt).toLocaleString('ko-KR'),
      sec(m.totalMs),
      sec(m.firstPickMs),
      s.helpCount,
      m.candidatesAdded,
      m.screens,
      m.rentOnly?.names.join(' / ') ?? '',
      m.rentOnly?.reason ?? '',
      m.total?.names.join(' / ') ?? '',
      m.total?.reason ?? '',
      m.changed === null ? '' : m.changed ? '예' : '아니요',
      s.aborted ? '예' : '',
      s.notes.map((n) => `[${n.screen}] ${n.text}`).join(' | '),
    ]
      .map(csvCell)
      .join(',');
  });
  return `﻿${[CSV_HEADER.join(','), ...rows].join('\r\n')}`;
}

/** 해시 경로를 사람이 읽는 화면 이름으로 */
export function screenName(path: string): string {
  if (path === '/' || path === '') return '홈';
  if (path.startsWith('/welcome')) return '처음 화면';
  if (path === '/add') return '후보 추가';
  if (/^\/c\/[^/]+\/edit$/.test(path)) return '후보 수정';
  if (/^\/c\/[^/]+\/record$/.test(path)) return '현장 기록';
  if (/^\/c\/[^/]+$/.test(path)) return '후보 상세';
  if (path === '/compare') return '비교표';
  if (path === '/settings') return '설정';
  if (path.startsWith('/test')) return '테스트';
  return path;
}
