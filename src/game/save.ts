import { EQUIP } from './atlas';

export type UpgradeId = 'wok' | 'pot' | 'knife' | 'stove' | 'table' | 'sign' | 'light' | 'decor';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  from: string;
  to: string;
  cost: number;
  effect: string;
  oldFrame: number;
  newFrame: number;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'wok', name: '웍', from: '낡은 웍', to: '좋은 웍', cost: 25000, effect: '웍 흔들기 판정 완화, 재료 손실 감소', oldFrame: EQUIP.wokOld, newFrame: EQUIP.wokNew },
  { id: 'pot', name: '냄비', from: '작은 냄비', to: '큰 냄비', cost: 20000, effect: '면 삶기 적정 구간 확대', oldFrame: EQUIP.potOld, newFrame: EQUIP.potNew },
  { id: 'knife', name: '칼', from: '낡은 칼', to: '좋은 칼', cost: 15000, effect: '칼질 횟수 감소', oldFrame: EQUIP.knifeOld, newFrame: EQUIP.knifeNew },
  { id: 'stove', name: '가스레인지', from: '낡은 가스레인지', to: '고급 가스레인지', cost: 30000, effect: '불 조절 구간 확대, 가열 속도 증가', oldFrame: EQUIP.stoveOld, newFrame: EQUIP.stoveNew },
  { id: 'table', name: '테이블', from: '낡은 테이블', to: '새 테이블', cost: 22000, effect: '손님 인내심 +25%', oldFrame: EQUIP.tableOld, newFrame: EQUIP.tableNew },
  { id: 'sign', name: '간판', from: '낡은 간판', to: '화려한 간판', cost: 35000, effect: '하루 손님 +1, 팁 증가', oldFrame: EQUIP.signOld, newFrame: EQUIP.signNew },
  { id: 'light', name: '조명', from: '어두운 조명', to: '따뜻한 조명', cost: 18000, effect: '손님 인내심 +10%, 분위기 향상', oldFrame: EQUIP.lantern, newFrame: EQUIP.lantern },
  { id: 'decor', name: '주방 장식', from: '휑한 주방', to: '홍등 장식', cost: 12000, effect: '팁 +10%', oldFrame: EQUIP.lantern, newFrame: EQUIP.lantern },
];

export interface SaveData {
  day: number;
  money: number;
  upgrades: Record<UpgradeId, boolean>;
  totalServed: number;
  bestDay: number;
}

const KEY = 'toad-jjamppong-save-v1';

export function defaultSave(): SaveData {
  return {
    day: 1,
    money: 5000,
    upgrades: { wok: false, pot: false, knife: false, stove: false, table: false, sign: false, light: false, decor: false },
    totalServed: 0,
    bestDay: 0,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    return { ...defaultSave(), ...parsed, upgrades: { ...defaultSave().upgrades, ...(parsed.upgrades ?? {}) } };
  } catch {
    return defaultSave();
  }
}

export function writeSave(s: SaveData) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export interface DayStats {
  revenue: number;
  served: number;
  qualities: number[];
  satisfaction: number[]; // 0~1
  mistakes: number;
  wasted: number;
  bestMenu: string;
  menuCount: Record<string, number>;
}

export function emptyStats(): DayStats {
  return { revenue: 0, served: 0, qualities: [], satisfaction: [], mistakes: 0, wasted: 0, bestMenu: '-', menuCount: {} };
}
