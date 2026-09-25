import { FOOD, IngredientId } from './atlas';

export type MenuId = 'jjamppong' | 'jjajang' | 'gegukji' | 'tangsuyuk';

export type Step =
  | { kind: 'heat'; label: string; target: [number, number] }            // Hold: 불 세기 올리기
  | { kind: 'add'; label: string; items: IngredientId[]; vessel: Vessel }  // Drag: 재료 투입
  | { kind: 'stir'; label: string; needSec: number; burn: boolean; vessel: Vessel } // Swipe: 젓기/반죽
  | { kind: 'shake'; label: string; count: number }                        // Swipe: 웍 흔들기 (플립)
  | { kind: 'pour'; label: string; item: 'broth' | 'sauce' | 'jjajang'; target: [number, number]; vessel: Vessel } // Hold: 붓기
  | { kind: 'fire'; label: string; target: [number, number]; duration: number } // Hold: 불 유지
  | { kind: 'noodle'; label: string; perfect: [number, number] }          // Drag: 면 건지기
  | { kind: 'transfer'; label: string; from: 'wok' | 'fryer' | 'saucebowl'; to: 'bowl' | 'plate' | 'saucebowl' } // Drag: 옮겨 담기
  | { kind: 'plate'; label: string; toppings: IngredientId[]; plateFrame: number } // Drag: 고명 배치
  | { kind: 'mix'; label: string; count: number }                          // Swipe: 비비기
  | { kind: 'chop'; label: string; item: IngredientId; count: number }     // Swipe: 칼질
  | { kind: 'shape'; label: string; count: number; pieces?: IngredientId[] } // Drag: 재료별 조각을 튀김망에 배치
  | { kind: 'fry'; label: string; target: [number, number]; needSec: number } // Hold+Drag: 튀김 온도/건지기
  | { kind: 'toss'; label: string; count: number }                         // Swipe: 소스 버무리기
  | { kind: 'serve'; label: string };                                      // Drag: 서빙

export type Vessel = 'wok' | 'pot' | 'bowl' | 'mixbowl' | 'saucepot';

export interface Recipe {
  id: MenuId;
  name: string;
  price: number;
  foodFrame: number;
  desc: string;
  difficulty: number; // 1~4
  ingredients: IngredientId[];
  steps: Step[];
}

export const RECIPES: Record<MenuId, Recipe> = {
  jjamppong: {
    id: 'jjamppong',
    name: '두꺼비 짬뽕',
    price: 9000,
    foodFrame: FOOD.jjamppong,
    desc: '불맛 가득! 40년 전통의 내공이 담긴 얼큰한 해물 짬뽕',
    difficulty: 1,
    ingredients: ['oil', 'garlic', 'scallion', 'pork', 'seafood', 'onion', 'cabbage', 'chili', 'broth', 'noodle'],
    steps: [
      { kind: 'heat', label: '웍을 달군다 (불 조절 노브를 꾹 눌러 유지)', target: [55, 85] },
      { kind: 'add', label: '기름을 웍에 넣는다', items: ['oil'], vessel: 'wok' },
      { kind: 'add', label: '마늘과 대파를 넣어 향을 낸다', items: ['garlic', 'scallion'], vessel: 'wok' },
      { kind: 'add', label: '돼지고기를 넣는다', items: ['pork'], vessel: 'wok' },
      { kind: 'add', label: '해물을 넣는다', items: ['seafood'], vessel: 'wok' },
      { kind: 'add', label: '양파와 양배추를 넣는다', items: ['onion', 'cabbage'], vessel: 'wok' },
      { kind: 'add', label: '고춧가루를 넣는다', items: ['chili'], vessel: 'wok' },
      { kind: 'shake', label: '웍을 좌우로 흔들어 불맛을 입힌다', count: 6 },
      { kind: 'pour', label: '육수를 붓는다 (국자를 꾹 눌러 붓기)', item: 'broth', target: [60, 85], vessel: 'wok' },
      { kind: 'fire', label: '센 불을 유지하며 끓인다', target: [60, 88], duration: 5 },
      { kind: 'noodle', label: '면을 삶고 알맞을 때 건져 그릇에 담는다', perfect: [55, 80] },
      { kind: 'transfer', label: '웍을 끌어 국물을 그릇에 담는다', from: 'wok', to: 'bowl' },
      { kind: 'plate', label: '해물과 대파 고명을 올린다', toppings: ['seafood', 'scallion'], plateFrame: FOOD.jjamppong },
      { kind: 'serve', label: '완성! 손님에게 끌어다 서빙한다' },
    ],
  },
  jjajang: {
    id: 'jjajang',
    name: '두꺼비 짜장',
    price: 8000,
    foodFrame: FOOD.jjajang,
    desc: '춘장을 정성껏 볶아낸 고소하고 진한 두꺼비표 짜장',
    difficulty: 2,
    ingredients: ['oil', 'chunjang', 'pork', 'onion', 'cabbage', 'broth', 'noodle'],
    steps: [
      { kind: 'heat', label: '웍을 달군다 (노브를 꾹 눌러 유지)', target: [50, 78] },
      { kind: 'add', label: '기름을 넉넉히 넣는다', items: ['oil'], vessel: 'wok' },
      { kind: 'add', label: '춘장을 웍에 넣는다', items: ['chunjang'], vessel: 'wok' },
      { kind: 'stir', label: '춘장을 계속 저어 볶는다 (멈추면 탄다!)', needSec: 6, burn: true, vessel: 'wok' },
      { kind: 'add', label: '돼지고기를 넣는다', items: ['pork'], vessel: 'wok' },
      { kind: 'add', label: '양파와 양배추를 넣는다', items: ['onion', 'cabbage'], vessel: 'wok' },
      { kind: 'stir', label: '재료와 소스를 고루 볶는다', needSec: 4, burn: true, vessel: 'wok' },
      { kind: 'pour', label: '소스 농도 확인 - 육수를 소량만 넣는다', item: 'broth', target: [25, 45], vessel: 'wok' },
      { kind: 'noodle', label: '면을 삶아 알맞게 건져 그릇에 담는다', perfect: [55, 80] },
      { kind: 'pour', label: '짜장 소스를 면 위에 붓는다', item: 'jjajang', target: [55, 85], vessel: 'bowl' },
      { kind: 'mix', label: '젓가락으로 면과 소스를 비빈다', count: 10 },
      { kind: 'serve', label: '완성! 손님에게 끌어다 서빙한다' },
    ],
  },
  gegukji: {
    id: 'gegukji',
    name: '게국지짬뽕',
    price: 14000,
    foodFrame: FOOD.gegukji,
    desc: '서산 게국지의 깊은 맛을 짬뽕에 담았다. 꽃게와 묵은지의 시원한 국물',
    difficulty: 3,
    ingredients: ['oil', 'crab', 'kimchi', 'onion', 'cabbage', 'seafood', 'broth', 'noodle'],
    steps: [
      { kind: 'heat', label: '웍을 아주 뜨겁게 달군다', target: [62, 86] },
      { kind: 'add', label: '기름을 넣는다', items: ['oil'], vessel: 'wok' },
      { kind: 'chop', label: '꽃게를 칼로 손질한다 (좌우로 쓸어 칼질)', item: 'crab', count: 6 },
      { kind: 'add', label: '손질한 꽃게를 웍에 넣는다', items: ['crab'], vessel: 'wok' },
      { kind: 'add', label: '묵은 김치를 넣는다', items: ['kimchi'], vessel: 'wok' },
      { kind: 'add', label: '채소와 해물을 넣는다', items: ['onion', 'cabbage', 'seafood'], vessel: 'wok' },
      { kind: 'shake', label: '웍을 흔들어 게 향을 살린다', count: 8 },
      { kind: 'pour', label: '육수를 붓는다', item: 'broth', target: [65, 85], vessel: 'wok' },
      { kind: 'fire', label: '국물이 우러나도록 불을 정확히 유지한다', target: [62, 82], duration: 8 },
      { kind: 'noodle', label: '면을 삶아 건진다', perfect: [52, 76] },
      { kind: 'transfer', label: '웍을 끌어 국물을 그릇에 담는다', from: 'wok', to: 'bowl' },
      { kind: 'plate', label: '꽃게와 김치를 위에 올린다', toppings: ['crab', 'kimchi'], plateFrame: FOOD.gegukji },
      { kind: 'serve', label: '완성! 손님에게 끌어다 서빙한다' },
    ],
  },
  tangsuyuk: {
    id: 'tangsuyuk',
    name: '안면도 고구마탕수육',
    price: 16000,
    foodFrame: FOOD.tangsuyuk,
    desc: '돼지고기 탕수육에 안면도 고구마채를 바삭하게 올린 별미 탕수육',
    difficulty: 4,
    ingredients: ['pork', 'sweetpotato', 'batter', 'sauce'],
    steps: [
      { kind: 'chop', label: '돼지고기를 먹기 좋게 썬다 (좌우로 쓸어 칼질)', item: 'pork', count: 6 },
      { kind: 'chop', label: '고구마를 가늘게 채 썬다 (좌우로 쓸어 칼질)', item: 'sweetpotato', count: 5 },
      { kind: 'add', label: '돼지고기, 고구마채와 반죽가루를 반죽 볼에 넣는다', items: ['pork', 'sweetpotato', 'batter'], vessel: 'mixbowl' },
      { kind: 'stir', label: '반죽을 치댄다 (원을 그리며 저어라)', needSec: 4, burn: false, vessel: 'mixbowl' },
      { kind: 'shape', label: '돼지고기 3개와 고구마채 2개를 튀김망에 올린다', count: 5, pieces: ['pork', 'pork', 'pork', 'sweetpotato', 'sweetpotato'] },
      { kind: 'fry', label: '온도를 유지하며 튀기고, 노릇할 때 건진다', target: [60, 82], needSec: 6 },
      { kind: 'add', label: '탕수소스 재료를 소스팬에 넣는다', items: ['sauce'], vessel: 'saucepot' },
      { kind: 'stir', label: '소스를 저어 걸쭉하게 만든다', needSec: 3, burn: true, vessel: 'saucepot' },
      { kind: 'transfer', label: '튀김을 끌어 소스에 넣는다', from: 'fryer', to: 'saucebowl' },
      { kind: 'toss', label: '좌우로 흔들어 소스를 버무린다', count: 8 },
      { kind: 'transfer', label: '버무린 탕수육을 접시로 옮긴다', from: 'saucebowl', to: 'plate' },
      { kind: 'plate', label: '고구마채를 탕수육 위에 고명으로 올린다', toppings: ['sweetpotato'], plateFrame: FOOD.tangsuyuk },
      { kind: 'serve', label: '완성! 손님에게 끌어다 서빙한다' },
    ],
  },
};

export const MENU_ORDER: MenuId[] = ['jjamppong', 'jjajang', 'gegukji', 'tangsuyuk'];

export function unlockedMenus(day: number): MenuId[] {
  return MENU_ORDER.slice(0, Math.min(4, day));
}

/** 하루에 등장할 손님 주문 목록 생성 */
export function buildDayOrders(day: number, extra: number): MenuId[] {
  const menus = unlockedMenus(day);
  const count = Math.min(4 + Math.floor((day - 1) * 0.8), 8) + extra;
  const out: MenuId[] = [];
  for (let i = 0; i < count; i++) {
    if (day <= 4) {
      // 신메뉴 날: 신메뉴 비중 높게
      const newest = menus[menus.length - 1];
      out.push(Math.random() < 0.55 ? newest : menus[Math.floor(Math.random() * menus.length)]);
    } else {
      out.push(menus[Math.floor(Math.random() * menus.length)]);
    }
  }
  return out;
}

export function maxConcurrent(day: number): number {
  if (day <= 1) return 1;
  if (day <= 4) return 2;
  return 3;
}

export type Grade = '실패' | '보통' | '맛있음' | '훌륭함' | '완벽한 한 그릇';

export function gradeOf(q: number): Grade {
  if (q < 0.35) return '실패';
  if (q < 0.55) return '보통';
  if (q < 0.72) return '맛있음';
  if (q < 0.88) return '훌륭함';
  return '완벽한 한 그릇';
}

export const GRADE_MULT: Record<Grade, number> = {
  '실패': 0.2, '보통': 0.7, '맛있음': 1.0, '훌륭함': 1.25, '완벽한 한 그릇': 1.6,
};
