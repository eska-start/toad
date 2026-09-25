import { useEffect, useRef, useState } from 'react';
import { Sprite } from '../../Sprite';
import { useAssets } from '../../../game/AssetContext';
import { EQUIP, FOOD, FX, ING, IngredientId, ING_NAME } from '../../../game/atlas';
import { useDrag, useDrop } from '../../../game/drag';
import { Burst, Flame, Gauge, Instruction, Steam, StepProps, Stove, useLoop, useSwipe } from './common';
import { BURNER_FLAME_Y, GAUGE_TOP_Y, STOVE, WOK } from './WokSteps';
import { sfx } from '../../../game/sfx';

// ───────────────────────── 면 삶기 + 건지기 (Drag) ─────────────────────────
export function NoodleStep(p: StepProps) {
  const step = p.step as Extract<StepProps['step'], { kind: 'noodle' }>;
  const { atlas } = useAssets();
  const { startDrag, dragging } = useDrag();
  const [done, setDone] = useState(0);
  const s = useRef({ done: 0, finished: false });
  const potUp = p.save.upgrades.pot;
  const perfect: [number, number] = potUp ? [step.perfect[0] - 6, Math.min(100, step.perfect[1] + 6)] : step.perfect;

  useEffect(() => { p.setToadBase('noodle'); }, []); // eslint-disable-line

  useLoop((dt) => {
    const st = s.current;
    if (st.finished) return;
    st.done = Math.min(130, st.done + (100 / 9) * dt);
    setDone(st.done);
    if (st.done >= 130) {
      st.finished = true;
      p.addWaste(1);
      p.flashToad('fail', 1500);
      sfx.angry();
      p.setVis({ bowl: 'noodle' });
      p.onDone(0.12, { msg: '면이 다 퍼져버렸다...' });
    }
  });

  useDrop((payload, dropId) => {
    if (payload.type !== 'strainer') return false;
    const st = s.current;
    if (st.finished) return true;
    if (dropId !== 'noodle-bowl') {
      p.toast('그릇 위에 놓아라!', false);
      return true;
    }
    st.finished = true;
    const d = st.done;
    const [lo, hi] = perfect;
    let score: number; let msg: string;
    if (d < lo) { score = Math.max(0.15, (d / lo) * 0.55); msg = '면이 설익었다'; }
    else if (d > hi) { score = Math.max(0.15, 1 - (d - hi) / 30); msg = '면이 불었다'; }
    else { const c = (lo + hi) / 2, half = (hi - lo) / 2; score = Math.max(0.6, 1 - (Math.abs(d - c) / half) * 0.35); msg = score > 0.9 ? '완벽한 면발!' : '탱탱한 면발'; }
    p.setVis({ bowl: 'noodle' });
    p.flashToad(score > 0.6 ? 'happy' : 'panic', 800);
    if (score > 0.6) sfx.pop(); else sfx.angry();
    p.onDone(score, { msg });
    return true;
  });

  const isDragging = dragging?.type === 'strainer';
  const state = done < perfect[0] ? '삶는 중' : done <= perfect[1] ? '지금 건져라!' : '불고 있다!';

  return (
    <>
      <Instruction text={step.label} sub={state} />
      <Stove x={STOVE.x} y={STOVE.y} size={STOVE.size} upgraded={p.save.upgrades.stove} />
      <Flame heat={80} x={WOK.cx} y={BURNER_FLAME_Y} size={130} />
      {/* 냄비 (웍과 같은 중심에 놓이도록 정렬) */}
      <div className="absolute pointer-events-none" style={{ left: WOK.cx - 75, top: WOK.cy - 75, width: 150, height: 150 }}>
        <Sprite src={atlas.equipment} frame={potUp ? EQUIP.potNew : EQUIP.potOld} size={150} />
        <Steam x={75} y={40} count={3} />
      </div>
      {/* 면 + 건지개 (드래그 핸들, 냄비 위에 얹혀 보이게) */}
      {!isDragging && !s.current.finished && (
        <div className="absolute" style={{ left: WOK.cx - 50, top: WOK.cy - 72, width: 100, height: 100, touchAction: 'none' }} onPointerDown={(e) => startDrag(e, { type: 'strainer', atlas: 'equipment', frame: EQUIP.strainer, size: 110 })}>
          <Sprite src={atlas.food} frame={FOOD.rawNoodle} size={66} className="absolute anim-bob" style={{ left: 18, top: 20, filter: `brightness(${1.1 - done / 400})` }} />
          <Sprite src={atlas.equipment} frame={EQUIP.strainer} size={100} className="anim-wobble" style={{ filter: 'drop-shadow(0 4px 3px rgba(0,0,0,0.4))' }} />
        </div>
      )}
      {/* 그릇 (옮겨담기 단계와 같은 자리/크기) */}
      {/* 그릇: 냄비(오른쪽 화구)와 겹치지 않도록 왼쪽 작업대 */}
      <div className="absolute" style={{ left: 14, top: 88, width: 120, height: 120 }} data-drop="noodle-bowl">
        <Sprite src={atlas.food} frame={FOOD.emptyBowl} size={120} dataDrop="noodle-bowl" style={{ filter: isDragging ? 'drop-shadow(0 0 10px #ffe56a)' : undefined }} />
        <div className="absolute w-full text-center text-white font-black stroke-thin pointer-events-none" style={{ top: 100, fontSize: 11 }}>여기로 건져 담기</div>
      </div>
      <Gauge x={60} y={238} w={112} value={Math.min(100, done)} target={perfect} label="면 익힘" color={done > perfect[1] ? '#c33' : '#f4c542'} />
    </>
  );
}

// ───────────────────────── 고명 배치 (Drag) ─────────────────────────
export function PlateStep(p: StepProps) {
  const step = p.step as Extract<StepProps['step'], { kind: 'plate' }>;
  const { atlas } = useAssets();
  const { dragging } = useDrag();
  const [placed, setPlaced] = useState<(IngredientId | null)[]>(step.toppings.map(() => null));
  const [wrong, setWrong] = useState(0);
  const [fx, setFx] = useState<number[]>([]);
  const finished = useRef(false);

  useEffect(() => { p.setToadBase('serve'); }, []); // eslint-disable-line

  const slotPos = [{ x: 42, y: 40 }, { x: 96, y: 64 }, { x: 60, y: 84 }];

  useDrop((payload, dropId) => {
    if (payload.type !== 'ingredient' || !dropId?.startsWith('slot-')) return false;
    if (finished.current) return true;
    const idx = Number(dropId.split('-')[1]);
    const id = payload.id as IngredientId;
    if (placed[idx]) { p.toast('이미 올렸다', false); return true; }
    const need = step.toppings.filter((t) => !placed.includes(t));
    if (!need.includes(id)) {
      setWrong((w) => w + 1);
      p.addWaste(1);
      p.flashToad('panic', 700);
      p.toast(`${ING_NAME[id]}은(는) 고명이 아니야!`, false);
      return true;
    }
    const next = [...placed];
    next[idx] = id;
    setPlaced(next);
    sfx.pop();
    setFx((f) => [...f, Date.now()]);
    setTimeout(() => setFx((f) => f.slice(1)), 900);
    p.setVis({ toppings: next.filter(Boolean) as string[] });
    if (next.every(Boolean)) {
      finished.current = true;
      p.flashToad('happy', 900);
      setTimeout(() => p.onDone(Math.max(0.3, 1 - wrong * 0.2), { msg: '보기 좋게 담았다!' }), 400);
    }
    return true;
  });

  const size = 190;
  const isDragging = dragging?.type === 'ingredient';

  return (
    <>
      <Instruction text={step.label} sub={`고명: ${step.toppings.map((t) => ING_NAME[t]).join(', ')}`} />
      <div className="absolute" style={{ left: WOK.cx - size / 2 + 6, top: 66, width: size, height: size }}>
        <Sprite src={atlas.food} frame={step.plateFrame} size={size} />
        <Steam x={size / 2} y={70} count={2} />
        {slotPos.slice(0, step.toppings.length).map((sp, i) => (
          <div key={i} data-drop={`slot-${i}`} className="absolute" style={{ left: sp.x, top: sp.y, width: 52, height: 52, borderRadius: 26, border: placed[i] ? 'none' : '2px dashed rgba(255,255,255,0.8)', background: placed[i] ? 'transparent' : 'rgba(255,255,255,0.18)', boxShadow: isDragging && !placed[i] ? '0 0 12px #ffe56a' : undefined }}>
            {placed[i] && <Sprite src={atlas.ingredients} frame={ING[placed[i]!]} size={52} className="anim-pop" style={{ pointerEvents: 'none' }} />}
          </div>
        ))}
      </div>
      {fx.map((k) => <Burst key={k} frame={FX.sparkle} x={WOK.cx} y={120} />)}
      <div className="absolute text-white font-black stroke-thin anim-pulse" style={{ left: WOK.cx - 110, top: 258, width: 220, fontSize: 12, textAlign: 'center' }}>아래 트레이에서 고명을 끌어와 점선 자리에 올려라</div>
    </>
  );
}

// ───────────────────────── 비비기 (Swipe, 마스크 리빌) ─────────────────────────
export function MixStep(p: StepProps) {
  const step = p.step as Extract<StepProps['step'], { kind: 'mix' }>;
  const { atlas } = useAssets();
  const [count, setCount] = useState(0);
  const s = useRef({ count: 0, path: 0, start: performance.now(), done: false });
  const [tool, setTool] = useState({ x: 100, y: 100, on: false });

  useEffect(() => { p.setToadBase('chop1'); }, []); // eslint-disable-line

  const finish = () => {
    const st = s.current;
    if (st.done) return;
    st.done = true;
    const secs = (performance.now() - st.start) / 1000;
    const score = secs > 16 ? 0.7 : secs > 10 ? 0.88 : 1;
    p.setVis({ bowl: 'done' });
    p.flashToad('happy', 900);
    sfx.pop();
    setTimeout(() => p.onDone(score, { msg: '윤기 나게 잘 비볐다!' }), 400);
  };

  const { handlers } = useSwipe({
    minAmp: 24,
    hover: true,
    onStroke: () => {
      const st = s.current;
      if (st.done) return;
      st.count++;
      setCount(st.count);
      sfx.stir(0.65);
      p.flashToad(st.count % 2 ? 'chop1' : 'chop2', 250);
      if (st.count >= step.count) finish();
    },
  });

  const zoneRef = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const r = zoneRef.current?.getBoundingClientRect();
    if (!r) return;
    const sc = r.width / 220;
    setTool({ x: (e.clientX - r.left) / sc, y: (e.clientY - r.top) / sc, on: true });
  };

  const prog = Math.min(1, count / step.count);
  const size = 190;

  return (
    <>
      <Instruction text={step.label} sub={`비비기 ${count}/${step.count}`} />
      <div
        ref={zoneRef}
        className="absolute"
        style={{ left: WOK.cx - 110, top: 60, width: 220, height: 220, ...handlers.style, cursor: 'none' }}
        onPointerDown={(e) => { handlers.onPointerDown(e); move(e); }}
        onPointerMove={(e) => { handlers.onPointerMove(e); move(e); }}
        onPointerUp={(e) => { handlers.onPointerUp(); if (e.pointerType !== 'mouse') setTool((t) => ({ ...t, on: false })); }}
        onPointerCancel={() => { handlers.onPointerCancel(); setTool((t) => ({ ...t, on: false })); }}
        onPointerLeave={() => { handlers.onPointerLeave(); setTool((t) => ({ ...t, on: false })); }}
      >
        <div className="absolute pointer-events-none" style={{ left: 15, top: 15, width: size, height: size }}>
          {/* 소스가 얹힌 면 (비비기 전) */}
          <Sprite src={atlas.food} frame={FOOD.noodleBowl} size={size} className="absolute" style={{ left: 0, top: 0 }} />
          <div className="absolute" style={{ left: 0, top: 0, width: size, height: size, clipPath: 'inset(28% 30% 34% 30% round 50%)' }}>
            <Sprite src={atlas.food} frame={FOOD.wokJjajang} size={size} style={{ transform: 'scale(0.8)' }} />
          </div>
          {/* 비빌수록 중심에서 퍼지는 완성 짜장 (마스크) */}
          <div className="absolute" style={{ left: 0, top: 0, width: size, height: size, clipPath: `circle(${prog * 46 + 2}% at 50% 50%)`, transition: 'clip-path 0.15s' }}>
            <Sprite src={atlas.food} frame={FOOD.jjajang} size={size} />
          </div>
          <Steam x={size / 2} y={70} count={1} />
        </div>
        {tool.on && <Sprite src={atlas.equipment} frame={EQUIP.strainer} size={80} className="absolute pointer-events-none" style={{ left: tool.x - 20, top: tool.y - 70, transform: 'rotate(40deg)', filter: 'drop-shadow(0 3px 2px rgba(0,0,0,0.4))' }} />}
      </div>
      <div className="absolute text-white font-black stroke-thin anim-pulse" style={{ left: WOK.cx - 100, top: 262, width: 200, textAlign: 'center', fontSize: 12 }}>← 그릇 위를 좌우로 쓸어 비벼라 →</div>
      <Gauge x={20} y={GAUGE_TOP_Y} w={120} value={prog * 100} label="비빔" color="#8b5a2b" />
    </>
  );
}

// ───────────────────────── 서빙 (Drag → 손님) ─────────────────────────
export function ServeStep(p: StepProps) {
  const { atlas } = useAssets();
  const { startDrag, dragging } = useDrag();
  useEffect(() => { p.setToadBase('serve'); }, []); // eslint-disable-line
  const isDragging = dragging?.type === 'dish';
  return (
    <>
      <Instruction text={p.step.label} sub="완성된 음식을 잡아 주문한 손님에게 끌어다 놓아라 ↑" />
      <div className="absolute flex flex-col items-center" style={{ left: WOK.cx - 85, top: 66, touchAction: 'none', opacity: isDragging ? 0.25 : 1 }}
        onPointerDown={(e) => startDrag(e, { type: 'dish', id: p.recipe.id, atlas: 'food', frame: p.recipe.foodFrame, size: 120 })}>
        <div className="relative">
          <Sprite src={atlas.food} frame={p.recipe.foodFrame} size={170} className="anim-bob" style={{ filter: 'drop-shadow(0 8px 6px rgba(0,0,0,0.45))' }} />
          <Steam x={85} y={60} count={3} />
          <Burst frame={FX.sparkle} x={40} y={40} size={60} />
        </div>
        <div className="text-white font-black stroke" style={{ fontSize: 15, marginTop: -10 }}>{p.recipe.name} 완성!</div>
        <div className="text-yellow-200 font-bold stroke-thin anim-pulse" style={{ fontSize: 12 }}>잡아서 손님에게 드래그</div>
      </div>
    </>
  );
}
