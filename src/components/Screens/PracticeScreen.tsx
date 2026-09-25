import { useState } from 'react';
import { Sprite, SpriteBox } from '../Sprite';
import { ImgButton } from '../ImgButton';
import { useAssets } from '../../game/AssetContext';
import { ING, ING_NAME, UI } from '../../game/atlas';
import { MENU_ORDER, MenuId, RECIPES } from '../../game/recipes';
import { defaultSave, type SaveData } from '../../game/save';
import { GameScreen } from '../Game/GameScreen';

export function PracticeScreen({ onBack }: { onBack: () => void }) {
  const { atlas, bg } = useAssets();
  const [sel, setSel] = useState<MenuId>('jjamppong');
  const [playing, setPlaying] = useState(false);
  const [gameKey, setGameKey] = useState(0);

  if (playing) {
    // 연습 모드: 손님 없이 자유 조리. 가짜 save로 Day 50 사용 → 모든 메뉴 해금
    const practiceSave: SaveData = { ...defaultSave(), day: 50 };
    return (
      <GameScreen
        key={gameKey}
        save={practiceSave}
        onMoney={() => {}}
        onDayEnd={() => {
          setPlaying(false);
        }}
        preferredMenu={sel}
        practice
        onPracticeBack={() => setPlaying(false)}
      />
    );
  }

  const r = RECIPES[sel];
  const stepKinds = Array.from(new Set(r.steps.map((s) => s.kind)));
  const kindName: Record<string, string> = { heat: '가열', add: '재료 투입', stir: '젓기', shake: '웍 흔들기', pour: '붓기', fire: '불 조절', noodle: '면 삶기', transfer: '옮겨 담기', plate: '고명 배치', mix: '비비기', chop: '칼질', shape: '모양 내기', fry: '튀기기', toss: '버무리기', serve: '서빙' };

  return (
    <div className="absolute inset-0" style={{ backgroundImage: `url(${bg.kitchen})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0" style={{ background: 'rgba(15,6,3,0.72)' }} />
      <div className="absolute w-full text-center flex flex-col items-center pointer-events-none" style={{ top: 8, zIndex: 10 }}>
        <div className="font-black stroke" style={{ fontSize: 22, color: '#ffe56a', lineHeight: '26px' }}>연습 모드</div>
        <div className="font-bold text-white stroke-thin" style={{ fontSize: 11, lineHeight: '14px', marginTop: 2 }}>메뉴를 골라 자유롭게 조리해보세요</div>
      </div>
      {/* 메뉴 선택 */}
      <div className="absolute" style={{ left: 10, top: 48, width: 340, height: 160 }}>
        <SpriteBox src={atlas.ui} frame={UI.panel} width={340} height={160} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        <div className="absolute grid grid-cols-4" style={{ left: 44, top: 32, width: 252, height: 96, gap: 4 }}>
          {MENU_ORDER.map((id) => {
            const m = RECIPES[id];
            const active = sel === id;
            return (
              <div key={id} className="relative flex flex-col items-center justify-center" style={{ cursor: 'pointer' }} onClick={() => setSel(id)}>
                <Sprite src={atlas.food} frame={m.foodFrame} size={active ? 46 : 40} style={{ flexShrink: 0, filter: active ? 'drop-shadow(0 0 6px #ffe56a)' : 'drop-shadow(0 2px 2px rgba(0,0,0,0.4))' }} />
                <div className="font-black text-center" style={{ fontSize: 10, color: active ? '#b3261e' : '#3b1d0e', lineHeight: '12px', wordBreak: 'keep-all' }}>{m.name}</div>
              </div>
            );
          })}
        </div>
      </div>
      {/* 선택 메뉴 상세 */}
      <div className="absolute" style={{ left: 10, top: 220, width: 340, height: 280 }}>
        <SpriteBox src={atlas.ui} frame={UI.panel} width={340} height={280} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        <div key={sel} className="absolute" style={{ left: 44, top: 40, width: 252, height: 200, overflowY: 'auto', overflowX: 'hidden', touchAction: 'pan-y', overscrollBehavior: 'contain', padding: '0 2px 4px' }}>
          <div className="flex items-start" style={{ gap: 8 }}>
            <Sprite src={atlas.food} frame={r.foodFrame} size={48} style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="font-black" style={{ fontSize: 13, lineHeight: '16px', color: '#b3261e' }}>{r.name}</div>
              <div className="font-bold" style={{ fontSize: 9, lineHeight: '12px', color: '#8a481c' }}>난이도 {'★'.repeat(r.difficulty)}{'☆'.repeat(4 - r.difficulty)}</div>
              <div className="font-bold" style={{ fontSize: 9, lineHeight: '12px', color: '#4a2a12', wordBreak: 'keep-all' }}>{r.desc}</div>
            </div>
          </div>
          <div className="font-black" style={{ fontSize: 10.5, color: '#3b1d0e', marginTop: 4, lineHeight: '14px' }}>필요 재료</div>
          <div className="grid grid-cols-5" style={{ width: '100%', rowGap: 2, marginTop: 2 }}>
            {r.ingredients.map((i) => (
              <div key={i} className="flex flex-col items-center" style={{ minWidth: 0, minHeight: 36 }}>
                <Sprite src={atlas.ingredients} frame={ING[i]} size={22} />
                <div className="font-bold text-center" style={{ width: '100%', fontSize: 8, lineHeight: '10px', color: '#4a2a12', wordBreak: 'keep-all' }}>{ING_NAME[i]}</div>
              </div>
            ))}
          </div>
          <div className="font-black" style={{ fontSize: 10.5, color: '#3b1d0e', marginTop: 4, lineHeight: '14px' }}>조리법 ({r.steps.length}단계)</div>
          <div className="font-bold" style={{ fontSize: 9, color: '#4a2a12', lineHeight: '12px', wordBreak: 'keep-all' }}>{stepKinds.map((k) => kindName[k]).join(' → ')}</div>
        </div>
      </div>
      <div className="absolute w-full flex items-center justify-center gap-3" style={{ bottom: 18 }}>
        <ImgButton label="메뉴로" onClick={onBack} kind="wood" width={100} height={50} fontSize={14} />
        <ImgButton label="연습 시작!" onClick={() => { setGameKey((k) => k + 1); setPlaying(true); }} kind="red" width={170} height={60} fontSize={20} className="anim-pulse" />
      </div>
    </div>
  );
}
