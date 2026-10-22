import { CRITERIA, CRITERION_LABEL, type Importance, type Weights } from '../types';
import { INFRA_THRESHOLDS } from '../lib/score';
import { Segmented } from '../ui/controls';
import { CriterionIcon } from './icons';

const LEVELS: { value: Importance; label: string }[] = [
  { value: 0, label: '상관없음' },
  { value: 1, label: '조금' },
  { value: 2, label: '중요' },
  { value: 3, label: '아주 중요' },
];

export function criterionHint(k: (typeof CRITERIA)[number]): string {
  if (k === 'cost') return '월세, 관리비, 통학 교통비를 더한 금액이에요';
  if (k === 'condition') return '채광, 환기, 수압, 곰팡이, 소음 현장 기록이에요';
  const t = INFRA_THRESHOLDS[k];
  return `걸어서 ${t.good}분 안이면 만점, ${t.bad}분이 넘으면 0점이에요`;
}

export function CriteriaEditor({ weights, onChange }: { weights: Weights; onChange: (w: Weights) => void }) {
  return (
    <div>
      {CRITERIA.map((k) => (
        <div className="crit" key={k}>
          <div className="crit__head">
            <span className="ico" style={{ width: 32, height: 32 }}>
              <CriterionIcon k={k} size={18} />
            </span>
            <div className="stack">
              <span className="crit__label">{CRITERION_LABEL[k]}</span>
              <span className="crit__hint">{criterionHint(k)}</span>
            </div>
          </div>
          <Segmented
            label={`${CRITERION_LABEL[k]} 중요도`}
            size="sm"
            options={LEVELS}
            value={weights[k]}
            onChange={(v) => onChange({ ...weights, [k]: v })}
          />
        </div>
      ))}
    </div>
  );
}
