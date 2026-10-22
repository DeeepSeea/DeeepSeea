import { useEffect, useRef, useState } from 'react';
import type { LatLng } from '../types';
import { loadKakao } from '../lib/kakao';

export interface MapMarker {
  id: string;
  location: LatLng;
  label: string;
  kind: 'candidate' | 'school' | 'infra';
  onClick?: () => void;
}

interface Props {
  appKey: string;
  markers: MapMarker[];
  full?: boolean;
  ariaLabel: string;
}

/** 카카오 지도 위에 둥근 알약 모양 표시를 올린다. 키가 없거나 불러오지 못하면 안내 문구를 보인다 */
export function KakaoMap({ appKey, markers, full, ariaLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  // 부모가 렌더링할 때마다 새 배열을 넘겨도 내용이 같으면 지도를 다시 그리지 않는다
  const latest = useRef(markers);
  latest.current = markers;
  const signature = JSON.stringify(markers.map((m) => [m.id, m.location.lat, m.location.lng, m.label, m.kind]));

  useEffect(() => {
    const list = latest.current;
    if (!appKey || !ref.current || list.length === 0) return;
    let cancelled = false;
    const overlays: { setMap: (m: unknown) => void }[] = [];
    loadKakao(appKey)
      .then((kakao) => {
        if (cancelled || !ref.current) return;
        const { maps } = kakao;
        const first = list[0].location;
        const map = new maps.Map(ref.current, { center: new maps.LatLng(first.lat, first.lng), level: 4 });
        const bounds = new maps.LatLngBounds();
        for (const m of list) {
          const pos = new maps.LatLng(m.location.lat, m.location.lng);
          const el = document.createElement(m.onClick ? 'button' : 'div');
          el.className = `pin pin--${m.kind}`;
          el.textContent = m.label;
          if (m.onClick) {
            const id = m.id;
            el.addEventListener('click', () => latest.current.find((x) => x.id === id)?.onClick?.());
          }
          const overlay = new maps.CustomOverlay({ position: pos, content: el, yAnchor: 1.2, zIndex: m.kind === 'candidate' ? 3 : 1 });
          overlay.setMap(map);
          overlays.push(overlay);
          bounds.extend(pos);
        }
        if (list.length > 1) map.setBounds(bounds, 48, 48, 48, 48);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      overlays.forEach((o) => o.setMap(null));
    };
  }, [appKey, signature]);

  const placeholder = !appKey
    ? '카카오 지도를 연결하면 지도에서 위치를 볼 수 있어요.'
    : markers.length === 0
      ? '위치를 찾은 후보가 아직 없어요.'
      : error;

  return (
    <div className={`map${full ? ' map--full' : ''}`} role="region" aria-label={ariaLabel}>
      {placeholder ? <div className="map__placeholder">{placeholder}</div> : <div ref={ref} style={{ width: '100%', height: '100%' }} />}
    </div>
  );
}
