import { AnimSprite, Sprite } from '../Sprite';
import { useAssets } from '../../game/AssetContext';
import { CUSTOMER_COL, CUSTOMER_NAMES, FX, UI } from '../../game/atlas';
import { RECIPES, type Grade, type MenuId } from '../../game/recipes';

export type CustState = 'enter' | 'wait' | 'eat' | 'happy' | 'angry' | 'leave';

export interface Customer {
  id: number;
  char: number;
  menu: MenuId;
  seat: number;
  state: CustState;
  patience: number;
  maxPatience: number;
  timer: number;
  reaction?: { grade: Grade; pay: number };
}

const SEAT_X = [18, 122, 226];
const SIZE = 118;

export function CustomerView({ c, onTapOrder, highlight, accepted }: { c: Customer; onTapOrder: (c: Customer) => void; highlight: boolean; accepted: boolean }) {
  const { atlas } = useAssets();
  const row = c.char * 4;
  const ratio = Math.max(0, c.patience / c.maxPatience);
  const impatient = c.state === 'wait' && ratio < 0.35;

  // 상태별 프레임 애니메이션
  let frames: number[]; let fps = 2;
  switch (c.state) {
    case 'enter': frames = [row + CUSTOMER_COL.wait, row + CUSTOMER_COL.expect]; fps = 5; break;
    case 'wait': frames = impatient ? [row + CUSTOMER_COL.wait, row + CUSTOMER_COL.angry] : accepted ? [row + CUSTOMER_COL.expect, row + CUSTOMER_COL.wait] : [row + CUSTOMER_COL.wait]; fps = impatient ? 1.5 : 2; break;
    case 'eat': frames = [row + CUSTOMER_COL.eat, row + CUSTOMER_COL.expect]; fps = 3; break;
    case 'happy': frames = [row + CUSTOMER_COL.expect, row + CUSTOMER_COL.eat]; fps = 4; break;
    case 'angry': frames = [row + CUSTOMER_COL.angry]; break;
    case 'leave': frames = c.reaction && c.reaction.grade !== '실패' ? [row + CUSTOMER_COL.expect, row + CUSTOMER_COL.wait] : [row + CUSTOMER_COL.angry, row + CUSTOMER_COL.wait]; fps = 5; break;
    default: frames = [row];
  }

  // 입장/퇴장 슬라이드
  const x = SEAT_X[c.seat];
  const enterOff = c.state === 'enter' ? (1 - Math.min(1, c.timer / 1.1)) * 220 : 0;
  const leaveOff = c.state === 'leave' ? Math.min(1, c.timer / 1.1) * 240 : 0;
  const offset = enterOff + leaveOff;
  const bob = c.state === 'enter' || c.state === 'leave' ? Math.abs(Math.sin(c.timer * 14)) * 6 : 0;
  const hearts = Math.ceil(ratio * 3);

  return (
    <div className="absolute" style={{ left: x + offset, top: 62 - bob, width: SIZE, height: SIZE + 40, transition: 'left 0.1s linear', zIndex: 5 }} data-drop={c.state === 'wait' ? `seat-${c.seat}` : undefined}>
      {/* 말풍선 주문서 */}
      {c.state === 'wait' && (
        <button
          type="button"
          aria-label={accepted ? `${RECIPES[c.menu].name} 주문 접수됨` : `${RECIPES[c.menu].name} 주문 수락`}
          aria-pressed={accepted}
          data-drop={`seat-${c.seat}`}
          className="absolute"
          style={{ left: 30, top: -22, width: 84, height: 76, zIndex: 6, padding: 0, border: 0, background: 'none', appearance: 'none', cursor: accepted ? 'default' : 'pointer', touchAction: 'manipulation' }}
          onClick={(e) => { e.stopPropagation(); if (!accepted) onTapOrder(c); }}
        >
          <Sprite src={atlas.ui} frame={UI.bubble} size={84} className={highlight ? 'anim-pulse pointer-events-none' : 'pointer-events-none'} style={{ position: 'absolute', left: 0, top: -6, filter: highlight ? 'drop-shadow(0 0 8px #ffe56a)' : 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))' }} />
          <Sprite src={atlas.food} frame={RECIPES[c.menu].foodFrame} size={46} className="pointer-events-none" style={{ position: 'absolute', left: 19, top: 6 }} />
          {accepted && <Sprite src={atlas.ui} frame={UI.check} size={24} className="absolute pointer-events-none anim-pop" style={{ right: 1, top: 1 }} />}
          <div className="absolute pointer-events-none flex justify-center" style={{ left: 0, top: 50, width: 84, gap: 1 }}>
            {[0, 1, 2].map((i) => (
              <Sprite key={i} src={atlas.ui} frame={UI.heart} size={16} style={{ opacity: i < hearts ? 1 : 0.2, filter: i < hearts ? undefined : 'grayscale(1)' }} className={impatient && i < hearts ? 'anim-pulse' : ''} />
            ))}
          </div>
        </button>
      )}
      {/* 캐릭터 */}
      <div data-drop={c.state === 'wait' ? `seat-${c.seat}` : undefined} className={c.state === 'angry' || impatient ? 'anim-shake' : ''} style={{ position: 'absolute', left: 0, top: 30, filter: highlight ? 'drop-shadow(0 0 6px #ffe56a)' : undefined }}>
        <AnimSprite src={atlas.customers} frames={frames} fps={fps} size={SIZE} dataDrop={c.state === 'wait' ? `seat-${c.seat}` : undefined} flip={c.state === 'leave'} />
      </div>
      {/* 반응 FX */}
      {c.state === 'happy' && <Sprite src={atlas.fx} frame={FX.heartBurst} size={70} className="absolute anim-float pointer-events-none" style={{ left: 24, top: -10 }} />}
      {c.state === 'angry' && <Sprite src={atlas.fx} frame={FX.angryBurst} size={70} className="absolute anim-float pointer-events-none" style={{ left: 24, top: -10 }} />}
      {c.state === 'eat' && <Sprite src={atlas.fx} frame={FX.steam2} size={40} className="absolute anim-steam pointer-events-none" style={{ left: 40, top: 40 }} />}
      {(c.state === 'happy' || c.state === 'angry') && c.reaction && (
        <div className="absolute w-full text-center font-black stroke anim-float" style={{ top: 10, fontSize: 14, color: c.reaction.grade === '실패' ? '#ff7b7b' : '#ffe56a', zIndex: 7 }}>
          {c.reaction.grade}<br />{c.reaction.pay > 0 ? `+${c.reaction.pay.toLocaleString()}원` : '돈 안 냄!'}
        </div>
      )}
      {c.state === 'leave' && c.reaction === undefined && (
        <div className="absolute w-full text-center font-black stroke" style={{ top: 10, fontSize: 12, color: '#ff7b7b' }}>"기다리다 지쳤다!"</div>
      )}
      <div className="absolute w-full text-center text-white font-bold stroke-thin" style={{ top: SIZE + 22, fontSize: 10 }}>{CUSTOMER_NAMES[c.char]}</div>
    </div>
  );
}
