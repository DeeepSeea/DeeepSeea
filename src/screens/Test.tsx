import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Check } from 'lucide-react';
import { useStore } from '../store';
import { navigate } from '../router';
import type { TestPick } from '../types';
import { scoreCandidates } from '../lib/score';
import { clearPhotos, DEFAULT_SETTINGS } from '../lib/storage';
import { formatClock, formatDate, formatDuration } from '../lib/format';
import { downloadFile, timestampForFile } from '../lib/backup';
import { sessionsToCsv, summarize } from '../lib/testExport';
import { Body, BottomCTA, EmptyState, KV, ListHeader, ListRow, Note, Screen, SectionTitle, TopBar, Band } from '../ui/layout';
import { Button, Checkbox, Segmented, Switch, TextArea, TextField } from '../ui/controls';
import { BottomSheet, useToast } from '../ui/overlay';
import { rowSub } from './Home';

export function TestStart() {
  const { candidates, test, startTest, replaceCandidates, updateSettings } = useStore();
  const [participant, setParticipant] = useState('');
  const [round, setRound] = useState<1 | 2>(1);
  const [method, setMethod] = useState<'app' | 'baseline'>('app');
  const [rentFirst, setRentFirst] = useState(true);
  const [fresh, setFresh] = useState(false);
  const [confirmFresh, setConfirmFresh] = useState(false);

  if (test) {
    return (
      <Screen>
        <TopBar title="사용성 테스트" />
        <Body>
          <Note>이미 진행 중인 테스트가 있어요. 화면 위 막대에서 그만하거나 과제를 마치면 새로 시작할 수 있어요.</Note>
        </Body>
      </Screen>
    );
  }

  const start = async () => {
    if (method === 'app' && fresh) {
      await clearPhotos();
      replaceCandidates([]);
      updateSettings({ onboarded: false, weights: DEFAULT_SETTINGS.weights });
    }
    startTest({ participant, round, method, rentFirst });
    navigate(method === 'baseline' ? '/test/baseline' : '/', { replace: true });
  };

  return (
    <Screen>
      <TopBar title="사용성 테스트" />
      <Body cta>
        <div className="section stack gap-2">
          <h1 className="t-h2">테스트를 준비해요</h1>
          <p className="t-body2 c-secondary">진행자가 참가자 기기에서 시작해요. 시작하면 걸린 시간, 화면 이동, 고른 방과 이유를 기록해요.</p>
        </div>
        <div className="pad-x stack gap-6">
          <TextField label="참가자" placeholder="예: P1" value={participant} onChange={(e) => setParticipant(e.target.value)} maxLength={20} />
          <div className="stack gap-2">
            <span className="field__label">회차</span>
            <Segmented
              label="회차"
              options={[
                { value: 1, label: '1차' },
                { value: 2, label: '2차' },
              ]}
              value={round}
              onChange={(v) => setRound(v as 1 | 2)}
            />
          </div>
          <div className="stack gap-2">
            <span className="field__label">방법</span>
            <Segmented
              label="방법"
              options={[
                { value: 'app', label: '한눈방으로' },
                { value: 'baseline', label: '기존 방법으로' },
              ]}
              value={method}
              onChange={setMethod}
            />
            <p className="helper">
              {method === 'app' ? '참가자가 이 기기에서 한눈방으로 과제를 해요.' : '참가자는 지도 앱과 메모로 과제를 하고, 진행자는 이 기기로 시간을 재요(가정 4 비교용).'}
            </p>
          </div>
          {method === 'app' && (
            <>
              <div className="row gap-3">
                <div className="stack spacer">
                  <span className="t-body2">월세만 보고 고른 뒤 다시 고르기</span>
                  <span className="helper">처음엔 월세와 관리비만, 다음엔 월 총 주거비를 보여 줘요(가정 5)</span>
                </div>
                <Switch label="월세만 보고 고른 뒤 다시 고르기" checked={rentFirst} onChange={setRentFirst} />
              </div>
              <div className="row gap-3">
                <div className="stack spacer">
                  <span className="t-body2">처음 쓰는 상태로 시작하기</span>
                  <span className="helper">후보와 기준을 비우고 첫 화면부터 시작해요(가정 6)</span>
                </div>
                <Switch label="처음 쓰는 상태로 시작하기" checked={fresh} onChange={setFresh} />
              </div>
              <Note flush>
                지금 후보 {candidates.length}곳이 있어요. 테스트용 매물을 미리 넣으려면 설정에서 백업 파일을 불러와 주세요.
              </Note>
            </>
          )}
        </div>
      </Body>
      <BottomCTA>
        <Button size="xl" block onClick={() => (method === 'app' && fresh && candidates.length > 0 ? setConfirmFresh(true) : start())}>
          테스트 시작하기
        </Button>
      </BottomCTA>
      <BottomSheet
        open={confirmFresh}
        onClose={() => setConfirmFresh(false)}
        title={`후보 ${candidates.length}곳을 지우고 시작할까요?`}
        desc="필요하면 먼저 설정에서 백업 파일을 내려받아 주세요. 지운 후보는 되돌릴 수 없어요."
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmFresh(false)}>
              닫기
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmFresh(false);
                start();
              }}
            >
              지우고 시작하기
            </Button>
          </>
        }
      />
    </Screen>
  );
}

export function TestPick() {
  const { test, candidates, settings, costMode, submitPicks } = useStore();
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const scored = useMemo(() => scoreCandidates(candidates, settings, costMode), [candidates, settings, costMode]);

  if (!test || test.method !== 'app') {
    return (
      <Screen>
        <TopBar title="2곳 고르기" />
        <Body>
          <Note>진행 중인 테스트가 없어요.</Note>
        </Body>
      </Screen>
    );
  }

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 2 ? [s[1], id] : [...s, id]));

  const submit = () => {
    const names = selected.map((id) => candidates.find((c) => c.id === id)?.name ?? id);
    const res = submitPicks(test.phase, selected, names, reason.trim());
    if (res.status === 'next') {
      toast('이제 통학 교통비까지 더한 월 총 주거비를 보여 드려요', 'info');
      navigate('/', { replace: true });
    } else if (res.status === 'done') {
      navigate(`/test/result/${res.session.id}`, { replace: true });
    }
  };

  const costShort = costMode === 'total' ? '월' : '월세+관리비';

  return (
    <Screen>
      <TopBar title="2곳 고르기" />
      <Body cta>
        <div className="section stack gap-2" style={{ paddingBottom: 8 }}>
          <h1 className="t-h2">{test.phase === 'rentOnly' ? '월세를 보고 2곳을 골라 주세요' : '마음에 드는 2곳을 골라 주세요'}</h1>
          <p className="t-body2 c-secondary">실제로 계약한다면 어디를 고를지 생각해 주세요.</p>
        </div>
        <ul aria-label="후보 고르기">
          {scored.map((x) => {
            const on = selected.includes(x.candidate.id);
            return (
              <li key={x.candidate.id}>
                <ListRow
                  lead={<Checkbox checked={on} />}
                  title={x.candidate.name}
                  sub={rowSub(x, costShort)}
                  trail={<span className="list-row__amount">{x.total === null ? '' : `${x.total}점`}</span>}
                  onClick={() => toggle(x.candidate.id)}
                />
              </li>
            );
          })}
        </ul>
        <div className="pad-x" style={{ paddingTop: 16 }}>
          <TextArea label="고른 이유" placeholder="예: 학교가 가깝고 한 달에 나가는 돈이 적어서" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </Body>
      <BottomCTA info={selected.length < 2 ? `${2 - selected.length}곳 더 골라 주세요` : undefined}>
        <Button size="xl" block disabled={selected.length !== 2} onClick={submit}>
          선택 완료
        </Button>
      </BottomCTA>
    </Screen>
  );
}

function PickBlock({ pick, title }: { pick: TestPick; title: string }) {
  return (
    <>
      <ListHeader title={title} />
      <KV label="고른 방" value={pick.names.join(', ') || '없음'} />
      <p className="pad-x t-body2 c-secondary pre-line" style={{ paddingBottom: 8 }}>
        {pick.reason ? `이유: ${pick.reason}` : '이유를 적지 않았어요'}
      </p>
    </>
  );
}

export function TestResult({ id }: { id: string }) {
  const { sessions } = useStore();
  const s = sessions.find((x) => x.id === id);
  if (!s) {
    return (
      <Screen>
        <TopBar title="테스트 결과" />
        <Body>
          <Note>이 결과를 찾지 못했어요.</Note>
        </Body>
      </Screen>
    );
  }
  const m = summarize(s);

  return (
    <Screen>
      <TopBar title="테스트 결과" onBack={() => navigate('/test/results', { replace: true })} />
      <Body cta>
        <div className="empty" style={{ paddingTop: 24 }}>
          <span className="result-icon" aria-hidden="true">
            <Check size={32} strokeWidth={3} />
          </span>
          <p className="t-h4">{s.aborted ? `${s.participant} 테스트를 중간에 멈췄어요` : `${s.participant} 테스트를 마쳤어요`}</p>
          <p className="t-body2 c-secondary">{formatDate(s.startedAt)}</p>
        </div>
        <KV label="방법" value={`${s.method === 'app' ? '한눈방' : '기존 방법'} · ${s.round}차`} />
        <KV label="전체 걸린 시간" value={m.totalMs === null ? '—' : formatDuration(m.totalMs)} />
        <KV label="첫 선택까지" value={m.firstPickMs === null ? '—' : formatDuration(m.firstPickMs)} />
        <KV label="도움 요청" value={`${s.helpCount}회`} />
        {s.method === 'app' && <KV label="추가한 후보" value={`${m.candidatesAdded}곳`} />}
        {m.changed !== null && <KV label="총 주거비를 보고 선택이 바뀌었나요" value={m.changed ? '바뀌었어요' : '그대로예요'} />}

        {m.rentOnly && <PickBlock pick={m.rentOnly} title="월세만 보고 고른 방" />}
        {m.total && <PickBlock pick={m.total} title={s.method === 'baseline' ? '고른 방' : s.rentFirst ? '총 주거비를 보고 고른 방' : '고른 방'} />}

        {s.notes.length > 0 && (
          <>
            <ListHeader title="진행자 메모" />
            {s.notes.map((n, i) => (
              <KV key={i} label={n.text} value={formatClock(n.at - s.startedAt)} sub={n.screen} />
            ))}
          </>
        )}

        <div className="pad-x stack gap-2" style={{ paddingTop: 24 }}>
          <Button variant="secondary" block onClick={() => downloadFile(`hannunbang-test-${s.participant}-${timestampForFile(new Date(s.startedAt))}.csv`, sessionsToCsv([s]), 'text/csv;charset=utf-8')}>
            CSV로 내려받기
          </Button>
          <Button variant="ghost" block onClick={() => downloadFile(`hannunbang-test-${s.participant}-${timestampForFile(new Date(s.startedAt))}.json`, JSON.stringify(s, null, 2), 'application/json')}>
            전체 기록(JSON) 내려받기
          </Button>
        </div>
      </Body>
      <BottomCTA>
        <Button size="xl" block onClick={() => navigate('/test', { replace: true })}>
          다음 참가자 준비하기
        </Button>
      </BottomCTA>
    </Screen>
  );
}

export function TestResults() {
  const { sessions, removeSessions } = useStore();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const sorted = [...sessions].sort((a, b) => b.startedAt - a.startedAt);

  return (
    <Screen>
      <TopBar title="테스트 결과" onBack={() => navigate('/settings', { replace: true })} />
      <Body>
        {sorted.length === 0 ? (
          <EmptyState icon={<ClipboardList size={36} />} title="아직 테스트 기록이 없어요" desc="설정에서 테스트를 시작하면 여기에 쌓여요." />
        ) : (
          <>
            <ul>
              {sorted.map((s) => {
                const m = summarize(s);
                return (
                  <li key={s.id}>
                    <ListRow
                      title={`${s.participant} · ${s.round}차 · ${s.method === 'app' ? '한눈방' : '기존 방법'}`}
                      sub={`${formatDate(s.startedAt)}${m.totalMs !== null ? ` · ${formatDuration(m.totalMs)}` : ''}${s.aborted ? ' · 중간에 멈춤' : ''}`}
                      chevron
                      onClick={() => navigate(`/test/result/${s.id}`)}
                    />
                  </li>
                );
              })}
            </ul>
            <Band />
            <div className="section stack gap-2">
              <Button variant="secondary" block onClick={() => downloadFile(`hannunbang-tests-${timestampForFile()}.csv`, sessionsToCsv(sorted), 'text/csv;charset=utf-8')}>
                모두 CSV로 내려받기
              </Button>
              <Button variant="ghost" block onClick={() => downloadFile(`hannunbang-tests-${timestampForFile()}.json`, JSON.stringify(sorted, null, 2), 'application/json')}>
                모두 JSON으로 내려받기
              </Button>
              <Button variant="ghost-danger" block onClick={() => setConfirm(true)}>
                결과 모두 지우기
              </Button>
            </div>
          </>
        )}
      </Body>
      <BottomSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="테스트 결과를 모두 지울까요?"
        desc={`기록 ${sessions.length}개가 지워지고 되돌릴 수 없어요. 먼저 내려받아 두는 걸 권해요.`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              닫기
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                removeSessions();
                setConfirm(false);
                toast('테스트 결과를 지웠어요');
              }}
            >
              지우기
            </Button>
          </>
        }
      />
    </Screen>
  );
}

/** 기존 방법(지도 앱 + 메모) 조건: 진행자가 시간과 도움 요청만 잰다 */
export function Baseline() {
  const { test, addHelp, addNote, submitPicks } = useStore();
  const toast = useToast();
  const [now, setNow] = useState(Date.now());
  const [note, setNote] = useState('');
  const [names, setNames] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  if (!test || test.method !== 'baseline') {
    return (
      <Screen>
        <TopBar title="기존 방법 측정" />
        <Body>
          <Note>진행 중인 측정이 없어요.</Note>
        </Body>
      </Screen>
    );
  }

  const finish = () => {
    const picked = names
      .split(/[,/·\n]/)
      .map((x) => x.trim())
      .filter(Boolean);
    const res = submitPicks('total', [], picked, reason.trim());
    if (res.status === 'done') navigate(`/test/result/${res.session.id}`, { replace: true });
  };

  return (
    <Screen>
      <TopBar title="기존 방법 측정" onBack={() => navigate('/settings')} />
      <Body cta>
        <p className="section t-body2 c-secondary" style={{ paddingBottom: 0 }}>
          {test.participant} 참가자가 지도 앱과 메모로 후보를 비교하는 동안 시간을 재요.
        </p>
        <p className="stopwatch" aria-live="off">
          {formatClock(now - test.startedAt)}
        </p>
        <div className="pad-x stack gap-2">
          <Button variant="secondary" block onClick={addHelp}>
            도움 요청 +1 {test.helpCount > 0 ? `(${test.helpCount}회)` : ''}
          </Button>
        </div>

        <SectionTitle>진행자 메모</SectionTitle>
        <div className="pad-x stack gap-2">
          <TextArea aria-label="진행자 메모" placeholder="예: 마트 거리를 찾느라 지도 앱을 오래 봄" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button
            variant="ghost"
            size="m"
            disabled={!note.trim()}
            onClick={() => {
              addNote(note.trim(), '기존 방법');
              setNote('');
              toast('메모를 남겼어요');
            }}
          >
            메모 남기기
          </Button>
          {test.notes.map((n, i) => (
            <p key={i} className="helper">
              {formatClock(n.at - test.startedAt)} {n.text}
            </p>
          ))}
        </div>

        <SectionTitle>고른 방</SectionTitle>
        <div className="pad-x stack gap-4">
          <TextField placeholder="예: A, C" value={names} onChange={(e) => setNames(e.target.value)} aria-label="고른 방" help="쉼표로 나눠 적어요" />
          <TextArea label="고른 이유" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </Body>
      <BottomCTA>
        <Button size="xl" block onClick={finish}>
          측정 끝내기
        </Button>
      </BottomCTA>
    </Screen>
  );
}
