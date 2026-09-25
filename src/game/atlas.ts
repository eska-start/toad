// 모든 아틀라스는 4x4 그리드. 프레임 인덱스 = row*4 + col
export const GRID = 4;

export const TOAD = {
  idle1: 0, idle2: 1, chop1: 2, chop2: 3,
  wok1: 4, wok2: 5, flip: 6, fire: 7,
  noodle: 8, carry: 9, serve: 10, walk: 11,
  happy: 12, angry: 13, panic: 14, fail: 15,
} as const;
export type ToadPose = keyof typeof TOAD;

// 손님: row = 캐릭터(0~3), col = 0 대기 / 1 기대 / 2 먹기 / 3 화남
export const CUSTOMER_COL = { wait: 0, expect: 1, eat: 2, angry: 3 } as const;
export const CUSTOMER_NAMES = ['김 할아버지', '박 대리', '민준이', '어부 최씨'];

export const FOOD = {
  jjamppong: 0, jjajang: 1, gegukji: 2, tangsuyuk: 3,
  emptyBowl: 4, noodleBowl: 5, emptyPlate: 6, friedPlate: 7,
  wokRaw: 8, wokFried: 9, wokSoup: 10, wokBurnt: 11,
  wokJjajang: 12, rawNoodle: 13, doughBowl: 14, saucePot: 15,
  friedChunks: 16, tangsuyukChunks: 17,
} as const;
export type FoodFrame = keyof typeof FOOD;

export const ING = {
  garlic: 0, scallion: 1, pork: 2, seafood: 3,
  onion: 4, cabbage: 5, chili: 6, broth: 7,
  noodle: 8, chunjang: 9, crab: 10, kimchi: 11,
  sweetpotato: 12, batter: 13, sauce: 14, oil: 15,
} as const;
export type IngredientId = keyof typeof ING;

export const ING_NAME: Record<IngredientId, string> = {
  garlic: '마늘', scallion: '대파', pork: '돼지고기', seafood: '해물',
  onion: '양파', cabbage: '양배추', chili: '고춧가루', broth: '육수',
  noodle: '면', chunjang: '춘장', crab: '꽃게', kimchi: '김치',
  sweetpotato: '고구마', batter: '반죽가루', sauce: '탕수소스 재료', oil: '기름',
};

export const EQUIP = {
  wokOld: 0, wokNew: 1, potOld: 2, potNew: 3,
  knifeOld: 4, knifeNew: 5, stoveOld: 6, stoveNew: 7,
  tableOld: 8, tableNew: 9, board: 10, fryer: 11,
  strainer: 12, signOld: 13, signNew: 14, lantern: 15,
} as const;

export const UI = {
  btnWood: 0, btnRed: 1, coin: 2, clock: 3,
  ticket: 4, panel: 5, star: 6, heart: 7,
  knob: 8, check: 9, x: 10, lock: 11,
  trash: 12, bubble: 13, ladle: 14, btnRound: 15,
} as const;

export const FX = {
  fire1: 0, fire2: 1, fire3: 2, fire4: 3,
  steam1: 4, steam2: 5, steam3: 6, steam4: 7,
  smoke1: 8, smoke2: 9, smoke3: 10, smoke4: 11,
  sparkle: 12, splash: 13, heartBurst: 14, angryBurst: 15,
} as const;

export const FIRE_FRAMES = [FX.fire1, FX.fire2, FX.fire3, FX.fire4, FX.fire3, FX.fire2];
export const STEAM_FRAMES = [FX.steam1, FX.steam2, FX.steam3, FX.steam4];
export const SMOKE_FRAMES = [FX.smoke1, FX.smoke2, FX.smoke3, FX.smoke4];
