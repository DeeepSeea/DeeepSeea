import { useState, type ChangeEvent } from 'react';
import { useStore } from '../store';
import { navigate } from '../router';
import { HOUSE_TYPE_LABEL, type Candidate, type HouseType } from '../types';
import { computeInfra } from '../lib/kakao';
import { manwonToWon, wonToManwonInput } from '../lib/format';
import { newId } from '../lib/storage';
import { Body, BottomCTA, Note, Screen, TopBar } from '../ui/layout';
import { Button, Segmented, TextField } from '../ui/controls';
import { useToast } from '../ui/overlay';
import { LocationSearch, type PickedLocation } from '../components/LocationSearch';

const HOUSE_OPTIONS = (Object.keys(HOUSE_TYPE_LABEL) as HouseType[]).map((v) => ({ value: v, label: HOUSE_TYPE_LABEL[v] }));

/** 후보 추가(editId 없음)와 수정(editId 있음)을 함께 맡는다 */
export default function CandidateForm({ editId }: { editId?: string }) {
  const { candidates, settings, kakaoKey, addCandidate, updateCandidate } = useStore();
  const toast = useToast();
  const editing = editId ? candidates.find((c) => c.id === editId) : undefined;

  const [name, setName] = useState(editing?.name ?? '');
  const [address, setAddress] = useState(editing?.address ?? '');
  const [picked, setPicked] = useState<PickedLocation | null>(
    editing?.location ? { address: editing.address, location: editing.location, dong: editing.dong } : null,
  );
  const [houseType, setHouseType] = useState<HouseType>(editing?.houseType ?? 'dagagu');
  const [deposit, setDeposit] = useState(wonToManwonInput(editing?.deposit ?? 0));
  const [rent, setRent] = useState(wonToManwonInput(editing?.monthlyRent ?? 0));
  const [fee, setFee] = useState(wonToManwonInput(editing?.maintenanceFee ?? 0));
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  if (editId && !editing) {
    return (
      <Screen>
        <TopBar title="후보 수정" />
        <Body>
          <Note>이 후보를 찾지 못했어요. 이미 지웠을 수 있어요.</Note>
        </Body>
      </Screen>
    );
  }

  const rentWon = manwonToWon(rent);
  const rentError = touched && rentWon === 0 ? '월세를 넣어 주세요' : undefined;
  const moneyInput = (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => setter(e.target.value.replace(/[^0-9.]/g, ''));

  const submit = async () => {
    setTouched(true);
    if (rentWon === 0) return;

    const base = {
      name: name.trim() || `후보 ${candidates.length + (editing ? 0 : 1)}`,
      // 위치를 '바꾸기'만 누르고 새로 고르지 않았으면 원래 위치를 그대로 둔다
      address: picked?.address ?? address.trim(),
      location: picked?.location ?? editing?.location,
      dong: picked?.dong ?? editing?.dong,
      houseType,
      deposit: manwonToWon(deposit),
      monthlyRent: rentWon,
      maintenanceFee: manwonToWon(fee),
    };
    const moved =
      !!picked && (!editing?.location || editing.location.lat !== picked.location.lat || editing.location.lng !== picked.location.lng);

    let infra = editing?.infra ?? {};
    let infraFailed = false;
    if (kakaoKey && picked && moved) {
      setBusy(true);
      try {
        // 지도에서 못 찾은 항목은 직접 입력해 둔 값을 남긴다
        infra = { ...infra, ...(await computeInfra(kakaoKey, picked.location, { name: settings.schoolName, location: settings.school })) };
      } catch {
        infraFailed = true;
      } finally {
        setBusy(false);
      }
    }

    if (editing) {
      updateCandidate(editing.id, { ...base, infra });
      toast(infraFailed ? '저장했어요. 거리는 상세 화면에서 다시 계산할 수 있어요.' : '후보를 고쳤어요', infraFailed ? 'info' : 'success');
      navigate(`/c/${editing.id}`, { replace: true });
      return;
    }

    const now = Date.now();
    const c: Candidate = {
      id: newId(),
      ...base,
      commuteMode: 'auto',
      infra,
      field: { photoIds: [] },
      createdAt: now,
      updatedAt: now,
    };
    addCandidate(c);
    toast(infraFailed ? '추가했어요. 거리는 상세 화면에서 다시 계산할 수 있어요.' : '후보를 추가했어요', infraFailed ? 'info' : 'success');
    navigate(`/c/${c.id}`, { replace: true });
  };

  return (
    <Screen>
      <TopBar title={editing ? '후보 수정' : '후보 추가'} />
      <Body cta>
        {/* 위치 검색이 자체 form을 쓰므로 여기서는 form으로 감싸지 않는다 */}
        <div className="section stack gap-6">
          <TextField label="이름" placeholder="예: 정문 앞 원룸" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />

          {kakaoKey ? (
            <LocationSearch kakaoKey={kakaoKey} value={picked} onChange={setPicked} near={settings.school} />
          ) : (
            <TextField
              label="주소"
              placeholder="메모용 주소(선택)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              help="지도 연결 전이라 거리는 상세 화면에서 직접 넣어요."
            />
          )}

          <div className="stack gap-2">
            <span className="field__label">방 유형</span>
            <Segmented label="방 유형" options={HOUSE_OPTIONS} value={houseType} onChange={setHouseType} />
          </div>

          <TextField label="보증금" inputMode="decimal" suffix="만원" placeholder="0" value={deposit} onChange={moneyInput(setDeposit)} />
          <TextField
            label="월세"
            inputMode="decimal"
            suffix="만원"
            placeholder="0"
            value={rent}
            onChange={moneyInput(setRent)}
            error={rentError}
          />
          <TextField
            label="관리비"
            inputMode="decimal"
            suffix="만원"
            placeholder="0"
            value={fee}
            onChange={moneyInput(setFee)}
            help="관리비에 포함된 항목(인터넷, 수도 등)은 메모에 적어 두면 좋아요."
          />
        </div>
      </Body>
      <BottomCTA>
        <Button size="xl" block loading={busy} onClick={() => submit()}>
          {editing ? '저장하기' : '추가하기'}
        </Button>
      </BottomCTA>
    </Screen>
  );
}
