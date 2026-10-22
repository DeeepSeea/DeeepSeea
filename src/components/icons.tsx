import { Bus, GraduationCap, ShoppingCart, Store, TrainFront, Trees, Wallet, House } from 'lucide-react';
import type { CriterionKey } from '../types';

const ICONS: Record<CriterionKey, typeof Bus> = {
  school: GraduationCap,
  bus: Bus,
  subway: TrainFront,
  mart: ShoppingCart,
  convenience: Store,
  park: Trees,
  cost: Wallet,
  condition: House,
};

export function CriterionIcon({ k, size = 20 }: { k: CriterionKey; size?: number }) {
  const Icon = ICONS[k];
  return <Icon size={size} aria-hidden="true" />;
}
