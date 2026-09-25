import { useEffect, useRef, useState } from 'react';
import { Sprite } from '../../Sprite';
import { useAssets } from '../../../game/AssetContext';
import { EQUIP, FOOD, FX, ING, IngredientId, ING_NAME, UI } from '../../../game/atlas';
import { useDrag, useDrop } from '../../../game/drag';
import { Bits, Burst, Flame, Gauge, Instruction, Knob, Steam, StepProps, Stove, useLoop, useSwipe, WokVisual } from './common';
import { sfx } from '../../../game/sfx';
import { FoodFill } from './FoodFill';

// 가스레인지 화구 중심과 웍을 위로 올려, 불꽃이 웍 바닥을 감싸도록 배치
// 화구(가스레인지 상판) 기준점 하나로 냄비·웍·불꽃을 정렬한다.
export const STOVE = { x: 134, y: 96, size: 196 };
export const BURNER = { x: STOVE.x + STOVE.size / 2, y: STOVE.y + Math.round(STOVE.size * 0.42) };
// 조리도구 바닥이 화구 위에 얹히도록 중심을 화구보다 위로
export const WOK = { cx: BURNER.x, cy: BURNER.y - 52, size: 150 };
// 불꽃 밑동은 화구 위치 (조리도구 아래)
export const BURNER_FLAME_Y = WOK.cy + WOK.size / 2 + 8;
// 게이지는 화구 아래(가스레인지 앞판), 노브는 가스레인지 왼쪽에 둬서 조리도구를 가리지 않게
export const GAUGE_X = STOVE.x + 46;
export const GAUGE_Y = 254;
// 상단 좌측 게이지: 단계 진행 표시(top 56~82) 아래에 라벨(-15px)까지 겹치지 않도록 배치
export const GAUGE_TOP_Y = 104;
export const KNOB_X = 62;
export const KNOB_Y = 150;

/** 웍 뷰 (상태별 프레임 + 불꽃/김/연기 FX) */
export function WokView({ vis, heat, dx = 0, rot = 0, upgraded, dataDrop, bits, lift = 0, hidden }: {
  vis: WokVisual; heat: number; dx?: number; rot?: number; upgraded: boolean; dataDrop?: string; bits?: number[]; lift?: number; hidden?: boolean;
}) {
  const { atlas } = useAssets();
  const frame = vis === 'raw' ? FOOD.wokRaw : vis === 'fried' ? FOOD.wokFried : vis === 'soup' ? FOOD.wokSoup : vis === 'jjajang' ? FOOD.wokJjajang : vis === 'burnt' ? FOOD.wokBurnt : -1;
  if (hidden) return null;
  return (
    <>
      <Flame heat={heat} x={WOK.cx} y={BURNER_FLAME_Y} size={130} />
      <div className="absolute" style={{ left: WOK.cx - WOK.size / 2 + dx, top: WOK.cy - WOK.size / 2 - lift, width: WOK.size, height: WOK.size, transform: `rotate(${rot}deg)`, transition: 'left 0.05s linear' }} data-drop={dataDrop}>
        {frame < 0
          ? <Sprite src={atlas.equipment} frame={upgraded ? EQUIP.wokNew : EQUIP.wokOld} size={WOK.size} dataDrop={dataDrop} />
          : <Sprite src={atlas.food} frame={frame} size={WOK.size} dataDrop={dataDrop} />}
        {bits && bits.length > 0 && <Bits items={bits} cx={WOK.size / 2} cy={WOK.size / 2 - 4} r={28} size={30} />}
        {(vis === 'soup' || vis === 'jjajang') && heat > 25 && <Steam x={WOK.size / 2} y={WOK.size / 2 - 10} count={2} />}
        {vis === 'burnt' && <Steam x={WOK.size / 2} y={WOK.size / 2 - 10} count={2} dark />}
      </div>
    </>
  );
}

const bitOf = (id: IngredientId) => ING[id];

// ───────────────────────── 가열 (Hold) ─────────────────────────
export function HeatStep(p: StepProps) {
  const step = p.step as Extract<StepProps['step'], { kind: 'heat' }>;
  const [heat, setHeat] = useState(p.vis.heat);
  const [holding, setHolding] = useState(false);
  const holdRef = useRef(false);
  const heatRef = useRef(heat);
  const fails = useRef(0);
  const wasHolding = useRef(false);
  const stoveUp = p.save.upgrades.stove;
  const target: [number, number] = stoveUp ? [step.target[0] - 6, Math.min(100, step.target[1] + 6)] : step.target;

  useEffect(() => { p.setToadBase('fire'); }, []); // eslint-disable-line

  useLoop((dt) => {
    let h = heatRef.current;
    if (holdRef.current) h += (stoveUp ? 42 : 30) * dt; else h -= 10 * dt;
    h = Math.max(0, Math.min(100, h));
    heatRef.current = h;
    setHeat(h);
    p.setVis({ heat: h });
    // 릴리즈 판정
    if (wasHolding.current && !holdRef.current) {
      wasHolding.current = false;
      if (h >= target[0] && h <= target[1]) {
        const c = (target[0] + target[1]) / 2, half = (target[1] - target[0]) / 2;
        const score = Math.max(0.5, 1 - (Math.abs(h - c) / half) * 0.4) - fails.current * 0.12;
        p.onDone(Math.max(0.2, score), { msg: '웍이 잘 달궈졌다!' });
      } else {
        fails.current++;
        p.flashToad('panic', 900);
        p.toast(h < target[0] ? '아직 덜 달궈졌어! 더 눌러!' : '너무 뜨거워! 조금 식혀서 다시', false);
      }
    }
    if (holdRef.current) wasHolding.current = true;
  });

  const setHold = (v: boolean) => { holdRef.current = v; setHolding(v); };

  return (
    <>
      <Instruction text={step.label} sub={`적정 온도 ${target[0]}~${target[1]} 구간에서 손을 떼라`} />
      <Stove x={STOVE.x} y={STOVE.y} size={STOVE.size} upgraded={stoveUp} />
      <WokView vis={p.vis.wok} heat={heat} upgraded={p.save.upgrades.wok} />
      <Gauge x={GAUGE_X} y={GAUGE_Y} w={150} value={heat} target={target} label="웍 온도" />
      <Knob x={KNOB_X} y={KNOB_Y} heat={heat} holding={holding} setHolding={setHold} onDown={() => sfx.click()} />
      {!holding && heat > 40 && <Steam x={WOK.cx} y={WOK.cy - 30} count={1} />}
    </>
  );
}

// ───────────────────────── 재료 투입 (Drag) ─────────────────────────
export function AddStep(p: StepProps) {
  const step = p.step as Extract<StepProps['step'], { kind: 'add' }>;
  const { atlas } = useAssets();
  const [remaining, setRemaining] = useState<IngredientId[]>(step.items);
  const [wrong, setWrong] = useState(0);
  const [fx, setFx] = useState<{ id: number; frame: number }[]>([]);
  const [added, setAdded] = useState<number[]>([]);
  const fxId = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => { p.setToadBase(step.vessel === 'wok' ? 'wok1' : 'idle2'); }, []); // eslint-disable-line

  const vesselDrop = step.vessel === 'wok' ? 'wok' : step.vessel;

  useDrop((payload, dropId) => {
    if (payload.type !== 'ingredient' || dropId !== vesselDrop) return false;
    if (doneRef.current) return true;
    const id = payload.id as IngredientId;
      if (remaining.includes(id)) {
        const next = remaining.filter((r) => r !== id);
        setRemaining(next);
        setAdded((a) => [...a, ING[id]]);
        const fid = ++fxId.current;
        setFx((f) => [...f, { id: fid, frame: FX.splash }]);
        setTimeout(() => setFx((f) => f.filter((x) => x.id !== fid)), 1000);
        if (step.vessel === 'wok' && p.vis.wok === 'empty' && id !== 'oil') p.setVis({ wok: 'raw' });
        if (step.vessel === 'wok' && p.vis.wok === 'empty' && id === 'oil') p.setVis({ wok: 'empty' });
        if (step.vessel === 'wok' && id === 'chili') p.setVis({ wok: 'fried' });
        if (step.vessel === 'wok' && id === 'chunjang') p.setVis({ wok: 'jjajang' });
        if (step.vessel === 'wok' && p.vis.heat > 20) sfx.sizzle(); else sfx.pop();
        p.flashToad('wok2', 500);
      if (next.length === 0) {
        doneRef.current = true;
        setTimeout(() => p.onDone(Math.max(0.1, 1 - wrong * 0.25), { wasted: wrong }), 350);
      }
    } else {
      setWrong((w) => w + 1);
      p.addWaste(1);
      p.flashToad('panic', 900);
      p.toast(`${ING_NAME[id]}은(는) 지금 넣을 재료가 아니야!`, false);
      const fid = ++fxId.current;
      setFx((f) => [...f, { id: fid, frame: FX.angryBurst }]);
      setTimeout(() => setFx((f) => f.filter((x) => x.id !== fid)), 900);
    }
    return true;
  });

  const vesselView = () => {
    if (step.vessel === 'wok') return (
      <>
        <Stove x={STOVE.x} y={STOVE.y} size={STOVE.size} upgraded={p.save.upgrades.stove} />
        <WokView vis={p.vis.wok} heat={p.vis.heat} upgraded={p.save.upgrades.wok} dataDrop="wok" bits={p.vis.wok === 'raw' || p.vis.wok === 'empty' ? added : []} />
      </>
    );
    if (step.vessel === 'mixbowl') return (
      <div className="absolute" style={{ left: WOK.cx - 75, top: WOK.cy - 70, width: 150, height: 150 }} data-drop="mixbowl">
        <Sprite src={atlas.food} frame={FOOD.doughBowl} size={150} dataDrop="mixbowl" />
        <Bits items={added} cx={75} cy={70} r={20} size={34} />
      </div>
    );
    return (
      <>
        <Stove x={STOVE.x} y={STOVE.y} size={STOVE.size} upgraded={p.save.upgrades.stove} />
        <Flame heat={60} x={WOK.cx} y={BURNER_FLAME_Y} size={130} />
        <div className="absolute" style={{ left: WOK.cx - 65, top: WOK.cy - 70, width: 130, height: 130 }} data-drop="saucepot">
          <Sprite src={atlas.food} frame={FOOD.saucePot} size={130} dataDrop="saucepot" />
        </div>
      </>
    );
  };

  return (
    <>
      <Instruction text={step.label} sub={<span>남은 재료: {remaining.map((r) => ING_NAME[r]).join(', ') || '완료!'}</span>} />
      {vesselView()}
      <div className="absolute text-white font-black stroke-thin anim-pulse" style={{ left: WOK.cx - 60, top: WOK.cy + 62, width: 120, textAlign: 'center', fontSize: 12 }}>↑ 여기로 드래그</div>
      {fx.map((f) => <Burst key={f.id} frame={f.frame} x={WOK.cx} y={WOK.cy - 20} />)}
      {/* 이번 단계 필요 재료 (단계 안내 바로 아래 좌측) */}
      <div className="absolute flex items-center gap-1.5" style={{ left: 12, top: 82, zIndex: 4 }}>
        <div className="font-black stroke-thin text-yellow-200" style={{ fontSize: 10, marginRight: 2 }}>투입 재료:</div>
        {step.items.map((id) => (
          <Sprite key={id} src={atlas.ingredients} frame={bitOf(id)} size={34} style={{ opacity: remaining.includes(id) ? 1 : 0.3, filter: remaining.includes(id) ? 'drop-shadow(0 0 4px #ffd54a)' : 'grayscale(1)' }} />
        ))}
      </div>
    </>
  );
}

// ───────────────────────── 젓기/볶기/반죽 ─────────────────────────
export function StirStep(p: StepProps) {
  const step = p.step as Extract<StepProps['step'], { kind: 'stir' }>;
  const { atlas } = useAssets();
  const [progress, setProgress] = useState(0);
  const [burn, setBurn] = useState(0);
  const [tool, setTool] = useState({ x: 0, y: 0, on: false, ang: 30 });
  const s = useRef({ progress: 0, burn: 0, t: 0, lastMove: -9, lx: 0, ly: 0, hasLast: false, pending: false, lastSound: -9, lastPose: -9 });
  const finishTimer = useRef<number | null>(null);
  const touchActive = useRef(false);
  const ZW = 250, ZH = 230;

  useEffect(() => { p.setToadBase(step.vessel === 'wok' ? 'wok1' : 'chop1'); }, []); // eslint-disable-line
  useEffect(() => () => { if (finishTimer.current !== null) window.clearTimeout(finishTimer.current); }, []);

  useLoop((dt) => {
    const st = s.current;
    if (st.pending) return;
    st.t += dt;
    const idle = st.t - st.lastMove;
    if (idle > 0.6 && st.progress > 0) {
      st.progress = Math.max(0, st.progress - 7 * dt);
      setProgress(st.progress);
    }
    if (step.burn) {
      if (idle > 1.2 && st.progress > 4) {
        st.burn = Math.min(100, st.burn + 26 * dt);
        setBurn(st.burn);
      }
    }
    if (step.burn && st.burn >= 100) {
      st.pending = true;
      p.setVis({ wok: 'burnt' });
      p.flashToad('fail', 1500);
      sfx.burn();
      p.onDone(0.08, { burnt: true, msg: '태워버렸다...!' });
    }
  });

  const zoneRef = useRef<HTMLDivElement>(null);
  const track = (e: React.PointerEvent) => {
    const r = zoneRef.current?.getBoundingClientRect();
    if (!r) return;
    const sc = r.width / ZW;
    const x = (e.clientX - r.left) / sc, y = (e.clientY - r.top) / sc;
    const st = s.current;
    if (st.pending) return;
    let ang = 30;
    if (st.hasLast) {
      const mx = x - st.lx, my = y - st.ly;
      const len = Math.hypot(mx, my);
      // Only stirring inside the wok counts; crossing into the zone cannot fill the meter.
      const inside = Math.pow((x - ZW / 2) / 98, 2) + Math.pow((y - 120) / 88, 2) < 1;
      const wasInside = Math.pow((st.lx - ZW / 2) / 98, 2) + Math.pow((st.ly - 120) / 88, 2) < 1;
      if (inside && wasInside && len > 1.5 && len < 85) {
        st.lastMove = st.t;
        st.progress = Math.min(100, st.progress + (len / (step.needSec * 150)) * 100);
        setProgress(st.progress);
        if (st.t - st.lastSound > 0.16) { st.lastSound = st.t; sfx.stir(Math.min(1, len / 20)); }
        if (st.t - st.lastPose > 0.32) {
          st.lastPose = st.t;
          p.flashToad(Math.floor(st.t * 4) % 2 ? 'wok1' : 'wok2', 350);
        }
        if (st.burn > 0) { st.burn = Math.max(0, st.burn - len * 0.06); setBurn(st.burn); }
        if (st.progress >= 100) {
          st.pending = true;
          sfx.pop();
          p.flashToad('happy', 800);
          // Give the 100% bar a visible frame before advancing the recipe.
          finishTimer.current = window.setTimeout(() => {
            const score = Math.max(0.15, 1 - st.burn / 130);
            if (step.vessel === 'wok') p.setVis({ wok: p.recipe.id === 'jjajang' ? 'jjajang' : 'fried' });
            p.onDone(score, { msg: score > 0.8 ? '고르게 잘 볶였다!' : '조금 눌었지만 괜찮아' });
          }, 430);
        }
      }
      if (len > 1.2) ang = 20 + Math.max(-25, Math.min(25, mx * 1.8));
    }
    st.lx = x; st.ly = y; st.hasLast = true;
    setTool({ x, y, on: true, ang });
  };
  const leave = () => { s.current.hasLast = false; setTool((t) => ({ ...t, on: false })); };

  const vesselFrame = step.vessel === 'wok' ? (p.vis.wok === 'jjajang' ? FOOD.wokJjajang : p.vis.wok === 'raw' ? FOOD.wokRaw : FOOD.wokFried) : step.vessel === 'mixbowl' ? FOOD.doughBowl : FOOD.saucePot;
  const isHot = step.vessel !== 'mixbowl';
  const stirring = s.current.t - s.current.lastMove < 0.2;
  const wob = stirring ? Math.sin(s.current.t * 16) * 3 : 0;

  return (
    <>
      <Instruction text={step.label} sub={step.burn ? (burn > 20 ? `탄 정도 ${Math.round(burn)}% · 빨리 휘저어!` : '웍 안을 휘저어라 · 멈추면 타고 게이지가 내려간다') : '반죽 위를 빙글빙글 문질러라'} />
      {isHot && <Stove x={STOVE.x} y={STOVE.y} size={STOVE.size} upgraded={p.save.upgrades.stove} />}
      {isHot && <Flame heat={Math.max(45, p.vis.heat)} x={WOK.cx} y={BURNER_FLAME_Y} size={130} />}
      <div
        ref={zoneRef}
        className="absolute"
        style={{ left: WOK.cx - ZW / 2, top: WOK.cy - 120, width: ZW, height: ZH, touchAction: 'none', cursor: 'none' }}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') track(e); }}
        onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); touchActive.current = true; s.current.hasLast = false; track(e); }}
        onPointerMove={(e) => { if (e.pointerType === 'mouse' || touchActive.current) track(e); }}
        onPointerUp={(e) => { touchActive.current = false; if (e.pointerType !== 'mouse') leave(); }}
        onPointerCancel={() => { touchActive.current = false; leave(); }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse' || !touchActive.current) leave(); }}
      >
        <Sprite src={atlas.food} frame={vesselFrame} size={160} className="absolute pointer-events-none" style={{ left: ZW / 2 - 80, top: 40, filter: `brightness(${1 - burn / 250}) ${stirring ? 'saturate(1.15)' : ''}`, transform: `rotate(${wob}deg)` }} />
        {burn > 30 && <Steam x={ZW / 2} y={100} count={2} dark />}
        {isHot && burn <= 30 && progress > 10 && <Steam x={ZW / 2} y={100} count={stirring ? 2 : 1} />}
        {tool.on && (
          <Sprite src={atlas.ui} frame={UI.ladle} size={70} className="absolute pointer-events-none" style={{ left: tool.x - 20, top: tool.y - 60, transform: `rotate(${tool.ang}deg)`, filter: 'drop-shadow(0 3px 2px rgba(0,0,0,0.4))' }} />
        )}
      </div>
      <Gauge x={GAUGE_X} y={GAUGE_Y} w={150} value={progress} label={`${step.vessel === 'mixbowl' ? '반죽' : '볶음'} ${Math.round(progress)}%`} color="#f4c542" />
      {!tool.on && <div className="absolute text-white font-black stroke-thin anim-pulse pointer-events-none" style={{ left: WOK.cx - 80, top: WOK.cy + 70, width: 160, textAlign: 'center', fontSize: 12 }}>웍 위를 빙글빙글 휘저어라</div>}
    </>
  );
}

// ───────────────────────── 웍 흔들기 (Swipe + 플립) ─────────────────────────
export function ShakeStep(p: StepProps) {
  const step = p.step as Extract<StepProps['step'], { kind: 'shake' }>;
  const { atlas } = useAssets();
  const [count, setCount] = useState(0);
  const [flip, setFlip] = useState(0);
  const [lost, setLost] = useState(0);
  const [fx, setFx] = useState<number[]>([]);
  const s = useRef({ count: 0, lastT: 0, rhythmGood: 0, rhythmBad: 0, lost: 0, done: false });
  const wokUp = p.save.upgrades.wok;
  const wildAmp = wokUp ? 150 : 115;
  const bits = p.recipe.ingredients.filter((i) => !['oil', 'broth', 'noodle', 'chili'].includes(i)).slice(0, 5).map((i) => ING[i]);

  useEffect(() => { p.setToadBase('wok1'); }, []); // eslint-disable-line

  const { handlers, dx } = useSwipe({
    minAmp: 30,
    onStroke: (_dir, amp) => {
      const st = s.current;
      if (st.done) return;
      const now = performance.now() / 1000;
      const gap = now - st.lastT;
      st.lastT = now;
      if (gap > 0.18 && gap < 0.8) st.rhythmGood++; else if (st.count > 0) st.rhythmBad++;
      if (amp > wildAmp) {
        st.lost++;
        setLost(st.lost);
        p.addWaste(1);
        p.toast('너무 세게! 재료가 튀어나갔다', false);
        p.flashToad('panic', 600);
        sfx.angry();
      }
      st.count++;
      setCount(st.count);
      sfx.flip();
      p.flashToad(st.count % 2 ? 'wok1' : 'wok2', 300);
      if (st.count % 3 === 0) {
        setFlip((f) => f + 1);
        p.flashToad('flip', 700);
        setFx((f) => [...f, Date.now()]);
        setTimeout(() => setFx((f) => f.slice(1)), 900);
      }
      if (st.count >= step.count) {
        st.done = true;
        const rhythm = st.rhythmGood / Math.max(1, st.rhythmGood + st.rhythmBad);
        const score = Math.max(0.15, 0.55 + rhythm * 0.45 - st.lost * 0.12);
        p.setVis({ wok: 'fried' });
        setTimeout(() => p.onDone(score, { msg: score > 0.85 ? '완벽한 불맛!' : '불맛이 배었다' }), 500);
      }
    },
  });

  const flipping = fx.length > 0;

  return (
    <>
      <Instruction text={step.label} sub={`흔들기 ${count}/${step.count}  ${lost ? `· 손실 ${lost}` : ''}`} />
      <Stove x={STOVE.x} y={STOVE.y} size={STOVE.size} upgraded={p.save.upgrades.stove} />
      <div className="absolute" onPointerDown={handlers.onPointerDown} onPointerMove={handlers.onPointerMove} onPointerUp={handlers.onPointerUp} onPointerCancel={handlers.onPointerCancel} style={{ left: WOK.cx - 110, top: WOK.cy - 110, width: 220, height: 220, ...handlers.style }}>
        <div className="absolute inset-0 pointer-events-none">
          <div style={{ position: 'relative', left: 110 - WOK.cx, top: 110 - WOK.cy, width: 360, height: 300 }}>
            <WokView vis={p.vis.wok === 'empty' ? 'raw' : p.vis.wok} heat={Math.max(60, p.vis.heat)} dx={dx} rot={dx * 0.15} upgraded={wokUp} lift={flipping ? 8 : 0} />
            {/* 플립 시 재료가 공중으로 튀는 연출 */}
            {flipping && bits.map((b, i) => (
              <Sprite key={flip + '-' + i} src={atlas.ingredients} frame={b} size={30} className="absolute" style={{ left: WOK.cx - 15 + (i - 2) * 22 + dx, top: WOK.cy - 30, animation: 'flipArc 0.8s ease-out forwards', animationDelay: `${i * 0.04}s` }} />
            ))}
            {flipping && <Burst frame={FX.sparkle} x={WOK.cx} y={WOK.cy - 60} size={90} />}
          </div>
        </div>
      </div>
      <style>{`@keyframes flipArc { 0% { transform: translateY(0) rotate(0); opacity: 1 } 50% { transform: translateY(-80px) rotate(180deg); opacity: 1 } 100% { transform: translateY(0) rotate(360deg); opacity: 0 } }`}</style>
      <div className="absolute text-white font-black stroke-thin anim-pulse" style={{ left: WOK.cx - 80, top: WOK.cy + 66, width: 160, textAlign: 'center', fontSize: 12 }}>← 웍을 좌우로 흔들어라 →</div>
      <Gauge x={GAUGE_X} y={GAUGE_Y} w={150} value={(count / step.count) * 100} label="불맛" color="#ff5e2b" />
    </>
  );
}

// ───────────────────────── 붓기 (Hold, 마스크로 차오름) ─────────────────────────
export function PourStep(p: StepProps) {
  const step = p.step as Extract<StepProps['step'], { kind: 'pour' }>;
  const { atlas } = useAssets();
  const [fill, setFill] = useState(0);
  const [holding, setHolding] = useState(false);
  const s = useRef({ fill: 0, hold: false, was: false, done: false });

  useEffect(() => { p.setToadBase(step.vessel === 'wok' ? 'fire' : 'noodle'); }, []); // eslint-disable-line

  useLoop((dt) => {
    const st = s.current;
    if (st.done) return;
        if (st.hold) {
          if (st.fill === 0) sfx.pour();
          st.fill = Math.min(100, st.fill + 32 * dt); st.was = true;
        }
        setFill(st.fill);
        p.setVis({ soupPct: st.fill });
    const [lo, hi] = step.target;
    if (st.fill >= 100 || (st.was && !st.hold && st.fill > hi)) {
      st.done = true;
      p.addWaste(1);
      p.flashToad('panic', 1200);
      if (step.vessel === 'wok') p.setVis({ wok: step.item === 'broth' && p.recipe.id !== 'jjajang' ? 'soup' : 'jjajang' });
      else p.setVis({ bowl: 'soup' });
      p.onDone(0.3, { msg: '넘쳤다! 너무 많이 부었어' });
      return;
    }
    if (st.was && !st.hold) {
      st.was = false;
      if (st.fill >= lo && st.fill <= hi) {
        st.done = true;
        const c = (lo + hi) / 2, half = (hi - lo) / 2;
        const score = Math.max(0.5, 1 - (Math.abs(st.fill - c) / half) * 0.45);
        if (step.vessel === 'wok') p.setVis({ wok: p.recipe.id === 'jjajang' ? 'jjajang' : 'soup' });
        else p.setVis({ bowl: 'soup' });
        p.flashToad('happy', 700);
        p.onDone(score, { msg: '딱 좋아!' });
      } else if (st.fill < lo) {
        p.toast('아직 부족해. 더 부어라', false);
      }
    }
  });

  const setHold = (v: boolean) => { s.current.hold = v; setHolding(v); };
  const isWok = step.vessel === 'wok';
  const baseFrame = isWok ? (p.vis.wok === 'jjajang' ? FOOD.wokJjajang : FOOD.wokFried) : FOOD.noodleBowl;
  const targetFrame = isWok ? (p.recipe.id === 'jjajang' ? FOOD.wokJjajang : FOOD.wokSoup) : p.recipe.foodFrame;
  const pourFrame = step.item === 'broth' ? ING.broth : step.item === 'jjajang' ? FOOD.wokJjajang : FOOD.saucePot;
  const pourAtlas = step.item === 'broth' ? atlas.ingredients : atlas.food;
  const size = 150;
  const cx = WOK.cx, cy = WOK.cy;

  return (
    <>
      <Instruction text={step.label} sub={`적정 ${step.target[0]}~${step.target[1]}% 에서 손을 떼라`} />
      {isWok && <Stove x={STOVE.x} y={STOVE.y} size={STOVE.size} upgraded={p.save.upgrades.stove} />}
      {isWok && <Flame heat={Math.max(50, p.vis.heat)} x={cx} y={BURNER_FLAME_Y} size={130} />}
      <div className="absolute" style={{ left: cx - size / 2, top: cy - size / 2, width: size, height: size }}>
        <FoodFill baseFrame={baseFrame} filledFrame={targetFrame} fill={fill} size={size} />
        {holding && <Steam x={size / 2} y={size / 2 - 10} count={2} />}
      </div>
      {/* 붓는 도구 (Hold) */}
      <div
        className="absolute flex flex-col items-center"
        style={{ left: 60, top: 96, touchAction: 'none' }}
        onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); setHold(true); }}
        onPointerUp={() => setHold(false)}
        onPointerCancel={() => setHold(false)}
      >
        <Sprite src={pourAtlas} frame={pourFrame} size={90} style={{ transform: holding ? 'rotate(35deg) translate(20px,-10px)' : 'rotate(0)', transition: 'transform 0.15s', filter: holding ? 'brightness(1.1)' : undefined }} />
        <Sprite src={atlas.ui} frame={UI.ladle} size={54} style={{ marginTop: -30, transform: holding ? 'rotate(-40deg)' : 'rotate(0)', transition: 'transform 0.15s' }} />
        <div className="text-white font-black stroke-thin" style={{ fontSize: 11 }}>{holding ? '붓는 중...' : '꾹 눌러 붓기'}</div>
      </div>
      {holding && <Burst frame={FX.splash} x={cx - 30} y={cy - 40} size={60} />}
      <Gauge x={GAUGE_X} y={GAUGE_Y} w={150} value={fill} target={step.target} label={step.item === 'broth' ? '육수 양' : '소스 양'} color="#e8a33a" />
    </>
  );
}

// ───────────────────────── 불 유지 (Hold, 시간) ─────────────────────────
export function FireStep(p: StepProps) {
  const step = p.step as Extract<StepProps['step'], { kind: 'fire' }>;
  const [heat, setHeat] = useState(p.vis.heat);
  const [prog, setProg] = useState(0);
  const [holding, setHolding] = useState(false);
  const s = useRef({ heat: p.vis.heat, hold: false, t: 0, inZone: 0, over: 0, done: false });
  const stoveUp = p.save.upgrades.stove;
  const target: [number, number] = stoveUp ? [step.target[0] - 5, Math.min(100, step.target[1] + 5)] : step.target;

  useEffect(() => { p.setToadBase('fire'); }, []); // eslint-disable-line

  useLoop((dt) => {
    const st = s.current;
    if (st.done) return;
    if (st.hold) st.heat += (stoveUp ? 38 : 30) * dt; else st.heat -= 16 * dt;
    st.heat = Math.max(0, Math.min(100, st.heat));
    st.t += dt;
    if (st.heat >= target[0] && st.heat <= target[1]) st.inZone += dt;
    if (st.heat > 94) st.over += dt;
    setHeat(st.heat); setProg((st.t / step.duration) * 100);
    p.setVis({ heat: st.heat });
    if (st.over > 2.2) {
      st.done = true;
      p.setVis({ wok: 'burnt' });
      p.flashToad('fail', 1500);
      p.onDone(0.1, { burnt: true, msg: '과열로 국물이 졸아붙었다!' });
      return;
    }
    if (st.t >= step.duration) {
      st.done = true;
      const ratio = st.inZone / step.duration;
      const score = Math.max(0.15, 0.2 + ratio * 0.8);
      p.flashToad(score > 0.7 ? 'happy' : 'panic', 800);
      p.onDone(score, { msg: score > 0.85 ? '국물이 깊게 우러났다!' : score > 0.5 ? '그럭저럭 끓었다' : '불 조절이 엉망이었다' });
    }
  });

  const setHold = (v: boolean) => { s.current.hold = v; setHolding(v); };

  return (
    <>
      <Instruction text={step.label} sub={`초록 구간 유지 ${Math.round(s.current.inZone * 10) / 10}s / ${step.duration}s`} />
      <Stove x={STOVE.x} y={STOVE.y} size={STOVE.size} upgraded={stoveUp} />
      <WokView vis={p.vis.wok} heat={heat} upgraded={p.save.upgrades.wok} />
      {heat > 92 && <Steam x={WOK.cx} y={WOK.cy - 20} count={2} dark />}
      {/* 안내/단계 메시지 영역(top 0~130)과 겹치지 않도록 두 게이지를 하단에 정렬 */}
      <Gauge x={20} y={GAUGE_TOP_Y} w={120} value={prog} label="우러내기" color="#5aa9ff" />
      <Gauge x={180} y={GAUGE_Y} w={150} value={heat} target={target} label="불 세기" />
      <Knob x={KNOB_X} y={KNOB_Y} heat={heat} holding={holding} setHolding={setHold} onDown={() => sfx.click()} />
    </>
  );
}

// ───────────────────────── 옮겨 담기 (Drag) ─────────────────────────
export function TransferStep(p: StepProps) {
  const step = p.step as Extract<StepProps['step'], { kind: 'transfer' }>;
  const { atlas } = useAssets();
  const { startDrag, dragging } = useDrag();
  const [poured, setPoured] = useState(false);
  const [fill, setFill] = useState(0);
  const misses = useRef(0);
  const pourTimer = useRef<number | null>(null);
  const finishTimer = useRef<number | null>(null);
  const started = useRef(false);

  useEffect(() => { p.setToadBase('carry'); }, []); // eslint-disable-line
  useEffect(() => () => {
    if (pourTimer.current !== null) window.clearInterval(pourTimer.current);
    if (finishTimer.current !== null) window.clearTimeout(finishTimer.current);
  }, []);

  const srcFrame = step.from === 'wok' ? (p.vis.wok === 'burnt' ? FOOD.wokBurnt : p.recipe.id === 'jjajang' ? FOOD.wokJjajang : FOOD.wokSoup) : step.from === 'fryer' ? FOOD.friedChunks : FOOD.saucePot;
  const dstFrame = step.to === 'bowl' ? FOOD.noodleBowl : step.to === 'plate' ? FOOD.emptyPlate : FOOD.saucePot;
  const finalFrame = step.to === 'bowl' ? p.recipe.foodFrame : FOOD.tangsuyuk;

  useDrop((payload, dropId) => {
    if (payload.type !== 'transfer') return false;
    if (started.current) return true;
    if (dropId === 'transfer-target') {
      started.current = true;
      setPoured(true);
      p.flashToad('serve', 1200);
      sfx.pour();
      let f = 0;
      pourTimer.current = window.setInterval(() => {
        f = Math.min(100, f + 6);
        setFill(f);
        p.setVis({ soupPct: f });
        if (f === 100) {
          if (pourTimer.current !== null) window.clearInterval(pourTimer.current);
          pourTimer.current = null;
          if (step.to === 'bowl') p.setVis({ bowl: 'soup' });
          if (step.to === 'plate') p.setVis({ fried: 'sauced' });
          sfx.pop();
          // Paint the fully replaced bowl before moving to the garnish step.
          finishTimer.current = window.setTimeout(() => {
            p.onDone(Math.max(0.4, 1 - misses.current * 0.2), { msg: '정성껏 담았다' });
          }, 250);
        }
      }, 60);
    } else {
      misses.current++;
      p.addWaste(1);
      p.flashToad('panic', 800);
      p.toast('흘렸다! 정확히 그릇 위에 놓아라', false);
    }
    return true;
  });

  const isDragging = dragging?.type === 'transfer';
  const srcAtlas = atlas.food;

  return (
    <>
      <Instruction text={step.label} sub={poured ? '담는 중...' : '왼쪽을 잡아 오른쪽 그릇 위로 끌어다 놓아라'} />
      {/* 출발 */}
      {!poured && (
        <div className="absolute" style={{ left: 40, top: 80, touchAction: 'none', opacity: isDragging ? 0.3 : 1 }}
          onPointerDown={(e) => startDrag(e, { type: 'transfer', atlas: 'food', frame: srcFrame, size: 130 })}>
          <Sprite src={srcAtlas} frame={srcFrame} size={140} className="anim-wobble" style={{ filter: 'drop-shadow(0 6px 4px rgba(0,0,0,0.4))' }} />
          <div className="text-white font-black stroke-thin text-center" style={{ fontSize: 11, marginTop: -8 }}>잡아서 끌기</div>
        </div>
      )}
      {/* 도착 */}
      <div className="absolute" style={{ left: 200, top: 84, width: 150, height: 150, filter: isDragging ? 'drop-shadow(0 0 10px #ffe56a)' : undefined }} data-drop="transfer-target">
        <FoodFill baseFrame={dstFrame} filledFrame={finalFrame} fill={poured ? fill : 0} size={150} />
        {poured && fill > 20 && <Steam x={75} y={60} count={2} />}
        {poured && fill > 90 && <Burst frame={FX.sparkle} x={75} y={40} />}
      </div>
    </>
  );
}
