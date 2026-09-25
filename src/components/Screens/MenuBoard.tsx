import { useState } from 'react';
import { Sprite, SpriteBox } from '../Sprite';
import { ImgButton } from '../ImgButton';
import { useAssets } from '../../game/AssetContext';
import { ING, ING_NAME, UI } from '../../game/atlas';
import { MENU_ORDER, MenuId, RECIPES, unlockedMenus } from '../../game/recipes';
import type { SaveData } from '../../game/save';

export function MenuBoard({ save, onOpen, onShop }: { save: SaveData; onOpen: (menu: MenuId) => void; onShop: () => void }) {
  const { atlas, bg } = useAssets();
  const unlocked = unlockedMenus(save.day);
  const [sel, setSel] = useState<MenuId>(unlocked[unlocked.length - 1]);
  const r = RECIPES[sel];
  const stepKinds = Array.from(new Set(r.steps.map((s) => s.kind)));
  const kindName: Record<string, string> = { heat: '가열', add: '재료 투입', stir: '젓기', shake: '웍 흔들기', pour: '붓기', fire: '불 조절', noodle: '면 삶기', transfer: '옮겨 담기', plate: '고명 배치', mix: '비비기', chop: '칼질', shape: '모양 내기', fry: '튀기기', toss: '버무리기', serve: '서빙' };

  return (
    <div className="absolute inset-0" style={{ backgroundImage: `url(${bg.kitchen})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0" style={{ background: 'rgba(15,6,3,0.72)' }} />
      <div className="absolute w-full text-center" style={{ top: 10 }}>
        <div className="font-black stroke" style={{ fontSize: 26, color: '#ffe56a' }}>Day {save.day} 오늘의 메뉴판</div>
        <div className="font-bold text-white stroke-thin" style={{ fontSize: 11 }}>{save.day <= 4 ? '새 메뉴가 해금되었습니다!' : '모든 메뉴가 섞여 주문됩니다'}</div>
      </div>
      {/* 메뉴판 */}
      <div className="absolute" style={{ left: 10, top: 58, width: 340, height: 230 }}>
        <SpriteBox src={atlas.ui} frame={UI.panel} width={340} height={230} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        <div className="absolute grid grid-cols-2" style={{ left: 22, top: 15, width: 296, height: 200, gap: 4 }}>
          {MENU_ORDER.map((id) => {
            const m = RECIPES[id];
            const locked = !unlocked.includes(id);
            const active = sel === id;
            return (
              <div key={id} className="relative flex flex-col items-center justify-center" style={{ minWidth: 0, height: '100%', cursor: locked ? 'default' : 'pointer' }} onClick={() => !locked && setSel(id)}>
                <Sprite src={atlas.food} frame={m.foodFrame} size={62} style={{ flexShrink: 0, filter: locked ? 'grayscale(1) brightness(0.5)' : active ? 'drop-shadow(0 0 10px #ffe56a)' : 'drop-shadow(0 3px 3px rgba(0,0,0,0.4))' }} />
                <div className="font-black text-center flex items-center justify-center" style={{ width: '100%', height: 24, padding: '0 3px', fontSize: 11.5, color: locked ? '#888' : active ? '#b3261e' : '#3b1d0e', lineHeight: '12px', wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{m.name}</div>
                <div className="font-bold" style={{ fontSize: 10, lineHeight: '11px', color: locked ? '#777' : '#6b3b1c' }}>{locked ? `Day ${MENU_ORDER.indexOf(id) + 1} 해금` : `${m.price.toLocaleString()}원`}</div>
                {locked && <Sprite src={atlas.ui} frame={UI.lock} size={36} className="absolute pointer-events-none" style={{ top: 14, left: '50%', transform: 'translateX(-50%)' }} />}
              </div>
            );
          })}
        </div>
      </div>
      {/* 선택 메뉴 상세 */}
      <div className="absolute" style={{ left: 10, top: 294, width: 340, height: 254 }}>
        <SpriteBox src={atlas.ui} frame={UI.panel} width={340} height={254} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        <div key={sel} className="absolute" style={{ left: 25, top: 17, width: 290, height: 218, overflowY: 'auto', overflowX: 'hidden', touchAction: 'pan-y', overscrollBehavior: 'contain', scrollbarWidth: 'thin', scrollbarColor: '#aa6b35 transparent', padding: '0 2px 4px' }}>
          <div className="flex items-start" style={{ gap: 8 }}>
            <Sprite src={atlas.food} frame={r.foodFrame} size={70} style={{ flexShrink: 0, filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))' }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="font-black" style={{ fontSize: 14, lineHeight: '17px', color: '#b3261e', wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{r.name}</div>
              <div className="font-bold" style={{ fontSize: 9.5, lineHeight: '13px', color: '#8a481c' }}>난이도 {'★'.repeat(r.difficulty)}{'☆'.repeat(4 - r.difficulty)}</div>
              <div className="font-bold" style={{ fontSize: 10, lineHeight: '13px', color: '#4a2a12', wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{r.desc}</div>
            </div>
          </div>
          <div className="font-black" style={{ fontSize: 11, color: '#3b1d0e', marginTop: 6, lineHeight: '15px' }}>필요 재료</div>
          <div className="grid grid-cols-5" style={{ width: '100%', rowGap: 3, marginTop: 2 }}>
            {r.ingredients.map((i) => (
              <div key={i} className="flex flex-col items-center" style={{ minWidth: 0, minHeight: 43 }}>
                <Sprite src={atlas.ingredients} frame={ING[i]} size={28} style={{ flexShrink: 0 }} />
                <div className="font-bold text-center" style={{ width: '100%', fontSize: 8.5, lineHeight: '10px', color: '#4a2a12', wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{ING_NAME[i]}</div>
              </div>
            ))}
          </div>
          <div className="font-black" style={{ fontSize: 11, color: '#3b1d0e', marginTop: 6, lineHeight: '15px' }}>조리법 ({r.steps.length}단계)</div>
          <div className="font-bold" style={{ fontSize: 10, color: '#4a2a12', lineHeight: '14px', wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{stepKinds.map((k) => kindName[k]).join(' → ')}</div>
        </div>
      </div>
      <div className="absolute w-full flex items-center justify-center gap-3" style={{ bottom: 18 }}>
        <ImgButton label="업그레이드" onClick={onShop} kind="wood" width={120} height={56} fontSize={15} />
        <ImgButton label="영업 시작!" onClick={() => onOpen(sel)} kind="red" width={180} height={64} fontSize={22} className="anim-pulse" />
      </div>
    </div>
  );
}
