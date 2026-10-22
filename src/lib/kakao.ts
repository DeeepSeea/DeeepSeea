import type { InfraKey, InfraResult, LatLng } from '../types';
import { estimateWalkMin, haversineM } from './geo';

/* 카카오맵 JavaScript SDK는 타입을 제공하지 않아 필요한 부분만 any로 다룬다 */
type Kakao = any;

declare global {
  interface Window {
    kakao?: Kakao;
  }
}

export class KakaoError extends Error {}

let loading: Promise<Kakao> | null = null;
let loadedKey = '';

/** 카카오맵 SDK(services 라이브러리 포함)를 한 번만 불러온다 */
export function loadKakao(appKey: string): Promise<Kakao> {
  if (!appKey) return Promise.reject(new KakaoError('카카오 지도 키가 없어요.'));
  if (loading && loadedKey === appKey) return loading;
  loadedKey = appKey;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&libraries=services&autoload=false`;
    script.onload = () => {
      if (!window.kakao?.maps) {
        loading = null;
        reject(new KakaoError('카카오 지도를 불러오지 못했어요. 키와 등록한 도메인을 확인해 주세요.'));
        return;
      }
      window.kakao.maps.load(() => resolve(window.kakao));
    };
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new KakaoError('카카오 지도에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

function callService<T>(kakao: Kakao, run: (cb: (result: T[], status: string) => void) => void): Promise<T[]> {
  const { Status } = kakao.maps.services;
  return new Promise((resolve, reject) =>
    run((result, status) => {
      if (status === Status.OK) resolve(result);
      else if (status === Status.ZERO_RESULT) resolve([]);
      else reject(new KakaoError('카카오 지도 검색이 잠시 안 돼요. 잠시 뒤 다시 시도해 주세요.'));
    }),
  );
}

export interface PlaceHit {
  id: string;
  title: string;
  /** 목록에 보여 줄 주소(도로명과 지번) */
  address: string;
  /** 후보에 저장할 짧은 주소(도로명, 없으면 지번) */
  shortAddress: string;
  location: LatLng;
}

/**
 * 주소나 건물 이름으로 위치 후보를 찾는다. 주소 검색 결과를 먼저, 장소 검색 결과를 뒤에 둔다.
 * near를 주면 장소 검색을 그 주변 20km로 좁혀 다른 지역의 같은 이름 건물이 섞이지 않게 한다.
 */
export async function searchLocation(appKey: string, query: string, near?: LatLng): Promise<PlaceHit[]> {
  const kakao = await loadKakao(appKey);
  const { services } = kakao.maps;
  type Addr = { address_name: string; x: string; y: string; road_address?: { address_name: string; building_name?: string } | null };
  type Place = { id: string; place_name: string; address_name: string; road_address_name: string; x: string; y: string };

  const [addrs, places] = await Promise.all([
    callService<Addr>(kakao, (cb) => new services.Geocoder().addressSearch(query, cb)),
    callService<Place>(kakao, (cb) =>
      new services.Places().keywordSearch(
        query,
        cb,
        near ? { size: 10, location: new kakao.maps.LatLng(near.lat, near.lng), radius: 20000 } : { size: 10 },
      ),
    ),
  ]);

  const hits: PlaceHit[] = [
    ...addrs.map((a, i) => ({
      id: `addr-${i}`,
      title: a.road_address?.building_name || a.road_address?.address_name || a.address_name,
      address: a.road_address?.address_name ? `${a.road_address.address_name} (${a.address_name})` : a.address_name,
      shortAddress: a.road_address?.address_name || a.address_name,
      location: { lat: Number(a.y), lng: Number(a.x) },
    })),
    ...places.map((p) => ({
      id: `place-${p.id}`,
      title: p.place_name,
      address: p.road_address_name || p.address_name,
      shortAddress: p.road_address_name || p.address_name,
      location: { lat: Number(p.y), lng: Number(p.x) },
    })),
  ];
  return hits.slice(0, 12);
}

/** 좌표 → 법정동 이름(예: 복정동). 실거래가 자료가 법정동 기준이라 행정동이 아닌 법정동을 쓴다 */
export async function legalDongOf(appKey: string, loc: LatLng): Promise<string | undefined> {
  const kakao = await loadKakao(appKey);
  type Region = { region_type: string; region_3depth_name: string };
  const regions = await callService<Region>(kakao, (cb) => new kakao.maps.services.Geocoder().coord2RegionCode(loc.lng, loc.lat, cb));
  return regions.find((r) => r.region_type === 'B')?.region_3depth_name || undefined;
}

interface PlaceResult {
  place_name: string;
  category_name: string;
  distance: string;
  x: string;
  y: string;
}

/**
 * 카카오 장소 검색 기준. 버스 정류장과 공원은 카테고리 코드가 없어 키워드로 찾고,
 * 마트는 대형마트(MT1)와 동네 슈퍼를 함께 찾아 더 가까운 곳을 쓴다.
 */
const SEARCHES: Record<Exclude<InfraKey, 'school'>, { category?: string; keyword?: string; radius: number; accept?: (p: PlaceResult) => boolean }[]> = {
  bus: [{ keyword: '버스정류장', radius: 1500, accept: (p) => /버스정류장|정류장|정류소/.test(`${p.category_name} ${p.place_name}`) }],
  subway: [{ category: 'SW8', radius: 5000 }],
  mart: [
    { category: 'MT1', radius: 5000 },
    { keyword: '마트', radius: 3000, accept: (p) => /마트|슈퍼/.test(p.category_name) },
  ],
  convenience: [{ category: 'CS2', radius: 2000 }],
  park: [{ keyword: '공원', radius: 3000, accept: (p) => /공원/.test(p.category_name) }],
};

async function nearest(kakao: Kakao, origin: LatLng, key: Exclude<InfraKey, 'school'>): Promise<InfraResult | undefined> {
  const { services } = kakao.maps;
  const places = new services.Places();
  const found: InfraResult[] = [];
  for (const q of SEARCHES[key]) {
    const opt = { location: new kakao.maps.LatLng(origin.lat, origin.lng), radius: q.radius, sort: services.SortBy.DISTANCE };
    const results = await callService<PlaceResult>(kakao, (cb) =>
      q.category ? places.categorySearch(q.category, cb, opt) : places.keywordSearch(q.keyword, cb, opt),
    );
    const hit = results.find((p) => (q.accept ? q.accept(p) : true));
    if (!hit) continue;
    const location = { lat: Number(hit.y), lng: Number(hit.x) };
    const distanceM = Number(hit.distance) || haversineM(origin, location);
    found.push({ name: hit.place_name, distanceM, walkMin: estimateWalkMin(distanceM), location, source: 'auto' });
  }
  return found.sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0))[0];
}

/** 후보 위치에서 6개 인프라 항목까지의 거리를 계산한다. 못 찾은 항목은 빠진다 */
export async function computeInfra(
  appKey: string,
  origin: LatLng,
  school: { name: string; location: LatLng },
): Promise<Partial<Record<InfraKey, InfraResult>>> {
  const kakao = await loadKakao(appKey);
  const schoolM = haversineM(origin, school.location);
  const out: Partial<Record<InfraKey, InfraResult>> = {
    school: { name: school.name, distanceM: schoolM, walkMin: estimateWalkMin(schoolM), location: school.location, source: 'auto' },
  };
  const keys = Object.keys(SEARCHES) as Exclude<InfraKey, 'school'>[];
  const found = await Promise.all(keys.map((k) => nearest(kakao, origin, k)));
  keys.forEach((k, i) => {
    if (found[i]) out[k] = found[i];
  });
  return out;
}
