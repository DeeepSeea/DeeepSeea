export type InfraKey = 'school' | 'bus' | 'subway' | 'mart' | 'convenience' | 'park';
export type CriterionKey = InfraKey | 'cost' | 'condition';

export const INFRA_KEYS: InfraKey[] = ['school', 'bus', 'subway', 'mart', 'convenience', 'park'];
export const CRITERIA: CriterionKey[] = ['cost', ...INFRA_KEYS, 'condition'];

export const INFRA_LABEL: Record<InfraKey, string> = {
  school: '학교',
  bus: '버스 정류장',
  subway: '지하철역',
  mart: '마트',
  convenience: '편의점',
  park: '공원',
};

export const CRITERION_LABEL: Record<CriterionKey, string> = {
  ...INFRA_LABEL,
  school: '학교까지 거리',
  cost: '월 총 주거비',
  condition: '방 상태',
};

export interface LatLng {
  lat: number;
  lng: number;
}

/** 후보에서 가장 가까운 인프라 한 곳 */
export interface InfraResult {
  name: string;
  /** 추정 도보 시간(분) */
  walkMin: number;
  /** 직선 거리(m). 직접 입력한 경우 없음 */
  distanceM?: number;
  location?: LatLng;
  /** 'auto' = 지도 API 계산, 'manual' = 사용자 직접 입력 */
  source: 'auto' | 'manual';
}

/** 실거래가 자료 구분과 맞춘 방 유형 */
export type HouseType = 'dagagu' | 'officetel' | 'unknown';
export const HOUSE_TYPE_LABEL: Record<HouseType, string> = {
  dagagu: '원룸·다가구',
  officetel: '오피스텔',
  unknown: '잘 모름',
};

export type WindowDirection = '남' | '남동' | '남서' | '동' | '서' | '북동' | '북서' | '북';
export type MoldLevel = 'none' | 'some' | 'lots';
export type CommuteMode = 'auto' | 'walk' | 'transit';

/** 현장 기록. 확인하지 않은 항목은 undefined */
export interface FieldRecord {
  windowDirection?: WindowDirection;
  windowCount?: number;
  crossVentilation?: boolean;
  /** 1(약함) ~ 5(셈) */
  waterPressure?: number;
  mold?: MoldLevel;
  /** 1(시끄러움) ~ 5(조용함) */
  quietness?: number;
  memo?: string;
  /** IndexedDB에 저장된 사진 id */
  photoIds: string[];
}

export interface Candidate {
  id: string;
  name: string;
  address: string;
  location?: LatLng;
  /** 법정동 이름(예: 복정동). 동 단위 시세를 찾을 때 쓴다 */
  dong?: string;
  houseType: HouseType;
  /** 금액은 모두 원 단위 */
  deposit: number;
  monthlyRent: number;
  maintenanceFee: number;
  commuteMode: CommuteMode;
  infra: Partial<Record<InfraKey, InfraResult>>;
  field: FieldRecord;
  createdAt: number;
  updatedAt: number;
}

/** 0 상관없어요, 1 조금, 2 중요해요, 3 아주 중요해요 */
export type Importance = 0 | 1 | 2 | 3;
export type Weights = Record<CriterionKey, Importance>;

export type FareType = 'bus' | 'subway' | 'custom';

export interface Settings {
  onboarded: boolean;
  weights: Weights;
  schoolName: string;
  school: LatLng;
  fareType: FareType;
  /** 편도 교통 요금(원) */
  oneWayFare: number;
  commuteDaysPerWeek: number;
  /** commuteMode가 'auto'일 때, 학교까지 이 시간(분)을 넘으면 대중교통으로 다닌다고 본다 */
  walkLimitMin: number;
  /** 배포 설정에 키가 없을 때 사용자가 직접 넣는 카카오 JavaScript 키 */
  kakaoKey: string;
}

/** 'total' = 월 총 주거비, 'rentOnly' = 월세와 관리비만(사용성 테스트 가정 5) */
export type CostMode = 'total' | 'rentOnly';

export type TestPhase = 'rentOnly' | 'total';

export interface TestPick {
  phase: TestPhase;
  at: number;
  candidateIds: string[];
  names: string[];
  reason: string;
}

export interface TestSession {
  id: string;
  participant: string;
  round: 1 | 2;
  method: 'app' | 'baseline';
  /** 가정 5: 월세만 보고 고른 뒤 총 주거비를 보고 다시 고르기 */
  rentFirst: boolean;
  startedAt: number;
  endedAt?: number;
  phase: TestPhase;
  helpCount: number;
  notes: { at: number; screen: string; text: string }[];
  events: { at: number; type: string; detail?: string }[];
  picks: TestPick[];
  /** 중간에 그만둔 경우 */
  aborted?: boolean;
}
