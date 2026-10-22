import { useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import type { LatLng } from '../types';
import { legalDongOf, searchLocation, type PlaceHit } from '../lib/kakao';
import { Button, TextField } from '../ui/controls';
import { ListRow } from '../ui/layout';

export interface PickedLocation {
  address: string;
  location: LatLng;
  dong?: string;
}

interface Props {
  kakaoKey: string;
  value: PickedLocation | null;
  onChange: (v: PickedLocation | null) => void;
  /** 이 근처 장소를 먼저 찾는다(학교 위치) */
  near?: LatLng;
}

/** 주소나 건물 이름으로 검색해 후보 위치를 고른다 */
export function LocationSearch({ kakaoKey, value, onChange, near }: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PlaceHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    setError('');
    try {
      setHits(await searchLocation(kakaoKey, q, near));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pick = async (h: PlaceHit) => {
    setBusy(true);
    // 법정동을 못 찾아도 위치는 쓸 수 있으니 실패는 조용히 넘긴다
    const dong = await legalDongOf(kakaoKey, h.location).catch(() => undefined);
    setBusy(false);
    onChange({ address: h.shortAddress, location: h.location, dong });
    setHits(null);
    setQuery('');
  };

  if (value) {
    return (
      <div className="stack gap-2">
        <span className="field__label">위치</span>
        <div className="row gap-3" style={{ padding: '12px 14px', borderRadius: 'var(--radius-m)', background: 'var(--fill-weak)', border: '1px solid var(--border-secondary)' }}>
          <MapPin size={20} aria-hidden="true" style={{ flex: 'none', color: 'var(--grey-600)' }} />
          <div className="stack" style={{ flex: 1, minWidth: 0 }}>
            <span className="t-body2" style={{ fontWeight: 600 }}>
              {value.address}
            </span>
            {value.dong && <span className="helper">{value.dong}</span>}
          </div>
          <Button variant="ghost" size="s" onClick={() => onChange(null)}>
            바꾸기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack gap-2">
      <form
        className="row gap-2"
        style={{ alignItems: 'flex-end' }}
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <div style={{ flex: 1 }}>
          <TextField
            label="위치"
            placeholder="도로명 주소, 지번, 건물 이름"
            value={query}
            icon={<Search size={18} />}
            onChange={(e) => setQuery(e.target.value)}
            enterKeyHint="search"
          />
        </div>
        <Button type="submit" variant="secondary" size="l" loading={busy}>
          검색
        </Button>
      </form>
      {error && <p className="field__help c-danger">{error}</p>}
      {!hits && !error && <p className="field__help">매물 앱에 나온 주소나 근처 건물 이름으로 찾아요. 정확한 호수는 몰라도 돼요.</p>}
      {hits && hits.length === 0 && <p className="field__help">찾지 못했어요. 도로명 주소나 건물 이름으로 다시 검색해 주세요.</p>}
      {hits && hits.length > 0 && (
        <div style={{ margin: '0 calc(-1 * var(--gutter))' }} role="list" aria-label="검색 결과">
          {hits.map((h) => (
            <ListRow key={h.id} compact title={h.title} sub={h.address} onClick={() => pick(h)} />
          ))}
        </div>
      )}
    </div>
  );
}
