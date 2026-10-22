import { useMemo, useState } from 'react';
import { House, Settings as SettingsIcon, Table2, ChevronRight } from 'lucide-react';
import { useStore } from '../store';
import { navigate } from '../router';
import { scoreCandidates, sortScored, type Scored, type SortKey } from '../lib/score';
import { COST_LABEL } from '../lib/cost';
import { formatWon, josa } from '../lib/format';
import { Badge, Body, BottomCTA, EmptyState, ListRow, Screen, TopBar } from '../ui/layout';
import { Button, Segmented } from '../ui/controls';

export function rowSub(x: Scored, costLabel: string): string {
  const school = x.candidate.infra.school?.walkMin;
  const parts = [`${costLabel} ${formatWon(x.cost)}`];
  if (school !== undefined) parts.push(`학교 ${school}분`);
  return parts.join(' · ');
}

export function rowBadges(x: Scored) {
  const badges = [];
  if (x.parts.condition === null) badges.push(<Badge key="field">현장 기록 전</Badge>);
  if (x.missing.some((k) => k !== 'condition' && k !== 'cost')) badges.push(<Badge key="infra">거리 정보 빠짐</Badge>);
  return badges.length ? badges : undefined;
}

export default function Home() {
  const { candidates, settings, costMode, test, logEvent } = useStore();
  const [sort, setSort] = useState<SortKey>('score');

  const scored = useMemo(() => scoreCandidates(candidates, settings, costMode), [candidates, settings, costMode]);
  const list = useMemo(() => sortScored(scored, sort), [scored, sort]);
  const top = scored[0];
  const costShort = costMode === 'total' ? '월' : '월세+관리비';
  const appTest = test && test.method === 'app' ? test : null;

  return (
    <Screen>
      <TopBar
        brand
        title="한눈방"
        right={
          <>
            <button type="button" className="icon-btn" aria-label="비교표 보기" onClick={() => navigate('/compare')}>
              <Table2 size={22} />
            </button>
            <button type="button" className="icon-btn" aria-label="설정" onClick={() => navigate('/settings')}>
              <SettingsIcon size={22} />
            </button>
          </>
        }
      />
      <Body cta>
        {appTest && (
          <div className="task-card" style={{ marginTop: 8 }}>
            <p className="t-label-s c-tertiary">사용성 테스트 과제</p>
            <p className="t-title2">
              {appTest.phase === 'rentOnly'
                ? '월세를 보고 마음에 드는 방 2곳을 골라 주세요'
                : appTest.rentFirst
                  ? '이번에는 월 총 주거비를 보고 다시 2곳을 골라 주세요'
                  : '마음에 드는 방 2곳을 골라 주세요'}
            </p>
            <Button variant="secondary" size="m" disabled={candidates.length < 2} onClick={() => navigate('/test/pick')}>
              2곳 고르기
            </Button>
          </div>
        )}

        {candidates.length === 0 ? (
          <EmptyState icon={<House size={36} />} title="아직 비교할 방이 없어요" desc={'집 보러 갈 후보를 넣으면\n내 기준으로 순위를 매겨 드려요.'}>
            <Button variant="ghost" size="m" onClick={() => navigate('/settings')}>
              백업 파일 불러오기
            </Button>
          </EmptyState>
        ) : (
          <>
            <div className="section stack gap-2" style={{ paddingBottom: 16 }}>
              <p className="t-body2 c-secondary">후보 {candidates.length}곳을 비교하고 있어요</p>
              {top && top.total !== null ? (
                <h1 className="t-h2">
                  {top.candidate.name}
                  {josa(top.candidate.name, '이', '가')}
                  <br />내 기준 1위예요
                </h1>
              ) : (
                <h1 className="t-h2">중요한 기준을 고르면 순위를 매겨 드려요</h1>
              )}
              <p className="t-body3 c-tertiary">
                {COST_LABEL[costMode]}, 생활 인프라, 방 상태를 내 중요도대로 합친 점수예요.
              </p>
            </div>

            <div className="pad-x" style={{ paddingBottom: 8 }}>
              <Segmented<SortKey>
                label="정렬"
                size="sm"
                options={[
                  { value: 'score', label: '점수순' },
                  { value: 'cost', label: costMode === 'total' ? '총 주거비순' : '월세순' },
                  { value: 'school', label: '학교 가까운 순' },
                ]}
                value={sort}
                onChange={(v) => {
                  setSort(v);
                  logEvent('sort', v);
                }}
              />
            </div>

            <ul aria-label="후보 목록">
              {list.map((x, i) => (
                <li key={x.candidate.id}>
                  <ListRow
                    lead={<span className={`rank${i === 0 ? ' rank--top' : ''}`}>{i + 1}</span>}
                    title={x.candidate.name}
                    sub={rowSub(x, costShort)}
                    badges={rowBadges(x)}
                    trail={<span className="list-row__amount">{x.total === null ? '점수 없음' : `${x.total}점`}</span>}
                    chevron
                    onClick={() => navigate(`/c/${x.candidate.id}`)}
                  />
                </li>
              ))}
            </ul>

            <button type="button" className="link-row" style={{ marginTop: 8 }} onClick={() => navigate('/compare')}>
              비교표로 한눈에 보기
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </>
        )}
      </Body>
      <BottomCTA>
        <Button size="xl" block onClick={() => navigate('/add')}>
          후보 추가하기
        </Button>
      </BottomCTA>
    </Screen>
  );
}
