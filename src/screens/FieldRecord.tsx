import { useState, type ChangeEvent } from 'react';
import { Camera } from 'lucide-react';
import { useStore } from '../store';
import { back } from '../router';
import type { FieldRecord as Record_, MoldLevel, WindowDirection } from '../types';
import { conditionScore, MOLD_LABEL } from '../lib/score';
import { deletePhoto, newId, putPhoto, shrinkImage } from '../lib/storage';
import { Body, BottomCTA, Note, Screen, SectionTitle, TopBar } from '../ui/layout';
import { Button, Chips, NumericSpinner, Segmented, Switch, TextArea } from '../ui/controls';
import { useToast } from '../ui/overlay';
import { Photo } from '../components/Photo';

const DIRECTIONS: WindowDirection[] = ['남', '남동', '남서', '동', '서', '북동', '북서', '북'];
const MOLDS: MoldLevel[] = ['none', 'some', 'lots'];
const FIVE = [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }));

export default function FieldRecord({ id }: { id: string }) {
  const { candidates, updateCandidate } = useStore();
  const toast = useToast();
  const c = candidates.find((x) => x.id === id);
  const [saving, setSaving] = useState(false);

  if (!c) {
    return (
      <Screen>
        <TopBar title="현장 기록" />
        <Body>
          <Note>이 후보를 찾지 못했어요. 이미 지웠을 수 있어요.</Note>
        </Body>
      </Screen>
    );
  }

  const f = c.field;
  // 현장에서 바로 쓰므로 고칠 때마다 저장한다
  const set = (patch: Partial<Record_>, logType = 'record:edit') =>
    updateCandidate(c.id, (cur) => ({ field: { ...cur.field, ...patch } }), logType);
  const score = conditionScore(f);

  const addPhotos = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setSaving(true);
    try {
      const ids: string[] = [];
      for (const file of files) {
        const pid = newId();
        await putPhoto(pid, await shrinkImage(file));
        ids.push(pid);
      }
      updateCandidate(c.id, (cur) => ({ field: { ...cur.field, photoIds: [...cur.field.photoIds, ...ids] } }), 'photo:add');
    } catch {
      toast('사진을 저장하지 못했어요. 저장 공간을 확인해 주세요.', 'info');
    } finally {
      setSaving(false);
    }
  };

  const removePhoto = async (pid: string) => {
    await deletePhoto(pid);
    updateCandidate(c.id, (cur) => ({ field: { ...cur.field, photoIds: cur.field.photoIds.filter((p) => p !== pid) } }), 'photo:remove');
  };

  return (
    <Screen>
      <TopBar title="현장 기록" />
      <Body cta>
        <div className="section stack gap-2" style={{ paddingBottom: 8 }}>
          <h1 className="t-h2">{c.name}</h1>
          <p className="t-body2 c-secondary">확인한 것만 기록해요. 비워 둔 항목은 점수에서 빠져요.</p>
          <p className="t-body3 c-tertiary">지금 방 상태 점수: {score === null ? '기록 전' : `${score}점`}</p>
        </div>

        <SectionTitle>채광</SectionTitle>
        <div className="pad-x stack gap-3">
          <p className="t-body2">큰 창이 어느 쪽을 보나요?</p>
          <Chips label="창 방향" grid options={DIRECTIONS.map((d) => ({ value: d, label: d }))} value={f.windowDirection} onChange={(v) => set({ windowDirection: v })} />
          <p className="helper">휴대폰 나침반 앱을 창 쪽으로 들고 확인해요. 남쪽일수록 햇빛이 오래 들어요.</p>
        </div>

        <SectionTitle>환기</SectionTitle>
        <div className="pad-x stack gap-4">
          <div className="row">
            <span className="t-body2 spacer">창문 개수</span>
            <NumericSpinner label="창문 개수" value={f.windowCount ?? 0} min={0} max={10} unit="개" onChange={(v) => set({ windowCount: v })} />
          </div>
          <div className="row gap-3">
            <div className="stack spacer">
              <span className="t-body2">맞통풍이 되나요?</span>
              <span className="helper">서로 마주 보는 창이 있으면 바람이 잘 통해요.</span>
            </div>
            <Switch label="맞통풍" checked={!!f.crossVentilation} onChange={(v) => set({ crossVentilation: v })} />
          </div>
        </div>

        <SectionTitle>수압</SectionTitle>
        <div className="pad-x">
          <Segmented label="수압" options={FIVE} value={f.waterPressure} onChange={(v) => set({ waterPressure: v })} allowClear onClear={() => set({ waterPressure: undefined })} />
          <div className="scale-labels">
            <span>약해요</span>
            <span>세요</span>
          </div>
          <p className="helper" style={{ marginTop: 8 }}>
            세면대와 샤워기를 같이 틀어 봐요.
          </p>
        </div>

        <SectionTitle>곰팡이</SectionTitle>
        <div className="pad-x stack gap-3">
          <Chips label="곰팡이" options={MOLDS.map((m) => ({ value: m, label: MOLD_LABEL[m] }))} value={f.mold} onChange={(v) => set({ mold: v })} />
          <p className="helper">창틀, 욕실 천장, 붙박이장 뒤를 봐요.</p>
        </div>

        <SectionTitle>소음</SectionTitle>
        <div className="pad-x">
          <Segmented label="소음" options={FIVE} value={f.quietness} onChange={(v) => set({ quietness: v })} allowClear onClear={() => set({ quietness: undefined })} />
          <div className="scale-labels">
            <span>시끄러워요</span>
            <span>조용해요</span>
          </div>
          <p className="helper" style={{ marginTop: 8 }}>
            창문을 닫고 1분 동안 들어 봐요.
          </p>
        </div>

        <SectionTitle>사진</SectionTitle>
        <div className="pad-x stack gap-3">
          <div className="photos">
            {f.photoIds.map((pid) => (
              <Photo key={pid} id={pid} onDelete={() => removePhoto(pid)} />
            ))}
            <label className="photo-add">
              <Camera size={22} aria-hidden="true" />
              {saving ? '저장 중' : '사진 추가'}
              <input type="file" accept="image/*" capture="environment" multiple hidden onChange={addPhotos} disabled={saving} />
            </label>
          </div>
          <p className="helper">집주인 동의를 받고 찍어요. 사진은 이 기기에만 저장돼요.</p>
        </div>

        <SectionTitle>메모</SectionTitle>
        <div className="pad-x">
          <TextArea aria-label="메모" placeholder="벽지 상태, 냄새, 집주인 설명, 관리비 포함 항목 등" value={f.memo ?? ''} onChange={(e) => set({ memo: e.target.value })} />
        </div>
      </Body>
      <BottomCTA>
        <Button
          size="xl"
          block
          onClick={() => {
            toast('현장 기록을 저장했어요');
            back(`/c/${c.id}`);
          }}
        >
          기록 마치기
        </Button>
      </BottomCTA>
    </Screen>
  );
}
