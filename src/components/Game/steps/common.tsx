import { CSSProperties, ReactNode, useEffect, useRef, useState } from 'react';
import { AnimSprite, Sprite, SpriteBox } from '../../Sprite';
import { useAssets } from '../../../game/AssetContext';
import { EQUIP, FIRE_FRAMES, FX, SMOKE_FRAMES, STEAM_FRAMES, ToadPose, UI } from '../../../game/atlas';
import type { Recipe, Step } from '../../../game/recipes';
import type { SaveData } from '../../../game/save';

export type WokVisual = 'empty' | 'raw' | 'fried' | 'soup' | 'jjajang' | 'burnt';

export interface CookVisual {
  wok: WokVisual;
  heat: number;          // 0~100
  bowl: 'none' | 'empty' | 'noodle' | 'soup' | 'done';
  soupPct: number;       // 0~100 (국물/소스 차오름)
  toppings: string[];
  fried: 'none' | 'raw' | 'done' | 'sauced';
}

export interface StepProps {
  step: Step;
  recipe: Recipe;
  save: SaveData;
  vis: CookVisual;
  setVis: (patch: Partial<CookVisual>) => void;
  onDone: (score: number, opts?: { wasted?: number; burnt?: boolean; msg?: string }) => void;
  flashToad: (pose: ToadPose, ms?: number) => void;
  setToadBase: (pose: ToadPose) => void;
  addWaste: (n?: number) => void;
  toast: (msg: string, good?: boolean) => void;
}

/** rAF 루프 (dt 초 단위) */
export function useLoop(fn: (dt: number) => void, active = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!active) return;
    let last = performance.now();
    let id = 0;
    const tick = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      ref.current(dt);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [active]);
}

/** 불꽃 FX: heat(0~100)에 따라 크기/프레임 속도 변화 */
export function Flame({ heat, x, y, size = 90 }: { heat: number; x: number; y: number; size?: number }) {
  const { atlas } = useAssets();
  if (heat < 4) return null;
  const s = 0.35 + (heat / 100) * 0.85;
  return (
    <div className="absolute pointer-events-none" style={{ left: x - size / 2, top: y - size, width: size, height: size, transform: `scale(${s})`, transformOrigin: '50% 100%', opacity: 0.75 + heat / 400, mixBlendMode: 'screen' }}>
      <AnimSprite src={atlas.fx} frames={FIRE_FRAMES} fps={6 + heat / 10} size={size} />
    </div>
  );
}

export function Steam({ x, y, size = 60, count = 2, dark = false }: { x: number; y: number; size?: number; count?: number; dark?: boolean }) {
  const { atlas } = useAssets();
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="absolute pointer-events-none anim-steam" style={{ left: x - size / 2 + (i - (count - 1) / 2) * 22, top: y - size, animationDelay: `${i * 0.5}s`, opacity: 0 }}>
          <AnimSprite src={atlas.fx} frames={dark ? SMOKE_FRAMES : STEAM_FRAMES} fps={4} size={size} style={{ opacity: dark ? 0.85 : 0.7 }} />
        </div>
      ))}
    </>
  );
}

export function Burst({ frame, x, y, size = 80 }: { frame: number; x: number; y: number; size?: number }) {
  const { atlas } = useAssets();
  return (
    <div className="absolute pointer-events-none anim-float" style={{ left: x - size / 2, top: y - size / 2 }}>
      <Sprite src={atlas.fx} frame={frame} size={size} />
    </div>
  );
}

/** 조리 안내: 나무 판의 안쪽 영역에 긴 레시피도 줄바꿈하여 표시 */
export function Instruction({ text, sub }: { text: string; sub?: ReactNode }) {
  const { atlas } = useAssets();
  return (
    <div className="absolute pointer-events-none" style={{ left: 8, top: 0, width: 344, height: 54 }}>
      <SpriteBox src={atlas.ui} frame={UI.btnWood} width={344} height={54} style={{ position: 'absolute', inset: 0 }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ padding: '3px 22px', overflow: 'hidden' }}>
        <div className="font-black text-white stroke-thin" style={{ maxWidth: '100%', fontSize: 11.5, lineHeight: '13px', wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{text}</div>
        {sub && <div className="font-black stroke-thin" style={{ maxWidth: '100%', fontSize: 10, lineHeight: '11px', color: '#ffe56a', marginTop: 1, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{sub}</div>}
      </div>
    </div>
  );
}

/** 가스 스토브 (업그레이드 반영) */
export function Stove({ x, y, size, upgraded }: { x: number; y: number; size: number; upgraded: boolean }) {
  const { atlas } = useAssets();
  return <Sprite src={atlas.equipment} frame={upgraded ? EQUIP.stoveNew : EQUIP.stoveOld} size={size} style={{ position: 'absolute', left: x, top: y }} className="pointer-events-none" />;
}

/** 불 조절 노브(Hold) — 누르는 동안 onHold(true) */
export function Knob({ x, y, heat, holding, setHolding, label = '불 조절', onDown }: { x: number; y: number; heat: number; holding: boolean; setHolding: (h: boolean) => void; label?: string; onDown?: () => void }) {
  const { atlas } = useAssets();
  return (
    <div className="absolute flex flex-col items-center" style={{ left: x, top: y, width: 84, touchAction: 'none' }}>
      <div
        onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); setHolding(true); onDown?.(); }}
        onPointerUp={() => setHolding(false)}
        onPointerCancel={() => setHolding(false)}
        style={{ transform: `scale(${holding ? 0.92 : 1})`, transition: 'transform 0.1s' }}
      >
        <Sprite src={atlas.ui} frame={UI.knob} size={84} style={{ transform: `rotate(${-130 + heat * 2.6}deg)`, transition: 'transform 0.08s linear', filter: holding ? 'brightness(1.15)' : undefined }} />
      </div>
      <div className="text-white font-black stroke-thin" style={{ fontSize: 11, marginTop: -6 }}>{label} (꾹)</div>
    </div>
  );
}

/** 게이지: 나무 패널 이미지 안에 채움 + 적정 구간 표시 */
export function Gauge({ x, y, w = 150, value, target, label, color = '#ff7a1a' }: { x: number; y: number; w?: number; value: number; target?: [number, number]; label: string; color?: string }) {
  const { atlas } = useAssets();
  const inZone = target && value >= target[0] && value <= target[1];
  return (
    <div className="absolute" style={{ left: x, top: y, width: w, height: 30 }}>
      <SpriteBox src={atlas.ui} frame={UI.btnWood} width={w} height={30} style={{ position: 'absolute', inset: 0 }} />
      <div className="absolute" style={{ left: 10, right: 10, top: 9, height: 12, borderRadius: 6, background: 'rgba(40,20,10,0.55)', overflow: 'hidden' }}>
        {target && <div className="absolute top-0 bottom-0" style={{ left: `${target[0]}%`, width: `${target[1] - target[0]}%`, background: 'rgba(120,255,120,0.45)' }} />}
        <div className="absolute top-0 bottom-0 left-0" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: inZone ? '#6ee76e' : color, boxShadow: inZone ? '0 0 8px #8f8' : undefined }} />
      </div>
      <div className="absolute w-full text-center text-white font-black stroke-thin pointer-events-none" style={{ top: -14, fontSize: 11, lineHeight: '13px', whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  );
}

/** 스와이프 존: 포인터 이동 추적. 반환값: 존 props + 최근 이동 상태 */
export function useSwipe(opts: {
  onStroke?: (dir: 1 | -1, amplitude: number) => void;   // 좌우 방향 전환마다 호출
  onPath?: (len: number) => void;                        // 이동 거리 누적
  minAmp?: number;
  hover?: boolean;  // true면 마우스 버튼을 누르지 않고 움직여도(휘젓기) 인식
}) {
  const st = useRef({ down: false, init: false, lastX: 0, lastY: 0, dir: 0 as 0 | 1 | -1, startX: 0, extreme: 0 });
  const [active, setActive] = useState(false);
  const [dx, setDx] = useState(0);
  const minAmp = opts.minAmp ?? 28;
  const onRef = useRef(opts); onRef.current = opts;

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      st.current = { down: true, init: true, lastX: e.clientX, lastY: e.clientY, dir: 0, startX: e.clientX, extreme: e.clientX };
      setActive(true);
    },
    onPointerLeave: () => {
      if (st.current.down) return;
      st.current.init = false;
      setActive(false); setDx(0);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = st.current;
      if (!s.down && !onRef.current.hover) return;
      if (!s.init) {
        // 호버 진입 첫 이동: 기준점만 잡는다
        st.current = { down: false, init: true, lastX: e.clientX, lastY: e.clientY, dir: 0, startX: e.clientX, extreme: e.clientX };
        setActive(true);
        return;
      }
      const mx = e.clientX - s.lastX, my = e.clientY - s.lastY;
      const len = Math.hypot(mx, my);
      s.lastX = e.clientX; s.lastY = e.clientY;
      if (len > 0) onRef.current.onPath?.(len);
      const ndir: 1 | -1 | 0 = mx > 0 ? 1 : mx < 0 ? -1 : 0;
      if (ndir !== 0) {
        if (s.dir === 0) { s.dir = ndir; s.extreme = e.clientX; s.startX = e.clientX; }
        else if (ndir !== s.dir) {
          const amp = Math.abs(s.extreme - s.startX);
          if (amp >= minAmp) {
            onRef.current.onStroke?.(s.dir, amp);
            s.startX = s.extreme;
          }
          s.dir = ndir;
        }
        if ((ndir === 1 && e.clientX > s.extreme) || (ndir === -1 && e.clientX < s.extreme)) s.extreme = e.clientX;
        if (s.dir === 1 && e.clientX > s.extreme) s.extreme = e.clientX;
        if (s.dir === -1 && e.clientX < s.extreme) s.extreme = e.clientX;
      }
      setDx(Math.max(-60, Math.min(60, (e.clientX - s.startX) * 0.5)));
    },
    onPointerUp: () => { st.current.down = false; if (!onRef.current.hover) { st.current.init = false; setActive(false); } setDx(0); },
    onPointerCancel: () => { st.current.down = false; st.current.init = false; setActive(false); setDx(0); },
    style: { touchAction: 'none' } as CSSProperties,
  };
  return { handlers, active, dx };
}

/** 튀김/웍 안 재료 시각화용 작은 재료 스프라이트들 */
export function Bits({ items, cx, cy, r = 26, size = 30, jitter = 0, opacity = 1 }: { items: number[]; cx: number; cy: number; r?: number; size?: number; jitter?: number; opacity?: number }) {
  const { atlas } = useAssets();
  return (
    <>
      {items.map((f, i) => {
        const a = (i / Math.max(1, items.length)) * Math.PI * 2 + 0.6;
        const rr = items.length === 1 ? 0 : r;
        return (
          <Sprite key={i} src={atlas.ingredients} frame={f} size={size} className="absolute pointer-events-none" style={{ left: cx + Math.cos(a) * rr - size / 2 + jitter * (i % 2 ? 1 : -1), top: cy + Math.sin(a) * rr * 0.5 - size / 2, opacity, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.4))' }} />
        );
      })}
    </>
  );
}

export const FXF = FX;
