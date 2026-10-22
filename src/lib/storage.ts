import {
  CRITERIA,
  INFRA_KEYS,
  type Candidate,
  type CommuteMode,
  type HouseType,
  type Importance,
  type InfraResult,
  type Settings,
  type TestSession,
} from '../types';
import { FARE_PRESETS } from './cost';

const KEYS = {
  settings: 'hannunbang.settings.v1',
  candidates: 'hannunbang.candidates.v1',
  activeTest: 'hannunbang.test.active.v1',
  sessions: 'hannunbang.test.sessions.v1',
};

/** 가천대학교 글로벌캠퍼스(성남시 수정구 성남대로 1342) 근처 좌표 */
export const DEFAULT_SCHOOL = { name: '가천대학교 글로벌캠퍼스', location: { lat: 37.4508, lng: 127.1274 } };

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  weights: { cost: 3, school: 3, bus: 2, subway: 1, mart: 1, convenience: 2, park: 1, condition: 2 },
  schoolName: DEFAULT_SCHOOL.name,
  school: DEFAULT_SCHOOL.location,
  fareType: 'bus',
  oneWayFare: FARE_PRESETS.bus.won,
  commuteDaysPerWeek: 5,
  walkLimitMin: 15,
  kakaoKey: '',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 공간이 없거나 비공개 모드: 이번 방문 동안만 유지된다
  }
}

const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const isLatLng = (v: unknown): v is { lat: number; lng: number } =>
  !!v && typeof v === 'object' && Number.isFinite((v as { lat: number }).lat) && Number.isFinite((v as { lng: number }).lng);

export function normalizeSettings(raw: Partial<Settings> | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
  const weights = { ...DEFAULT_SETTINGS.weights };
  for (const k of CRITERIA) {
    const w = raw?.weights?.[k];
    if (w === 0 || w === 1 || w === 2 || w === 3) weights[k] = w as Importance;
  }
  return {
    onboarded: !!s.onboarded,
    weights,
    schoolName: str(s.schoolName, DEFAULT_SETTINGS.schoolName),
    school: isLatLng(s.school) ? s.school : DEFAULT_SETTINGS.school,
    fareType: s.fareType === 'subway' || s.fareType === 'custom' ? s.fareType : 'bus',
    oneWayFare: Math.max(0, num(s.oneWayFare, DEFAULT_SETTINGS.oneWayFare)),
    commuteDaysPerWeek: Math.min(7, Math.max(0, num(s.commuteDaysPerWeek, 5))),
    walkLimitMin: Math.max(1, num(s.walkLimitMin, 15)),
    kakaoKey: str(s.kakaoKey).trim(),
  };
}

function normalizeInfra(raw: unknown): InfraResult | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Partial<InfraResult>;
  if (!Number.isFinite(r.walkMin)) return undefined;
  return {
    name: str(r.name, '직접 입력'),
    walkMin: Math.max(0, Math.round(r.walkMin as number)),
    distanceM: Number.isFinite(r.distanceM) ? r.distanceM : undefined,
    location: isLatLng(r.location) ? r.location : undefined,
    source: r.source === 'auto' ? 'auto' : 'manual',
  };
}

/** 저장소나 백업 파일에서 읽은 후보를 앱이 믿고 쓸 수 있는 모양으로 맞춘다 */
export function normalizeCandidate(raw: unknown): Candidate | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Partial<Candidate>;
  if (typeof c.id !== 'string' || !c.id) return null;
  const infra: Candidate['infra'] = {};
  for (const k of INFRA_KEYS) {
    const r = normalizeInfra(c.infra?.[k]);
    if (r) infra[k] = r;
  }
  const f = (c.field ?? {}) as Partial<Candidate['field']>;
  const between = (v: unknown, lo: number, hi: number) => (Number.isFinite(v) && (v as number) >= lo && (v as number) <= hi ? (v as number) : undefined);
  const houseTypes: HouseType[] = ['dagagu', 'officetel', 'unknown'];
  const modes: CommuteMode[] = ['auto', 'walk', 'transit'];
  const now = Date.now();
  return {
    id: c.id,
    name: str(c.name, '이름 없는 후보'),
    address: str(c.address),
    location: isLatLng(c.location) ? c.location : undefined,
    dong: typeof c.dong === 'string' && c.dong ? c.dong : undefined,
    houseType: houseTypes.includes(c.houseType as HouseType) ? (c.houseType as HouseType) : 'unknown',
    deposit: Math.max(0, num(c.deposit)),
    monthlyRent: Math.max(0, num(c.monthlyRent)),
    maintenanceFee: Math.max(0, num(c.maintenanceFee)),
    commuteMode: modes.includes(c.commuteMode as CommuteMode) ? (c.commuteMode as CommuteMode) : 'auto',
    infra,
    field: {
      windowDirection: f.windowDirection,
      windowCount: between(f.windowCount, 0, 20),
      crossVentilation: typeof f.crossVentilation === 'boolean' ? f.crossVentilation : undefined,
      waterPressure: between(f.waterPressure, 1, 5),
      mold: f.mold === 'none' || f.mold === 'some' || f.mold === 'lots' ? f.mold : undefined,
      quietness: between(f.quietness, 1, 5),
      memo: str(f.memo) || undefined,
      photoIds: Array.isArray(f.photoIds) ? f.photoIds.filter((p): p is string => typeof p === 'string') : [],
    },
    createdAt: num(c.createdAt, now),
    updatedAt: num(c.updatedAt, now),
  };
}

export const loadSettings = () => normalizeSettings(read<Partial<Settings>>(KEYS.settings, {}));
export const saveSettings = (s: Settings) => write(KEYS.settings, s);
export const loadCandidates = () =>
  read<unknown[]>(KEYS.candidates, [])
    .map(normalizeCandidate)
    .filter((c): c is Candidate => c !== null);
export const saveCandidates = (c: Candidate[]) => write(KEYS.candidates, c);
export const loadActiveTest = () => read<TestSession | null>(KEYS.activeTest, null);
export const saveActiveTest = (t: TestSession | null) => write(KEYS.activeTest, t);
export const loadSessions = () => read<TestSession[]>(KEYS.sessions, []);
export const saveSessions = (s: TestSession[]) => write(KEYS.sessions, s);

// 사진은 용량이 커서 localStorage(약 5MB) 대신 IndexedDB에 둔다
const DB_NAME = 'hannunbang';
const STORE = 'photos';
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const putPhoto = (id: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, id));
export const getPhoto = (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id));
export const deletePhoto = (id: string) => tx('readwrite', (s) => s.delete(id)).catch(() => undefined);
export const clearPhotos = () => tx('readwrite', (s) => s.clear()).catch(() => undefined);

/** 휴대폰 사진을 긴 변 1280px JPEG로 줄인다 */
export async function shrinkImage(file: Blob, maxSide = 1280): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.8));
  } catch {
    // HEIC처럼 브라우저가 못 읽는 형식은 원본을 그대로 둔다
    return file;
  }
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
