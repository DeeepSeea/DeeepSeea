import { useState } from 'react';
import { Camera, MapPinned, Wallet } from 'lucide-react';
import { useStore } from '../store';
import { navigate } from '../router';
import { Body, BottomCTA, Screen, TopBar } from '../ui/layout';
import { Button } from '../ui/controls';
import { CriteriaEditor } from '../components/CriteriaEditor';
import { CommuteEditor } from '../components/CommuteEditor';

const FEATURES = [
  {
    icon: MapPinned,
    title: '거리를 자동으로 재요',
    desc: '주소만 넣으면 학교, 정류장, 역, 마트, 편의점, 공원까지 걸어서 몇 분인지 계산해요.',
  },
  {
    icon: Wallet,
    title: '실제로 나가는 돈으로 비교해요',
    desc: '월세에 관리비와 통학 교통비를 더한 월 총 주거비를 보여 드려요.',
  },
  {
    icon: Camera,
    title: '집 보러 가서 바로 기록해요',
    desc: '채광, 환기, 수압, 곰팡이, 소음을 사진과 함께 남겨요.',
  },
];

export default function Onboarding() {
  const { settings, updateSettings, kakaoKey } = useStore();
  const [step, setStep] = useState(0);

  const finish = () => {
    updateSettings({ onboarded: true });
    navigate('/', { replace: true });
  };

  const goStep = (n: number) => {
    setStep(n);
    window.scrollTo(0, 0);
  };

  if (step === 0) {
    return (
      <Screen>
        <TopBar backButton={false} title="" />
        <Body cta>
          <div className="section stack gap-2">
            <h1 className="t-h1">
              자취방 후보를
              <br />한 표에서 비교해요
            </h1>
            <p className="t-body1 c-secondary">계약하고 후회하지 않도록, 후보마다 같은 기준으로 따져 봐요.</p>
          </div>
          <div className="pad-x">
            {FEATURES.map((f) => (
              <div className="feature" key={f.title}>
                <span className="feature__icon">
                  <f.icon size={22} aria-hidden="true" />
                </span>
                <div className="stack gap-2" style={{ gap: 2 }}>
                  <p className="t-title2">{f.title}</p>
                  <p className="t-body2 c-secondary">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Body>
        <BottomCTA>
          <Button size="xl" block onClick={() => goStep(1)}>
            시작하기
          </Button>
        </BottomCTA>
      </Screen>
    );
  }

  if (step === 1) {
    return (
      <Screen>
        <TopBar title="" onBack={() => goStep(0)} right={<span className="step-indicator" style={{ paddingRight: 16 }}>1/2</span>} />
        <Body cta>
          <div className="section stack gap-2" style={{ paddingBottom: 8 }}>
            <h1 className="t-h2">무엇이 중요한가요?</h1>
            <p className="t-body2 c-secondary">중요도에 따라 후보 순위가 달라져요. 나중에 설정에서 바꿀 수 있어요.</p>
          </div>
          <CriteriaEditor weights={settings.weights} onChange={(weights) => updateSettings({ weights })} />
        </Body>
        <BottomCTA>
          <Button size="xl" block onClick={() => goStep(2)}>
            다음
          </Button>
        </BottomCTA>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title="" onBack={() => goStep(1)} right={<span className="step-indicator" style={{ paddingRight: 16 }}>2/2</span>} />
      <Body cta>
        <div className="section stack gap-2">
          <h1 className="t-h2">통학 정보를 알려 주세요</h1>
          <p className="t-body2 c-secondary">학교까지 거리와 교통비를 계산할 때 써요.</p>
        </div>
        <CommuteEditor settings={settings} kakaoKey={kakaoKey} onChange={updateSettings} />
      </Body>
      <BottomCTA>
        <Button size="xl" block onClick={finish}>
          완료
        </Button>
      </BottomCTA>
    </Screen>
  );
}
