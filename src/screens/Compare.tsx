import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { navigate } from '../router';
import { INFRA_KEYS, INFRA_LABEL } from '../types';
import { conditionScore, DIRECTION_SCORE, MOLD_LABEL, MOLD_SCORE, scoreCandidates, ventilationScore, type Scored } from '../lib/score';
import { COST_LABEL, monthlyCommuteCost } from '../lib/cost';
import { formatWon } from '../lib/format';
import { findStat, rentPercentile, useRentStats, type RentStatsFile } from '../lib/rentStats';
import { Body, EmptyState, ListRow, Screen, TopBar } from '../ui/layout';
import { Segmented } from '../ui/controls';
import { KakaoMap, type MapMarker } from '../components/KakaoMap';
import { Table2 } from 'lucide-react';

interface Row {
  label: string;
  /** 비교에 쓰는 숫자. null이면 정보 없음 */
  value: (x: Scored) => number | null;
  show?: (x: Scored) => string;
  /** 어느 쪽이 좋은지. 없으면 강조하지 않는다 */
  better?: 'low' | 'high';
  strong?: boolean;
}
type Line = Row | { group: string };

function buildLines(costMode: 'total' | 'rentOnly', settings: ReturnType<typeof useStore>['settings'], rent: RentStatsFile | null): Line[] {
  const won = (v: number) => formatWon(v);
  const lines: Line[] = [
    { label: '내 기준 점수', value: (x) => x.total, show: (x) => (x.total === null ? '—' : `${x.total}점`), better: 'high', strong: true },
    { group: '비용' },
    { label: COST_LABEL[costMode], value: (x) => x.cost, show: (x) => won(x.cost), better: 'low', strong: true },
    { label: '월세', value: (x) => x.candidate.monthlyRent, show: (x) => won(x.candidate.monthlyRent), better: 'low' },
    { label: '관리비', value: (x) => x.candidate.maintenanceFee, show: (x) => won(x.candidate.maintenanceFee), better: 'low' },
  ];
  if (costMode === 'total') {
    lines.push({ label: '통학 교통비', value: (x) => monthlyCommuteCost(x.candidate, settings), show: (x) => won(monthlyCommuteCost(x.candidate, settings)), better: 'low' });
  }
  lines.push({ label: '보증금', value: (x) => x.candidate.deposit, show: (x) => won(x.candidate.deposit), better: 'low' });
  if (rent) {
    const pct = (x: Scored) => {
      const s = findStat(rent, x.candidate.dong, x.candidate.houseType);
      return s ? rentPercentile(x.candidate.monthlyRent / 10000, s.rentDeciles) : null;
    };
    lines.push({ label: '동네 월세 중 위치', value: pct, show: (x) => (pct(x) === null ? '—' : `하위 ${pct(x)}%`), better: 'low' });
  }
  lines.push({ group: '걸어서 걸리는 시간' });
  for (const k of INFRA_KEYS) {
    lines.push({
      label: INFRA_LABEL[k],
      value: (x) => x.candidate.infra[k]?.walkMin ?? null,
      show: (x) => (x.candidate.infra[k] ? `${x.candidate.infra[k]!.walkMin}분` : '—'),
      better: 'low',
    });
  }
  lines.push(
    { group: '방 상태' },
    { label: '방 상태 점수', value: (x) => conditionScore(x.candidate.field), show: (x) => fmtScore(conditionScore(x.candidate.field)), better: 'high' },
    {
      label: '채광',
      value: (x) => (x.candidate.field.windowDirection ? DIRECTION_SCORE[x.candidate.field.windowDirection] : null),
      show: (x) => (x.candidate.field.windowDirection ? `${x.candidate.field.windowDirection}향` : '—'),
      better: 'high',
    },
    { label: '환기', value: (x) => ventilationScore(x.candidate.field) ?? null, show: (x) => fmt5(ventilationScore(x.candidate.field)), better: 'high' },
    { label: '수압', value: (x) => x.candidate.field.waterPressure ?? null, show: (x) => fmt5(x.candidate.field.waterPressure), better: 'high' },
    {
      label: '곰팡이',
      value: (x) => (x.candidate.field.mold ? MOLD_SCORE[x.candidate.field.mold] : null),
      show: (x) => (x.candidate.field.mold ? MOLD_LABEL[x.candidate.field.mold] : '—'),
      better: 'high',
    },
    { label: '조용함', value: (x) => x.candidate.field.quietness ?? null, show: (x) => fmt5(x.candidate.field.quietness), better: 'high' },
    { label: '사진', value: (x) => x.candidate.field.photoIds.length, show: (x) => `${x.candidate.field.photoIds.length}장` },
  );
  return lines;
}

const fmt5 = (v: number | undefined) => (v === undefined ? '—' : `${v}/5`);
const fmtScore = (v: number | null) => (v === null ? '—' : `${v}점`);

export default function Compare() {
  const { candidates, settings, costMode, kakaoKey, logEvent } = useStore();
  const [view, setView] = useState<'table' | 'map'>('table');
  const scored = useMemo(() => scoreCandidates(candidates, settings, costMode), [candidates, settings, costMode]);
  const rent = useRentStats();
  const lines = useMemo(() => buildLines(costMode, settings, rent.status === 'ready' ? rent.data : null), [costMode, settings, rent]);

  useEffect(() => logEvent('compare:view', view), [view, logEvent]);

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = scored
      .filter((x) => x.candidate.location)
      .map((x) => ({
        id: x.candidate.id,
        location: x.candidate.location!,
        label: `${x.rank}. ${x.candidate.name}`,
        kind: 'candidate',
        onClick: () => navigate(`/c/${x.candidate.id}`),
      }));
    if (list.length) list.push({ id: 'school', location: settings.school, label: '학교', kind: 'school' });
    return list;
  }, [scored, settings.school]);

  return (
    <Screen wide>
      <TopBar title="비교표" />
      <div className="pad-x" style={{ paddingBottom: 12 }}>
        <Segmented
          label="보기 방식"
          size="sm"
          options={[
            { value: 'table', label: '표' },
            { value: 'map', label: '지도' },
          ]}
          value={view}
          onChange={setView}
        />
      </div>
      <Body>
        {candidates.length === 0 ? (
          <EmptyState icon={<Table2 size={36} />} title="비교할 후보가 없어요" desc="후보를 추가하면 여기서 한눈에 비교할 수 있어요." />
        ) : view === 'table' ? (
          <div className="cmp-wrap">
            <table className="cmp">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">항목</span>
                  </th>
                  {scored.map((x) => (
                    <th scope="col" key={x.candidate.id}>
                      <button type="button" className="cmp__head-btn" onClick={() => navigate(`/c/${x.candidate.id}`)}>
                        <span className="cmp__rank">{x.rank}위</span>
                        <span>{x.candidate.name}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line) =>
                  'group' in line ? (
                    <tr className="cmp__group" key={line.group}>
                      <th scope="row">{line.group}</th>
                      <th colSpan={scored.length} aria-hidden="true" />
                    </tr>
                  ) : (
                    <CompareRow key={line.label} row={line} scored={scored} />
                  ),
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <KakaoMap appKey={kakaoKey} markers={markers} full ariaLabel="후보 위치 지도" />
            <ul>
              {scored.map((x) => (
                <li key={x.candidate.id}>
                  <ListRow
                    compact
                    lead={<span className={`rank${x.rank === 1 ? ' rank--top' : ''}`}>{x.rank}</span>}
                    title={x.candidate.name}
                    sub={x.candidate.location ? x.candidate.address : '위치 정보 없음'}
                    trail={
                      x.candidate.infra.school ? <span className="list-row__amount">학교 {x.candidate.infra.school.walkMin}분</span> : undefined
                    }
                    chevron
                    onClick={() => navigate(`/c/${x.candidate.id}`)}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </Body>
    </Screen>
  );
}

function CompareRow({ row, scored }: { row: Row; scored: Scored[] }) {
  const values = scored.map((x) => row.value(x));
  const known = values.filter((v): v is number => v !== null);
  // 값이 둘 이상이고 모두 같지 않을 때만 가장 좋은 칸을 강조한다
  let best: number | null = null;
  if (row.better && known.length >= 2 && new Set(known).size > 1) best = row.better === 'low' ? Math.min(...known) : Math.max(...known);
  return (
    <tr className={row.strong ? 'cmp__strong' : undefined}>
      <th scope="row">{row.label}</th>
      {scored.map((x, i) => {
        const v = values[i];
        const cls = v === null ? 'missing' : v === best ? 'best' : undefined;
        return (
          <td key={x.candidate.id} className={cls}>
            {row.show ? row.show(x) : v}
          </td>
        );
      })}
    </tr>
  );
}
