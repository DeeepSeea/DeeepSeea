import { useState } from 'react';
import { Search } from 'lucide-react';
import type { FareType, Settings } from '../types';
import { FARE_PRESETS, monthlyCommuteDays } from '../lib/cost';
import { searchLocation, type PlaceHit } from '../lib/kakao';
import { formatWon } from '../lib/format';
import { Button, NumericSpinner, Segmented, TextField } from '../ui/controls';
import { ListRow } from '../ui/layout';

interface Props {
  settings: Settings;
  kakaoKey: string;
  onChange: (patch: Partial<Settings>) => void;
}

const FARE_OPTIONS: { value: FareType; label: string }[] = [
  { value: 'bus', label: '버스' },
  { value: 'subway', label: '지하철' },
  { value: 'custom', label: '직접 입력' },
];

export function CommuteEditor({ settings, kakaoKey, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PlaceHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError('');
    try {
      setHits(await searchLocation(kakaoKey, query.trim()));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const days = monthlyCommuteDays(settings.commuteDaysPerWeek);

  return (
    <div className="stack gap-6 pad-x">
      <div className="stack gap-2">
        <span className="field__label">학교</span>
        <p className="t-title2">{settings.schoolName}</p>
        {kakaoKey ? (
          <>
            <form
              className="row gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                search();
              }}
            >
              <div style={{ flex: 1 }}>
                <TextField
                  aria-label="학교 위치 검색"
                  placeholder="다른 학교나 건물 이름으로 바꾸기"
                  value={query}
                  icon={<Search size={18} />}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Button type="submit" variant="secondary" size="l" loading={searching}>
                검색
              </Button>
            </form>
            {error && <p className="field__help c-danger">{error}</p>}
            {hits && hits.length === 0 && <p className="helper">찾지 못했어요. 건물 이름이나 도로명 주소로 다시 검색해 주세요.</p>}
            {hits && hits.length > 0 && (
              <div style={{ margin: '0 calc(-1 * var(--gutter))' }}>
                {hits.slice(0, 5).map((h) => (
                  <ListRow
                    key={h.id}
                    compact
                    title={h.title}
                    sub={h.address}
                    onClick={() => {
                      onChange({ schoolName: h.title, school: h.location });
                      setHits(null);
                      setQuery('');
                    }}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="helper">카카오 지도를 연결하면 다른 학교나 건물로 바꿀 수 있어요.</p>
        )}
      </div>

      <div className="stack gap-2">
        <span className="field__label">일주일에 학교 가는 날</span>
        <div className="row gap-3">
          <NumericSpinner label="일주일 통학 일수" value={settings.commuteDaysPerWeek} min={0} max={7} unit="일" onChange={(v) => onChange({ commuteDaysPerWeek: v })} />
          <span className="helper">한 달에 약 {days}일</span>
        </div>
      </div>

      <div className="stack gap-2">
        <span className="field__label">편도 교통 요금</span>
        <Segmented
          label="교통 요금 종류"
          options={FARE_OPTIONS}
          value={settings.fareType}
          onChange={(v) => onChange(v === 'custom' ? { fareType: v } : { fareType: v, oneWayFare: FARE_PRESETS[v].won })}
        />
        {settings.fareType === 'custom' ? (
          <TextField
            aria-label="편도 교통 요금"
            inputMode="numeric"
            suffix="원"
            value={settings.oneWayFare ? String(settings.oneWayFare) : ''}
            onChange={(e) => onChange({ oneWayFare: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 })}
          />
        ) : (
          <p className="helper">
            {FARE_PRESETS[settings.fareType].label} 교통카드 성인 요금 {formatWon(FARE_PRESETS[settings.fareType].won)}이에요. 환승과 경기패스 환급은 넣지 않았어요.
          </p>
        )}
      </div>

      <div className="stack gap-2">
        <span className="field__label">걸어서 다닐 만한 시간</span>
        <div className="row gap-3">
          <NumericSpinner label="도보 통학 한계" value={settings.walkLimitMin} min={5} max={60} step={5} unit="분" onChange={(v) => onChange({ walkLimitMin: v })} />
        </div>
        <p className="helper">학교까지 이보다 오래 걸리는 방은 대중교통으로 다닌다고 보고 교통비를 더해요.</p>
      </div>
    </div>
  );
}
