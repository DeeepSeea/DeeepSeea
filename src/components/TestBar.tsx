import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { navigate, usePath } from '../router';
import { formatClock } from '../lib/format';
import { screenName } from '../lib/testExport';
import { Button, TextArea } from '../ui/controls';
import { BottomSheet, useToast } from '../ui/overlay';

/** 테스트 중 화면 맨 위에 붙는 진행자용 막대 */
export function TestBar() {
  const { test, addHelp, addNote, finishTest } = useStore();
  const path = usePath();
  const toast = useToast();
  const [now, setNow] = useState(Date.now());
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [stopOpen, setStopOpen] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    document.documentElement.style.setProperty('--testbar-h', '40px');
    return () => {
      window.clearInterval(t);
      document.documentElement.style.removeProperty('--testbar-h');
    };
  }, []);

  if (!test) return null;

  return (
    <div className="testbar-wrap">
      <div className="testbar">
        <span>테스트 · {test.participant}</span>
        <span className="testbar__time" aria-label="걸린 시간">
          {formatClock(now - test.startedAt)}
        </span>
        <span className="spacer" />
        <button type="button" onClick={addHelp} aria-label={`도움 요청 기록하기, 지금 ${test.helpCount}회`}>
          도움 +1{test.helpCount > 0 ? ` (${test.helpCount})` : ''}
        </button>
        <button type="button" onClick={() => setNoteOpen(true)}>
          메모
        </button>
        <button type="button" onClick={() => setStopOpen(true)}>
          그만하기
        </button>
      </div>

      <BottomSheet
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="진행자 메모"
        desc={`지금 화면(${screenName(path)})과 시각이 함께 남아요. 참가자가 멈춘 곳을 적어 두면 좋아요.`}
        actions={
          <Button
            block
            disabled={!note.trim()}
            onClick={() => {
              addNote(note.trim(), screenName(path));
              setNote('');
              setNoteOpen(false);
              toast('메모를 남겼어요');
            }}
          >
            남기기
          </Button>
        }
      >
        <TextArea aria-label="메모" autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 후보 추가 버튼을 찾지 못함" />
      </BottomSheet>

      <BottomSheet
        open={stopOpen}
        onClose={() => setStopOpen(false)}
        title="테스트를 그만할까요?"
        desc="지금까지 기록은 '중간에 그만둠'으로 결과에 남아요."
        actions={
          <>
            <Button variant="secondary" onClick={() => setStopOpen(false)}>
              닫기
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const s = finishTest(true);
                setStopOpen(false);
                if (s) navigate(`/test/result/${s.id}`, { replace: true });
              }}
            >
              그만하기
            </Button>
          </>
        }
      />
    </div>
  );
}
