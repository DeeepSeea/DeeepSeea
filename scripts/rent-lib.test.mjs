import { describe, expect, it } from 'vitest';
import { aggregate, isSuccessCode, normalizeItem, normalizeServiceKey, parseItems, quantile, readHeader, recentMonths } from './rent-lib.mjs';

const NEW_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header>
<body><items>
<item><buildYear>2015</buildYear><contractTerm>25.09~27.09</contractTerm><contractType>신규</contractType><dealDay>3</dealDay><dealMonth>9</dealMonth><dealYear>2025</dealYear><deposit>500</deposit><houseType>다가구</houseType><monthlyRent>45</monthlyRent><sggCd>41131</sggCd><totalFloorAr>23.1</totalFloorAr><umdNm>복정동</umdNm></item>
<item><dealMonth>9</dealMonth><dealYear>2025</dealYear><deposit>1,000</deposit><monthlyRent>0</monthlyRent><umdNm>복정동</umdNm></item>
<item><dealMonth>9</dealMonth><dealYear>2025</dealYear><deposit>300</deposit><monthlyRent>40</monthlyRent><umdNm>태평동</umdNm><offiNm>A&amp;B 오피스텔</offiNm></item>
</items><numOfRows>1000</numOfRows><pageNo>1</pageNo><totalCount>3</totalCount></body></response>`;

const OLD_XML = `<response><header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header><body><items>
<item><법정동> 신흥동</법정동><보증금액>   1,000</보증금액><월세금액>    50</월세금액><년>2024</년><월>11</월><계약면적>20</계약면적></item>
</items><totalCount>1</totalCount></body></response>`;

const AUTH_ERROR = `<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>`;

describe('rent-lib', () => {
  it('새 형식 응답을 읽는다', () => {
    const head = readHeader(NEW_XML);
    expect(head.resultCode).toBe('000');
    expect(isSuccessCode(head.resultCode)).toBe(true);
    expect(head.totalCount).toBe(3);
    const items = parseItems(NEW_XML).map(normalizeItem);
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({ dong: '복정동', deposit: 500, rent: 45, area: 23.1, ym: '2025-09' });
    expect(items[1].deposit).toBe(1000);
  });

  it('예전 한글 필드 형식도 읽는다', () => {
    expect(isSuccessCode(readHeader(OLD_XML).resultCode)).toBe(true);
    const [item] = parseItems(OLD_XML).map(normalizeItem);
    expect(item).toEqual({ dong: '신흥동', deposit: 1000, rent: 50, area: 20, ym: '2024-11' });
  });

  it('인증 오류를 알아챈다', () => {
    expect(readHeader(AUTH_ERROR).authError).toBe('SERVICE_KEY_IS_NOT_REGISTERED_ERROR');
  });

  it('월세 계약만 모아 동별 분위수를 낸다', () => {
    const recs = [40, 45, 50, 55, 60, 0].map((rent, i) => ({ dong: '복정동', type: 'dagagu', deposit: 500 + i * 100, rent }));
    recs.push({ dong: '태평동', type: 'dagagu', deposit: 300, rent: 40 });
    const stats = aggregate(recs, 5);
    expect(stats).toHaveLength(1);
    expect(stats[0].count).toBe(5);
    expect(stats[0].rent.p50).toBe(50);
    expect(stats[0].rentDeciles).toHaveLength(9);
    expect(stats[0].deposit.p50).toBe(700);
  });

  it('분위수를 직선 보간한다', () => {
    expect(quantile([10, 20, 30, 40], 0.5)).toBe(25);
    expect(quantile([10], 0.9)).toBe(10);
  });

  it('이번 달을 빼고 최근 몇 달을 고른다', () => {
    expect(recentMonths(3, new Date(2026, 0, 15))).toEqual(['202510', '202511', '202512']);
  });

  it('인코딩된 키를 원래 값으로 되돌린다', () => {
    expect(normalizeServiceKey('abc%2Bdef%3D%3D')).toBe('abc+def==');
    expect(normalizeServiceKey(' abc+def== ')).toBe('abc+def==');
  });
});
