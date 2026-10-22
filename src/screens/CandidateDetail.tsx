import { useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useStore } from '../store';
import { navigate } from '../router';
import { CRITERIA, CRITERION_LABEL, HOUSE_TYPE_LABEL, INFRA_KEYS, INFRA_LABEL, type Candidate, type CommuteMode, type HouseType, type InfraKey } from '../types';
import { conditionParts, MOLD_LABEL, scoreCandidates } from '../lib/score';
import { monthlyCommuteCost, monthlyCommuteDays, usesTransit } from '../lib/cost';
import { computeInfra } from '../lib/kakao';
import { formatDistance, formatWon, josa } from '../lib/format';
import { deletePhoto } from '../lib/storage';
import { findStat, formatYm, percentileWord, rentPercentile, useRentStats } from '../lib/rentStats';
import { Badge, Body, BottomCTA, KV, ListRow, Note, Screen, SectionTitle, TopBar, Band } from '../ui/layout';
import { Button, Segmented, TextField } from '../ui/controls';
import { BottomSheet, useToast } from '../ui/overlay';
import { CriterionIcon } from '../components/icons';
import { KakaoMap, type MapMarker } from '../components/KakaoMap';
import { Photo } from '../components/Photo';

const IMPORTANCE_LABEL = ['상관없음', '조금', '중요', '아주 중요'];
const COMMUTE_OPTIONS: { value: CommuteMode; label: string }[] = [
  { value: 'auto', label: '자동' },
  { value: 'walk', label: '걸어서' },
  { value: 'transit', label: '대중교통' },
];

export default function CandidateDetail({ id }: { id: string }) {
  const { candidates, settings, costMode, kakaoKey, updateCandidate, removeCandidate } = useStore();
  const toast = useToast();
  const scored = useMemo(() => scoreCandidates(candidates, settings, costMode), [candidates, settings, costMode]);
  const me = scored.find((x) => x.candidate.id === id);
  const c = me?.candidate;

  const [editKey, setEditKey] = useState<InfraKey | null>(null);
  const [minutes, setMinutes] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [recomputing, setRecomputing] = useState(false);

  const markers = useMemo<MapMarker[]>(() => {
    if (!c?.location) return [];
    const list: MapMarker[] = [{ id: 'me', location: c.location, label: c.name, kind: 'candidate' }];
    for (const k of INFRA_KEYS) {
      const r = c.infra[k];
      if (r?.location && r.source === 'auto') list.push({ id: k, location: r.location, label: k === 'school' ? '학교' : INFRA_LABEL[k], kind: k === 'school' ? 'school' : 'infra' });
    }
    return list;
  }, [c]);

  if (!c || !me) {
    return (
      <Screen>
        <TopBar title="후보" />
        <Body>
          <Note>이 후보를 찾지 못했어요. 이미 지웠을 수 있어요.</Note>
        </Body>
      </Screen>
    );
  }

  const openEdit = (k: InfraKey) => {
    setMinutes(c.infra[k] ? String(c.infra[k]!.walkMin) : '');
    setEditKey(k);
  };

  const saveMinutes = (value: string) => {
    if (!editKey) return;
    const infra = { ...c.infra };
    const n = Number(value);
    if (value === '' || !Number.isFinite(n)) delete infra[editKey];
    else infra[editKey] = { name: '직접 넣은 값', walkMin: Math.min(600, Math.max(0, Math.round(n))), source: 'manual' };
    updateCandidate(c.id, { infra }, 'infra:edit');
    setEditKey(null);
  };

  const recompute = async () => {
    if (!c.location) return;
    setRecomputing(true);
    try {
      const infra = await computeInfra(kakaoKey, c.location, { name: settings.schoolName, location: settings.school });
      updateCandidate(c.id, { infra: { ...c.infra, ...infra } }, 'infra:recompute');
      toast('거리를 다시 계산했어요');
    } catch (e) {
      toast((e as Error).message, 'info');
    } finally {
      setRecomputing(false);
    }
  };

  const remove = async () => {
    await Promise.all(c.field.photoIds.map(deletePhoto));
    removeCandidate(c.id);
    setConfirmDelete(false);
    toast(`${c.name}${josa(c.name, '을', '를')} 지웠어요`);
    navigate('/', { replace: true });
  };

  const hasRecord = conditionParts(c.field).length > 0 || c.field.photoIds.length > 0 || !!c.field.memo;

  return (
    <Screen>
      <TopBar
        title={c.name}
        right={
          <button type="button" className="icon-btn" aria-label="후보 정보 고치기" onClick={() => navigate(`/c/${c.id}/edit`)}>
            <Pencil size={20} />
          </button>
        }
      />
      <Body cta>
        <div className="hero">
          <p className="hero__eyebrow">
            내 기준 {me.rank}위 · {candidates.length}곳 중
          </p>
          {me.total === null ? (
            <p className="t-h2" style={{ marginTop: 4 }}>
              점수를 매길 정보가 아직 없어요
            </p>
          ) : (
            <p className="hero__score">
              {me.total}
              <small>점</small>
            </p>
          )}
          <p className="hero__sub">
            {c.address || '주소 없음'}
            {c.dong ? ` · ${c.dong}` : ''} · {HOUSE_TYPE_LABEL[c.houseType]}
          </p>
        </div>

        {kakaoKey && c.location && <KakaoMap appKey={kakaoKey} markers={markers} ariaLabel={`${c.name} 주변 지도`} />}

        <CostSection c={c} cost={me.cost} />
        <RentStatsSection c={c} onChangeDong={(dong) => updateCandidate(c.id, { dong })} onChangeType={(houseType) => updateCandidate(c.id, { houseType })} />

        <Band />
        <SectionTitle
          right={
            kakaoKey && c.location ? (
              <Button variant="ghost" size="s" loading={recomputing} onClick={recompute}>
                다시 계산하기
              </Button>
            ) : undefined
          }
        >
          생활 인프라
        </SectionTitle>
        <ul>
          {INFRA_KEYS.map((k) => {
            const r = c.infra[k];
            return (
              <li key={k}>
                <ListRow
                  lead={
                    <span className="ico">
                      <CriterionIcon k={k} />
                    </span>
                  }
                  title={INFRA_LABEL[k]}
                  sub={r ? (r.source === 'manual' ? '직접 넣은 값' : `${r.name}${r.distanceM ? ` · ${formatDistance(r.distanceM)}` : ''}`) : '정보 없음'}
                  trail={r ? <span className="list-row__amount">걸어서 {r.walkMin}분</span> : <span className="t-label-s c-tertiary">넣기</span>}
                  chevron
                  onClick={() => openEdit(k)}
                />
              </li>
            );
          })}
        </ul>
        <Note>걸어서 걸리는 시간은 직선거리에 1.3을 곱해 어림한 값이에요. 언덕과 신호 대기는 넣지 않았어요. 눌러서 직접 고칠 수 있어요.</Note>

        <Band />
        <SectionTitle
          right={
            hasRecord ? (
              <Button variant="ghost" size="s" onClick={() => navigate(`/c/${c.id}/record`)}>
                고치기
              </Button>
            ) : undefined
          }
        >
          방 상태
        </SectionTitle>
        <ConditionSummary c={c} />

        <Band />
        <SectionTitle>점수는 이렇게 나왔어요</SectionTitle>
        {CRITERIA.filter((k) => settings.weights[k] > 0).map((k) => {
          const v = me.parts[k];
          return (
            <div className="score-row" key={k}>
              <span className="score-row__label">
                {CRITERION_LABEL[k]}
                <small>중요도 {IMPORTANCE_LABEL[settings.weights[k]]}</small>
              </span>
              <div className="bar" aria-hidden="true">
                <div className="bar__fill" style={{ width: `${v ?? 0}%` }} />
              </div>
              <span className="score-row__value">{v === null ? '없음' : `${v}점`}</span>
            </div>
          );
        })}
        <p className="pad-x helper" style={{ paddingTop: 8 }}>
          {me.missing.length > 0 && `${me.missing.map((k) => CRITERION_LABEL[k]).join(', ')}${josa(CRITERION_LABEL[me.missing[me.missing.length - 1]], '은', '는')} 정보가 없어 점수에서 뺐어요. `}
          중요도를 고른 항목만 중요도만큼 더해 100점 만점으로 맞췄어요.
        </p>

        <div className="pad-x" style={{ paddingTop: 32 }}>
          <Button variant="ghost-danger" size="m" onClick={() => setConfirmDelete(true)}>
            이 후보 지우기
          </Button>
        </div>
      </Body>

      <BottomCTA>
        <Button size="xl" block onClick={() => navigate(`/c/${c.id}/record`)}>
          {hasRecord ? '현장 기록 이어서 하기' : '현장 기록하기'}
        </Button>
      </BottomCTA>

      <BottomSheet
        open={editKey !== null}
        onClose={() => setEditKey(null)}
        title={editKey ? `${INFRA_LABEL[editKey]}까지 걸어서 몇 분인가요?` : ''}
        desc="지도 앱에서 확인한 시간을 넣어요. 비우면 정보 없음으로 바뀌어요."
        actions={
          <>
            <Button variant="secondary" onClick={() => saveMinutes('')}>
              지우기
            </Button>
            <Button onClick={() => saveMinutes(minutes)}>저장하기</Button>
          </>
        }
      >
        <TextField
          aria-label="걸어서 걸리는 시간"
          inputMode="numeric"
          suffix="분"
          autoFocus
          value={minutes}
          onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && saveMinutes(minutes)}
        />
      </BottomSheet>

      <BottomSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`${c.name}${josa(c.name, '을', '를')} 지울까요?`}
        desc="현장 기록과 사진도 함께 지워져요."
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              닫기
            </Button>
            <Button variant="danger" onClick={remove}>
              지우기
            </Button>
          </>
        }
      />
    </Screen>
  );
}

function CostSection({ c, cost }: { c: Candidate; cost: number }) {
  const { settings, costMode, updateCandidate } = useStore();
  const transit = usesTransit(c, settings);
  const commute = monthlyCommuteCost(c, settings);
  const days = monthlyCommuteDays(settings.commuteDaysPerWeek);
  const schoolMin = c.infra.school?.walkMin;

  let commuteSub = '걸어서 다녀요';
  if (transit) commuteSub = `${formatWon(settings.oneWayFare)} × 왕복 × ${days}일`;
  else if (c.commuteMode === 'auto' && schoolMin === undefined) commuteSub = '학교까지 거리 정보가 없어요';

  let explain = '';
  if (c.commuteMode === 'auto') {
    explain =
      schoolMin === undefined
        ? '학교까지 거리를 알면 걸어서 다닐지 대중교통을 탈지 자동으로 정해요.'
        : `학교까지 걸어서 ${schoolMin}분이라 ${transit ? '대중교통으로' : '걸어서'} 다닌다고 봤어요. 기준은 ${settings.walkLimitMin}분이에요.`;
  }

  return (
    <>
      <SectionTitle>{costMode === 'total' ? '월 총 주거비' : '월세와 관리비'}</SectionTitle>
      <KV label="월세" value={formatWon(c.monthlyRent)} />
      <KV label="관리비" value={formatWon(c.maintenanceFee)} />
      {costMode === 'total' && <KV label="통학 교통비" sub={commuteSub} value={formatWon(commute)} />}
      <KV total label="한 달에" value={formatWon(cost)} />
      <KV label="보증금" sub="한 달 비용에는 넣지 않았어요" value={formatWon(c.deposit)} />
      {costMode === 'total' && (
        <div className="pad-x stack gap-2" style={{ paddingTop: 16 }}>
          <span className="field__label">통학 방법</span>
          <Segmented label="통학 방법" options={COMMUTE_OPTIONS} value={c.commuteMode} onChange={(v) => updateCandidate(c.id, { commuteMode: v }, 'commute')} />
          {explain && <p className="helper">{explain}</p>}
        </div>
      )}
    </>
  );
}

function RentStatsSection({ c, onChangeDong, onChangeType }: { c: Candidate; onChangeDong: (d: string) => void; onChangeType: (t: HouseType) => void }) {
  const state = useRentStats();
  if (state.status !== 'ready') return null;
  const file = state.data;
  const stat = findStat(file, c.dong, c.houseType);
  const dongs = [...new Set(file.stats.map((s) => s.dong))].sort((a, b) => a.localeCompare(b, 'ko'));
  const rentManwon = c.monthlyRent / 10000;

  return (
    <>
      <Band />
      <SectionTitle>동네 월세 시세</SectionTitle>
      {c.houseType === 'unknown' ? (
        <div className="pad-x stack gap-2">
          <p className="helper">방 유형을 고르면 같은 유형의 실거래 시세를 보여 드려요.</p>
          <Segmented
            label="방 유형"
            options={[
              { value: 'dagagu', label: HOUSE_TYPE_LABEL.dagagu },
              { value: 'officetel', label: HOUSE_TYPE_LABEL.officetel },
            ]}
            value={undefined}
            onChange={(v) => onChangeType(v as HouseType)}
          />
        </div>
      ) : !c.dong || !dongs.includes(c.dong) ? (
        <div className="pad-x stack gap-2">
          <p className="helper">{c.dong ? `${c.dong} 실거래 자료가 없어요. 가까운 동을 골라 볼 수 있어요.` : '이 방이 있는 동을 골라 주세요.'}</p>
          <select className="input" aria-label="동 고르기" value="" onChange={(e) => e.target.value && onChangeDong(e.target.value)}>
            <option value="">동 고르기</option>
            {dongs.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      ) : !stat ? (
        <p className="pad-x helper">
          {c.dong} {HOUSE_TYPE_LABEL[c.houseType]} 실거래 자료가 없어요.
        </p>
      ) : (
        <>
          <KV label={`${c.dong} ${HOUSE_TYPE_LABEL[c.houseType]} 월세 중간값`} value={formatWon(stat.rent.p50 * 10000)} />
          <KV label="흔한 범위" sub="실거래 가운데 50%" value={`${formatWon(stat.rent.p25 * 10000)}~${formatWon(stat.rent.p75 * 10000)}`} />
          <KV label="보증금 중간값" value={formatWon(stat.deposit.p50 * 10000)} />
          <div className="pad-x" style={{ paddingTop: 8 }}>
            <p className="t-body2">
              이 방 월세는 <strong>{percentileWord(rentPercentile(rentManwon, stat.rentDeciles))}</strong>이에요{' '}
              <Badge>하위 {rentPercentile(rentManwon, stat.rentDeciles)}%</Badge>
            </p>
          </div>
          <Note>
            {formatYm(file.period.from)}부터 {formatYm(file.period.to)}까지 국토교통부 전월세 실거래 {stat.count}건 기준이에요. 보증금에 따라 월세가 달라서 참고로만 봐 주세요.
          </Note>
        </>
      )}
    </>
  );
}

function ConditionSummary({ c }: { c: Candidate }) {
  const f = c.field;
  const parts = conditionParts(f);
  if (parts.length === 0 && f.photoIds.length === 0 && !f.memo) {
    return <p className="pad-x helper">아직 현장 기록이 없어요. 집을 보러 가서 채광, 환기, 수압, 곰팡이, 소음을 기록해 주세요.</p>;
  }
  const detail: Record<string, string> = {
    light: f.windowDirection ? `${f.windowDirection}향` : '',
    air: [f.windowCount !== undefined ? `창 ${f.windowCount}개` : '', f.crossVentilation ? '맞통풍 돼요' : f.crossVentilation === false ? '맞통풍 안 돼요' : '']
      .filter(Boolean)
      .join(', '),
    water: '',
    mold: f.mold ? MOLD_LABEL[f.mold] : '',
    noise: '',
  };
  return (
    <>
      {parts.map((p) => (
        <KV key={p.key} label={p.label} sub={detail[p.key] || undefined} value={`${p.value}/5`} />
      ))}
      {f.photoIds.length > 0 && (
        <div className="photo-strip" style={{ paddingTop: 12 }}>
          {f.photoIds.map((pid) => (
            <Photo key={pid} id={pid} />
          ))}
        </div>
      )}
      {f.memo && <p className="pad-x t-body2 c-secondary pre-line" style={{ paddingTop: 8 }}>{f.memo}</p>}
    </>
  );
}
