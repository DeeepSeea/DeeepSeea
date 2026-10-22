import type { Candidate, Settings } from '../types';
import { getPhoto, newId, normalizeCandidate, normalizeSettings, putPhoto } from './storage';

export const BACKUP_APP = 'hannunbang';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  /** 카카오 키는 기기마다 다를 수 있어 빼고 저장한다 */
  settings: Omit<Settings, 'kakaoKey'>;
  candidates: Candidate[];
  /** 사진 id → data URL */
  photos: Record<string, string>;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  return res.blob();
}

export async function buildBackup(settings: Settings, candidates: Candidate[], includePhotos: boolean): Promise<BackupFile> {
  const photos: Record<string, string> = {};
  if (includePhotos) {
    for (const c of candidates) {
      for (const pid of c.field.photoIds) {
        const blob = await getPhoto(pid).catch(() => undefined);
        if (blob) photos[pid] = await blobToDataUrl(blob);
      }
    }
  }
  const { kakaoKey: _omit, ...rest } = settings;
  void _omit;
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: rest,
    candidates: includePhotos ? candidates : candidates.map((c) => ({ ...c, field: { ...c.field, photoIds: [] } })),
    photos,
  };
}

export class BackupError extends Error {}

/** 파일 내용을 확인하고 앱이 쓸 수 있는 모양으로 바꾼다 */
export function parseBackup(text: string): BackupFile {
  let raw: Partial<BackupFile>;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('한눈방 백업 파일이 아니에요. JSON 파일인지 확인해 주세요.');
  }
  if (!raw || raw.app !== BACKUP_APP || !Array.isArray(raw.candidates)) {
    throw new BackupError('한눈방 백업 파일이 아니에요. 한눈방에서 내려받은 파일을 골라 주세요.');
  }
  if ((raw.version ?? 0) > BACKUP_VERSION) {
    throw new BackupError('더 새로운 한눈방에서 만든 파일이에요. 페이지를 새로고침한 뒤 다시 불러와 주세요.');
  }
  const candidates = raw.candidates.map(normalizeCandidate).filter((c): c is Candidate => c !== null);
  const photos: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw.photos ?? {})) {
    if (typeof v === 'string' && v.startsWith('data:image/')) photos[k] = v;
  }
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    settings: normalizeSettings(raw.settings as Partial<Settings>),
    candidates,
    photos,
  };
}

/**
 * 백업의 후보를 새 id로 바꿔 돌려준다. 같은 파일을 여러 번 불러와도 겹치지 않게 하고,
 * 사진은 IndexedDB에 새 id로 저장한다.
 */
export async function materializeCandidates(file: BackupFile): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (const c of file.candidates) {
    const photoIds: string[] = [];
    for (const pid of c.field.photoIds) {
      const data = file.photos[pid];
      if (!data) continue;
      const nid = newId();
      await putPhoto(nid, await dataUrlToBlob(data));
      photoIds.push(nid);
    }
    out.push({ ...c, id: newId(), field: { ...c.field, photoIds } });
  }
  return out;
}

export function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function timestampForFile(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}
