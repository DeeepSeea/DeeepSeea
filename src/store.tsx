import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Candidate, CostMode, Settings, TestPhase, TestSession } from './types';
import {
  loadActiveTest,
  loadCandidates,
  loadSessions,
  loadSettings,
  newId,
  saveActiveTest,
  saveCandidates,
  saveSessions,
  saveSettings,
} from './lib/storage';

export interface StartTestOptions {
  participant: string;
  round: 1 | 2;
  method: 'app' | 'baseline';
  rentFirst: boolean;
}

type CandidatePatch = Partial<Candidate> | ((current: Candidate) => Partial<Candidate>);

interface Store {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  candidates: Candidate[];
  addCandidate: (c: Candidate) => void;
  /** 비동기 작업 뒤에 고칠 때는 최신 값을 받는 함수 형태로 넘긴다 */
  updateCandidate: (id: string, patch: CandidatePatch, logType?: string) => void;
  removeCandidate: (id: string) => void;
  replaceCandidates: (list: Candidate[]) => void;
  /** 배포 설정의 키가 있으면 그것을, 없으면 사용자가 넣은 키를 쓴다 */
  kakaoKey: string;
  kakaoKeyFromEnv: boolean;
  /** 테스트 중 '월세만 보기' 단계면 'rentOnly' */
  costMode: CostMode;
  test: TestSession | null;
  sessions: TestSession[];
  startTest: (o: StartTestOptions) => TestSession;
  logEvent: (type: string, detail?: string) => void;
  addHelp: () => void;
  addNote: (text: string, screen: string) => void;
  /** 마지막 선택이면 테스트를 끝내고 저장한 기록을 돌려준다 */
  submitPicks: (phase: TestPhase, candidateIds: string[], names: string[], reason: string) => { status: 'next' } | { status: 'done'; session: TestSession } | { status: 'none' };
  finishTest: (aborted?: boolean) => TestSession | null;
  removeSessions: (ids?: string[]) => void;
}

const StoreContext = createContext<Store | null>(null);

const ENV_KAKAO_KEY = ((import.meta.env.VITE_KAKAO_JS_KEY as string | undefined) ?? '').trim();

export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [candidates, setCandidates] = useState<Candidate[]>(loadCandidates);
  const [test, setTest] = useState<TestSession | null>(loadActiveTest);
  const [sessions, setSessions] = useState<TestSession[]>(loadSessions);

  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveCandidates(candidates), [candidates]);
  useEffect(() => saveActiveTest(test), [test]);
  useEffect(() => saveSessions(sessions), [sessions]);

  // 이벤트 기록은 테스트 중일 때만 쌓는다. 같은 종류가 3초 안에 이어지면 하나로 본다(현장 기록 자동 저장 등)
  const lastEvent = useRef<{ type: string; detail?: string; at: number } | null>(null);
  const logEvent = useCallback((type: string, detail?: string) => {
    const now = Date.now();
    const prev = lastEvent.current;
    if (prev && prev.type === type && prev.detail === detail && now - prev.at < 3000) return;
    lastEvent.current = { type, detail, at: now };
    setTest((t) => (t ? { ...t, events: [...t.events, { at: now, type, detail }] } : t));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);

  const addCandidate = useCallback(
    (c: Candidate) => {
      setCandidates((cs) => [...cs, c]);
      logEvent('candidate:add', c.name);
    },
    [logEvent],
  );

  // 기록에 후보 이름을 남기려고 최신 목록을 ref로도 들고 있는다
  const candidatesRef = useRef(candidates);
  candidatesRef.current = candidates;
  const nameOf = (id: string) => candidatesRef.current.find((c) => c.id === id)?.name ?? id;

  const updateCandidate = useCallback(
    (id: string, patch: CandidatePatch, logType = 'candidate:edit') => {
      setCandidates((cs) =>
        cs.map((c) => (c.id === id ? { ...c, ...(typeof patch === 'function' ? patch(c) : patch), updatedAt: Date.now() } : c)),
      );
      logEvent(logType, nameOf(id));
    },
    [logEvent],
  );

  const removeCandidate = useCallback(
    (id: string) => {
      logEvent('candidate:remove', nameOf(id));
      setCandidates((cs) => cs.filter((c) => c.id !== id));
    },
    [logEvent],
  );

  const replaceCandidates = useCallback((list: Candidate[]) => setCandidates(list), []);

  const startTest = useCallback((o: StartTestOptions) => {
    const now = Date.now();
    const session: TestSession = {
      id: newId(),
      participant: o.participant.trim() || '참가자',
      round: o.round,
      method: o.method,
      rentFirst: o.method === 'app' && o.rentFirst,
      startedAt: now,
      phase: o.method === 'app' && o.rentFirst ? 'rentOnly' : 'total',
      helpCount: 0,
      notes: [],
      events: [{ at: now, type: 'start' }],
      picks: [],
    };
    lastEvent.current = null;
    setTest(session);
    return session;
  }, []);

  const addHelp = useCallback(() => {
    const now = Date.now();
    setTest((t) => (t ? { ...t, helpCount: t.helpCount + 1, events: [...t.events, { at: now, type: 'help' }] } : t));
  }, []);

  const addNote = useCallback((text: string, screen: string) => {
    const now = Date.now();
    setTest((t) => (t ? { ...t, notes: [...t.notes, { at: now, screen, text }], events: [...t.events, { at: now, type: 'note', detail: screen }] } : t));
  }, []);

  const finishTest = useCallback(
    (aborted = false) => {
      if (!test) return null;
      const now = Date.now();
      const done: TestSession = { ...test, endedAt: now, aborted: aborted || undefined, events: [...test.events, { at: now, type: aborted ? 'abort' : 'end' }] };
      setSessions((s) => [...s, done]);
      setTest(null);
      return done;
    },
    [test],
  );

  const submitPicks = useCallback<Store['submitPicks']>(
    (phase, candidateIds, names, reason) => {
      if (!test) return { status: 'none' };
      const now = Date.now();
      const picked: TestSession = {
        ...test,
        picks: [...test.picks, { phase, at: now, candidateIds, names, reason }],
        events: [...test.events, { at: now, type: 'pick', detail: phase }],
      };
      if (phase === 'rentOnly' && test.rentFirst) {
        setTest({ ...picked, phase: 'total' });
        return { status: 'next' };
      }
      // 같은 틱에 finishTest를 부르면 방금 넣은 선택이 빠지므로 여기서 바로 끝낸다
      const done: TestSession = { ...picked, endedAt: now, events: [...picked.events, { at: now, type: 'end' }] };
      setSessions((s) => [...s, done]);
      setTest(null);
      return { status: 'done', session: done };
    },
    [test],
  );

  const removeSessions = useCallback((ids?: string[]) => setSessions((s) => (ids ? s.filter((x) => !ids.includes(x.id)) : [])), []);

  const value = useMemo<Store>(
    () => ({
      settings,
      updateSettings,
      candidates,
      addCandidate,
      updateCandidate,
      removeCandidate,
      replaceCandidates,
      kakaoKey: ENV_KAKAO_KEY || settings.kakaoKey,
      kakaoKeyFromEnv: !!ENV_KAKAO_KEY,
      costMode: test && test.method === 'app' && test.phase === 'rentOnly' ? 'rentOnly' : 'total',
      test,
      sessions,
      startTest,
      logEvent,
      addHelp,
      addNote,
      submitPicks,
      finishTest,
      removeSessions,
    }),
    [settings, updateSettings, candidates, addCandidate, updateCandidate, removeCandidate, replaceCandidates, test, sessions, startTest, logEvent, addHelp, addNote, submitPicks, finishTest, removeSessions],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('StoreProvider 밖에서 useStore를 썼어요.');
  return s;
}
