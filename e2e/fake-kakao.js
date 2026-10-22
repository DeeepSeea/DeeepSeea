/*
 * e2e 테스트용 가짜 카카오맵 SDK. 실제 SDK와 같은 이름의 API를 흉내 내고,
 * 가천대 글로벌캠퍼스 주변의 정해진 위치와 장소를 돌려준다.
 */
(function () {
  const M_PER_DEG_LAT = 111000;
  const mPerDegLng = (lat) => 111000 * Math.cos((lat * Math.PI) / 180);
  const offset = (loc, northM, eastM) => ({ lat: loc.lat + northM / M_PER_DEG_LAT, lng: loc.lng + eastM / mPerDegLng(loc.lat) });
  const dist = (a, b) => {
    const dy = (a.lat - b.lat) * M_PER_DEG_LAT;
    const dx = (a.lng - b.lng) * mPerDegLng(a.lat);
    return Math.round(Math.sqrt(dx * dx + dy * dy));
  };

  const SCHOOL = { lat: 37.4508, lng: 127.1274 };
  const SPOTS = [
    { match: /정문|복정/, name: '복정동 495', road: '경기 성남시 수정구 복정로 12', building: '정문빌', dong: '복정동', loc: offset(SCHOOL, 420, 120) },
    { match: /태평/, name: '태평동 7270', road: '경기 성남시 수정구 태평로 33', building: '태평하우스', dong: '태평동', loc: offset(SCHOOL, -900, 700) },
    { match: /신흥/, name: '신흥동 2459', road: '경기 성남시 수정구 신흥로 101', building: '신흥오피스텔', dong: '신흥동', loc: offset(SCHOOL, -1900, -900) },
  ];
  const spotFor = (q) => SPOTS.find((s) => s.match.test(q));
  const nearestSpot = (loc) => SPOTS.reduce((best, s) => (dist(s.loc, loc) < dist(best.loc, loc) ? s : best), SPOTS[0]);

  // 위치마다 조금씩 다르게 보이도록 후보 위치에 따라 거리를 바꾼다
  const PLACES = {
    SW8: { name: '가천대역 수인분당선', category: '교통,수송 > 지하철,전철 > 수인분당선', north: 600, east: -300 },
    MT1: { name: '이마트 성남점', category: '가정,생활 > 대형마트 > 이마트', north: -1600, east: 1200 },
    CS2: { name: 'GS25 가천점', category: '가정,생활 > 편의점 > GS25', north: 60, east: 40 },
    버스정류장: { name: '가천대학교.가천대역', category: '교통,수송 > 교통시설 > 버스정류장', north: 90, east: -80 },
    마트: { name: '복정 할인마트', category: '가정,생활 > 슈퍼마켓', north: 250, east: 200 },
    공원: { name: '복정근린공원', category: '여행 > 공원 > 근린공원', north: -300, east: 260 },
  };

  class LatLng {
    constructor(lat, lng) {
      this.lat = lat;
      this.lng = lng;
    }
    getLat() {
      return this.lat;
    }
    getLng() {
      return this.lng;
    }
  }
  class LatLngBounds {
    constructor() {
      this.pts = [];
    }
    extend(p) {
      this.pts.push(p);
    }
  }

  class Map {
    constructor(el, opts) {
      this.el = el;
      this.center = { lat: opts.center.lat, lng: opts.center.lng };
      this.mPerPx = 4;
      this.overlays = [];
      el.style.position = 'relative';
      el.style.overflow = 'hidden';
      el.style.background =
        'repeating-linear-gradient(0deg, #eef1f4 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, #eef1f4 0 1px, transparent 1px 40px), #f7f8fa';
    }
    setBounds(b) {
      const lats = b.pts.map((p) => p.lat);
      const lngs = b.pts.map((p) => p.lng);
      this.center = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 };
      const spanN = (Math.max(...lats) - Math.min(...lats)) * M_PER_DEG_LAT;
      const spanE = (Math.max(...lngs) - Math.min(...lngs)) * mPerDegLng(this.center.lat);
      const w = this.el.clientWidth - 140;
      const h = this.el.clientHeight - 90;
      this.mPerPx = Math.max(spanN / Math.max(h, 1), spanE / Math.max(w, 1), 1);
      this.overlays.forEach((o) => o.place());
    }
    project(p) {
      const x = ((p.lng - this.center.lng) * mPerDegLng(this.center.lat)) / this.mPerPx + this.el.clientWidth / 2;
      const y = (-(p.lat - this.center.lat) * M_PER_DEG_LAT) / this.mPerPx + this.el.clientHeight / 2;
      return { x, y };
    }
    relayout() {}
  }

  class CustomOverlay {
    constructor(o) {
      this.o = o;
    }
    setMap(map) {
      if (!map) {
        this.wrap?.remove();
        return;
      }
      this.map = map;
      this.wrap = document.createElement('div');
      this.wrap.style.position = 'absolute';
      this.wrap.style.transform = 'translate(-50%, -100%)';
      this.wrap.style.zIndex = String(this.o.zIndex ?? 1);
      this.wrap.appendChild(this.o.content);
      map.el.appendChild(this.wrap);
      map.overlays.push(this);
      this.place();
    }
    place() {
      const { x, y } = this.map.project(this.o.position);
      this.wrap.style.left = `${x}px`;
      this.wrap.style.top = `${y}px`;
    }
  }

  const Status = { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT', ERROR: 'ERROR' };
  const later = (fn) => setTimeout(fn, 30);

  class Geocoder {
    addressSearch(q, cb) {
      const s = spotFor(q);
      later(() =>
        s
          ? cb(
              [
                {
                  address_name: `경기 성남시 수정구 ${s.name}`,
                  x: String(s.loc.lng),
                  y: String(s.loc.lat),
                  road_address: { address_name: s.road, building_name: s.building },
                },
              ],
              Status.OK,
            )
          : cb([], Status.ZERO_RESULT),
      );
    }
    coord2RegionCode(x, y, cb) {
      const s = nearestSpot({ lat: Number(y), lng: Number(x) });
      later(() =>
        cb(
          [
            { region_type: 'H', region_3depth_name: `${s.dong.replace('동', '')}1동` },
            { region_type: 'B', region_3depth_name: s.dong },
          ],
          Status.OK,
        ),
      );
    }
  }

  function placeAround(key, opt) {
    const p = PLACES[key];
    if (!p) return [];
    const origin = { lat: opt.location.getLat(), lng: opt.location.getLng() };
    // 후보마다 거리가 조금 달라지게 위도에 따라 비틀어 준다
    const twist = 1 + ((Math.abs(origin.lat * 10000) % 7) - 3) / 10;
    const loc = offset(origin, p.north * twist, p.east * twist);
    const d = dist(origin, loc);
    if (opt.radius && d > opt.radius) return [];
    return [{ id: key, place_name: p.name, category_name: p.category, distance: String(d), x: String(loc.lng), y: String(loc.lat), address_name: '', road_address_name: '' }];
  }

  class Places {
    keywordSearch(q, cb, opt = {}) {
      // 인프라 검색(버스정류장, 마트, 공원)은 주변 장소를, 그 밖의 검색어는 정해진 건물을 돌려준다
      if (opt.location && PLACES[q]) {
        const r = placeAround(q, opt);
        later(() => cb(r, r.length ? Status.OK : Status.ZERO_RESULT));
        return;
      }
      const s = spotFor(q);
      later(() =>
        s
          ? cb([{ id: 'p1', place_name: s.building, address_name: `경기 성남시 수정구 ${s.name}`, road_address_name: s.road, x: String(s.loc.lng), y: String(s.loc.lat) }], Status.OK)
          : cb([], Status.ZERO_RESULT),
      );
    }
    categorySearch(code, cb, opt) {
      const r = placeAround(code, opt);
      later(() => cb(r, r.length ? Status.OK : Status.ZERO_RESULT));
    }
  }

  window.kakao = {
    maps: {
      load: (cb) => setTimeout(cb, 0),
      LatLng,
      LatLngBounds,
      Map,
      CustomOverlay,
      services: { Status, SortBy: { DISTANCE: 'distance', ACCURACY: 'accuracy' }, Geocoder, Places },
    },
  };
})();
