import { useRef, useState, type ChangeEvent } from 'react';
import { Download, FlaskConical, ListChecks, Trash2, Upload, Calculator } from 'lucide-react';
import { useStore } from '../store';
import { navigate } from '../router';
import { INFRA_KEYS, INFRA_LABEL } from '../types';
import { COST_POINTS_PER_PERCENT, INFRA_THRESHOLDS } from '../lib/score';
import { buildBackup, downloadFile, materializeCandidates, parseBackup, timestampForFile, type BackupFile } from '../lib/backup';
import { clearPhotos, deletePhoto } from '../lib/storage';
import { formatYm, useRentStats } from '../lib/rentStats';
import { Band, Body, ListHeader, ListRow, Note, Screen, SectionTitle, TopBar } from '../ui/layout';
import { Button, Switch, TextField } from '../ui/controls';
import { BottomSheet, useToast } from '../ui/overlay';
import { CriteriaEditor } from '../components/CriteriaEditor';
import { CommuteEditor } from '../components/CommuteEditor';

export default function Settings() {
  const store = useStore();
  const { settings, updateSettings, candidates, kakaoKey, kakaoKeyFromEnv, sessions, test, replaceCandidates } = store;
  const toast = useToast();
  const rent = useRentStats();
  const fileInput = useRef<HTMLInputElement>(null);

  const [sheet, setSheet] = useState<null | 'export' | 'import' | 'clear' | 'scoring'>(null);
  const [withPhotos, setWithPhotos] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [keyDraft, setKeyDraft] = useState(settings.kakaoKey);

  const exportBackup = async () => {
    setBusy(true);
    try {
      const file = await buildBackup(settings, candidates, withPhotos);
      downloadFile(`hannunbang-backup-${timestampForFile()}.json`, JSON.stringify(file), 'application/json');
      setSheet(null);
      toast('백업 파일을 내려받았어요');
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPending(parseBackup(await file.text()));
      setSheet('import');
    } catch (err) {
      toast((err as Error).message, 'info');
    }
  };

  const applyImport = async (mode: 'append' | 'replace') => {
    if (!pending) return;
    setBusy(true);
    try {
      if (mode === 'replace') {
        await Promise.all(candidates.flatMap((c) => c.field.photoIds.map(deletePhoto)));
      }
      const imported = await materializeCandidates(pending);
      if (mode === 'replace') {
        replaceCandidates(imported);
        updateSettings({ ...pending.settings, kakaoKey: settings.kakaoKey, onboarded: true });
      } else {
        replaceCandidates([...candidates, ...imported]);
      }
      toast(`후보 ${imported.length}곳을 불러왔어요`);
      setSheet(null);
      setPending(null);
    } catch {
      toast('불러오지 못했어요. 저장 공간이 부족한지 확인해 주세요.', 'info');
    } finally {
      setBusy(false);
    }
  };

  const clearAll = async () => {
    await clearPhotos();
    replaceCandidates([]);
    setSheet(null);
    toast('모든 후보를 지웠어요');
  };

  return (
    <Screen>
      <TopBar title="설정" />
      <Body>
        <SectionTitle>내 기준</SectionTitle>
        <p className="pad-x helper">중요도를 바꾸면 순위가 바로 바뀌어요.</p>
        <CriteriaEditor weights={settings.weights} onChange={(weights) => updateSettings({ weights })} />
        <ListRow
          lead={
            <span className="ico">
              <Calculator size={20} />
            </span>
          }
          title="점수 계산 방법"
          chevron
          onClick={() => setSheet('scoring')}
        />

        <Band />
        <SectionTitle>통학</SectionTitle>
        <CommuteEditor settings={settings} kakaoKey={kakaoKey} onChange={updateSettings} />

        <Band />
        <ListHeader title="데이터" />
        <ListRow
          lead={
            <span className="ico">
              <Download size={20} />
            </span>
          }
          title="백업 파일 내려받기"
          sub="다른 기기로 옮기거나 테스트용 후보를 나눠 줄 때 써요"
          chevron
          onClick={() => setSheet('export')}
        />
        <ListRow
          lead={
            <span className="ico">
              <Upload size={20} />
            </span>
          }
          title="백업 파일 불러오기"
          chevron
          onClick={() => fileInput.current?.click()}
        />
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={pickFile} />
        <ListRow
          lead={
            <span className="ico">
              <Trash2 size={20} />
            </span>
          }
          title="모든 후보 지우기"
          chevron
          onClick={() => setSheet('clear')}
        />
        <Note>후보와 사진은 이 기기의 브라우저에만 저장돼요. 브라우저 기록을 지우면 함께 지워지니 가끔 백업해 주세요.</Note>

        <Band />
        <ListHeader title="사용성 테스트" />
        <ListRow
          lead={
            <span className="ico">
              <FlaskConical size={20} />
            </span>
          }
          title={test ? '진행 중인 테스트로 돌아가기' : '테스트 시작하기'}
          sub="과제 시간, 도움 요청, 고른 방과 이유를 기록해요"
          chevron
          onClick={() => navigate(test?.method === 'baseline' ? '/test/baseline' : test ? '/' : '/test')}
        />
        <ListRow
          lead={
            <span className="ico">
              <ListChecks size={20} />
            </span>
          }
          title="테스트 결과"
          sub={sessions.length ? `${sessions.length}개 기록` : '아직 기록이 없어요'}
          chevron
          onClick={() => navigate('/test/results')}
        />

        <Band />
        <ListHeader title="지도와 시세" />
        <div className="pad-x stack gap-3" style={{ paddingTop: 4 }}>
          <p className="t-body2">
            카카오 지도{' '}
            <strong>{kakaoKey ? (kakaoKeyFromEnv ? '연결됨' : '이 기기에서 연결됨') : '연결 전'}</strong>
          </p>
          {!kakaoKeyFromEnv && (
            <form
              className="row gap-2"
              style={{ alignItems: 'flex-end' }}
              onSubmit={(e) => {
                e.preventDefault();
                updateSettings({ kakaoKey: keyDraft.trim() });
                toast(keyDraft.trim() ? '카카오 지도 키를 저장했어요' : '카카오 지도 연결을 해제했어요');
              }}
            >
              <div style={{ flex: 1 }}>
                <TextField label="카카오 JavaScript 키" placeholder="키를 붙여 넣어요" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} autoComplete="off" spellCheck={false} />
              </div>
              <Button type="submit" variant="secondary" size="l">
                저장
              </Button>
            </form>
          )}
          <p className="helper">
            {kakaoKey ? '주소만 넣으면 거리를 자동으로 계산해요.' : '연결 전에는 거리를 직접 넣어요. 키는 카카오 개발자 사이트에서 무료로 받을 수 있어요.'}
          </p>
          <p className="t-body2">
            동네 월세 시세{' '}
            <strong>
              {rent.status === 'ready' ? `${formatYm(rent.data.period.to)}까지 반영` : rent.status === 'loading' ? '확인 중' : '자료 없음'}
            </strong>
          </p>
          <p className="helper">
            {rent.status === 'ready'
              ? `${rent.data.region}, ${rent.data.source}`
              : '배포할 때 공공데이터포털 키를 넣으면 국토교통부 전월세 실거래가로 시세를 보여 줘요.'}
          </p>
        </div>

        <p className="pad-x helper" style={{ paddingTop: 32 }}>
          한눈방 · 가천대학교 창업프로젝트
          <br />
          장소 정보: 카카오 로컬 · 시세: 국토교통부 전월세 실거래가
        </p>
      </Body>

      <BottomSheet
        open={sheet === 'export'}
        onClose={() => setSheet(null)}
        title="백업 파일을 내려받을게요"
        desc={`후보 ${candidates.length}곳과 내 기준이 들어가요.`}
        actions={
          <Button block size="xl" loading={busy} onClick={exportBackup}>
            내려받기
          </Button>
        }
      >
        <div className="row gap-3">
          <div className="stack spacer">
            <span className="t-body2">사진도 넣기</span>
            <span className="helper">사진이 많으면 파일이 커져요</span>
          </div>
          <Switch label="사진도 넣기" checked={withPhotos} onChange={setWithPhotos} />
        </div>
      </BottomSheet>

      <BottomSheet
        open={sheet === 'import' && !!pending}
        onClose={() => {
          setSheet(null);
          setPending(null);
        }}
        title={`후보 ${pending?.candidates.length ?? 0}곳을 불러올게요`}
        desc="지금 목록에 더하거나, 지금 목록을 지우고 파일 내용으로 바꿀 수 있어요. 바꾸기를 고르면 내 기준도 파일대로 바뀌어요."
        actions={
          <>
            <Button variant="secondary" disabled={busy} onClick={() => applyImport('replace')}>
              바꾸기
            </Button>
            <Button loading={busy} onClick={() => applyImport('append')}>
              더하기
            </Button>
          </>
        }
      />

      <BottomSheet
        open={sheet === 'clear'}
        onClose={() => setSheet(null)}
        title="모든 후보를 지울까요?"
        desc={`후보 ${candidates.length}곳과 현장 기록, 사진이 지워지고 되돌릴 수 없어요. 내 기준과 테스트 결과는 남아요.`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setSheet(null)}>
              닫기
            </Button>
            <Button variant="danger" onClick={clearAll}>
              지우기
            </Button>
          </>
        }
      />

      <BottomSheet open={sheet === 'scoring'} onClose={() => setSheet(null)} title="점수는 이렇게 매겨요" actions={<Button block onClick={() => setSheet(null)}>확인</Button>}>
        <div className="stack gap-3 t-body2 c-secondary">
          <p>항목마다 0~100점을 매기고, 내가 고른 중요도(조금 1, 중요 2, 아주 중요 3)만큼 곱해 평균을 내요.</p>
          <p>
            <strong style={{ color: 'var(--text-primary)' }}>월 총 주거비</strong> 가장 싼 후보가 100점이고, 그보다 1% 비쌀 때마다 {COST_POINTS_PER_PERCENT}점씩 빠져요.
          </p>
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>걸어서 걸리는 시간</strong>
            <ul style={{ marginTop: 4 }}>
              {INFRA_KEYS.map((k) => (
                <li key={k}>
                  {INFRA_LABEL[k]}: {INFRA_THRESHOLDS[k].good}분 안 100점, {INFRA_THRESHOLDS[k].bad}분 넘으면 0점
                </li>
              ))}
            </ul>
          </div>
          <p>
            <strong style={{ color: 'var(--text-primary)' }}>방 상태</strong> 채광(창 방향), 환기, 수압, 곰팡이, 소음을 5점 만점으로 평균 내요.
          </p>
          <p>정보가 없는 항목은 0점으로 치지 않고 점수에서 빼요.</p>
        </div>
      </BottomSheet>
    </Screen>
  );
}
