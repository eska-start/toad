import { useEffect, useRef, useState } from 'react';
import { Sprite } from '../../Sprite';
import { useAssets } from '../../../game/AssetContext';
import { EQUIP, FOOD, FX, ING, ING_NAME, IngredientId } from '../../../game/atlas';
import { useDrag, useDrop } from '../../../game/drag';
import { Burst, Flame, Gauge, Instruction, Knob, Steam, StepProps, Stove, useLoop, useSwipe } from './common';
import { BURNER_FLAME_Y, GAUGE_TOP_Y, GAUGE_X, GAUGE_Y, STOVE, WOK } from './WokSteps';
import { sfx } from '../../../game/sfx';

// ───────────────────────── 칼질 (Swipe) ─────────────────────────
export function ChopStep(p: StepProps) {
  const step = p.step as Extract<StepProps['step'], { kind: 'chop' }>;
  const { atlas } = useAssets();
  const knifeUp = p.save.upgrades.knife;
  const need = Math.max(3, step.count - (knifeUp ? 2 : 0));
  const [count, setCount] = useState(0);
  const [knife, setKnife] = useState({ x: 90, y: 40, on: false, down: false });
  const s = useRef({ count: 0, miss: 0, start: performance.now(), done: false });

  useEffect(() => { p.setToadBase('chop1'); }, []); // eslint-disable-line

  const zoneRef = useRef<HTMLDivElement>(null);
  const { handlers } = useSwipe({
    minAmp: 40,
    onStroke: (_d, amp) => {
      const st = s.current;
      if (st.done) return;
      if (amp < 55) { st.miss++; return; }
      st.count++;
      setCount(st.count);
      setKnife((k) => ({ ...k, down: true }));
      sfx.chop();
      setTimeout(() => setKnife((k) => ({ ...k, down: false })), 120);
      p.flashToad(st.count % 2 ? 'chop2' : 'chop1', 220);
      if (st.count >= need) {
        st.done = true;
        const secs = (performance.now() - st.start) / 1000;
        const score = Math.max(0.4, 1 - st.miss * 0.06 - (secs > 14 ? 0.15 : 0));
        p.flashToad('happy', 700);
        sfx.pop();
        setTimeout(() => p.onDone(score, { msg: '깔끔하게 손질했다!' }), 350);
      }
    },
  });

  const move = (e: React.PointerEvent) => {
    const r = zoneRef.current?.getBoundingClientRect();
    if (!r) return;
    const sc = r.width / 240;
    setKnife((k) => ({ ...k, x: (e.clientX - r.left) / sc, y: (e.clientY - r.top) / sc, on: true }));
  };

  const prog = Math.min(1, count / need);
  const pieces = 1 + Math.floor(prog * 4);

  return (
    <>
      <Instruction text={step.label} sub={`칼질 ${count}/${need} · ${ING_NAME[step.item]}`} />
      <div
        ref={zoneRef}
        className="absolute"
        style={{ left: WOK.cx - 120, top: 70, width: 240, height: 200, ...handlers.style }}
        onPointerDown={(e) => { handlers.onPointerDown(e); move(e); }}
        onPointerMove={(e) => { handlers.onPointerMove(e); move(e); }}
        onPointerUp={() => { handlers.onPointerUp(); setKnife((k) => ({ ...k, on: false })); }}
        onPointerCancel={() => { handlers.onPointerUp(); setKnife((k) => ({ ...k, on: false })); }}
      >
        <Sprite src={atlas.equipment} frame={EQUIP.board} size={220} className="absolute pointer-events-none" style={{ left: 10, top: 0 }} />
        {/* 재료: 칼질 진행에 따라 조각으로 나뉨 */}
        <div className="absolute pointer-events-none" style={{ left: 60, top: 55, width: 120, height: 100 }}>
          {Array.from({ length: pieces }).map((_, i) => (
            <Sprite key={i} src={atlas.ingredients} frame={ING[step.item]} size={100} className="absolute" style={{ left: 10, top: 0, clipPath: pieces === 1 ? undefined : `inset(0 ${100 - ((i + 1) * 100) / pieces}% 0 ${(i * 100) / pieces}%)`, transform: pieces === 1 ? undefined : `translate(${(i - (pieces - 1) / 2) * 9}px, ${(i % 2) * 5}px) rotate(${(i - (pieces - 1) / 2) * 5}deg)` }} />
          ))}
        </div>
        {knife.on && (
          <Sprite src={atlas.equipment} frame={knifeUp ? EQUIP.knifeNew : EQUIP.knifeOld} size={110} className="absolute pointer-events-none" style={{ left: knife.x - 30, top: knife.y - 90 + (knife.down ? 14 : 0), transform: 'rotate(-70deg)', transition: 'top 0.06s', filter: 'drop-shadow(0 4px 3px rgba(0,0,0,0.4))' }} />
        )}
        {knife.down && <Burst frame={FX.sparkle} x={knife.x} y={knife.y} size={50} />}
      </div>
      <Gauge x={20} y={GAUGE_TOP_Y} w={120} value={prog * 100} label="손질" color="#7cc24d" />
      <div className="absolute text-white font-black stroke-thin anim-pulse pointer-events-none" style={{ left: WOK.cx - 100, top: 262, width: 200, textAlign: 'center', fontSize: 12 }}>← 도마 위를 좌우로 쓸어 썰어라 →</div>
    </>
  );
}

// ───────────────────────── 반죽 모양내기 (Drag) ─────────────────────────
export function ShapeStep(p: StepProps) {
  const step = p.step as Extract<StepProps['step'], { kind: 'shape' }>;
  const { atlas } = useAssets();
  const { startDrag, dragging } = useDrag();
  const pieces = step.pieces ?? Array(step.count).fill('sweetpotato') as IngredientId[];
  const [filled, setFilled] = useState<(IngredientId | null)[]>(Array(step.count).fill(null));
  const miss = useRef(0);
  const finished = useRef(false);

  useEffect(() => { p.setToadBase('chop1'); }, []); // eslint-disable-line

  const slots = [{ x: 30, y: 30 }, { x: 78, y: 22 }, { x: 54, y: 62 }, { x: 22, y: 78 }, { x: 88, y: 70 }];

  useDrop((payload, dropId) => {
    if (payload.type !== 'dough') return false;
    if (finished.current) return true;
    if (dropId?.startsWith('fslot-')) {
      const i = Number(dropId.split('-')[1]);
      if (filled[i]) { p.toast('이미 올렸다', false); return true; }
      const ingredient = payload.id as IngredientId;
      const required = pieces.filter((id) => id === ingredient).length;
      const alreadyPlaced = filled.filter((id) => id === ingredient).length;
      if (required === 0 || alreadyPlaced >= required) {
        p.toast(ingredient === 'pork' ? '돼지고기 조각은 3개면 충분해!' : '고구마채는 2개만 올려라!', false);
        return true;
      }
      const next = [...filled]; next[i] = ingredient; setFilled(next);
      p.flashToad('chop2', 300);
      sfx.pop();
      if (next.every((piece) => piece !== null)) {
        finished.current = true;
        p.setVis({ fried: 'raw' });
        p.flashToad('happy', 700);
        setTimeout(() => p.onDone(Math.max(0.4, 1 - miss.current * 0.1), { msg: '돼지고기 3개와 고구마채 2개를 담았다!' }), 350);
      }
    } else {
      miss.current++;
      p.addWaste(1);
      p.toast('바닥에 떨어뜨렸다!', false);
      p.flashToad('panic', 600);
    }
    return true;
  });

  const isDragging = dragging?.type === 'dough';
  const remainingPork = pieces.filter((id) => id === 'pork').length - filled.filter((id) => id === 'pork').length;
  const remainingSweetpotato = pieces.filter((id) => id === 'sweetpotato').length - filled.filter((id) => id === 'sweetpotato').length;
  const remaining = filled.filter((piece) => piece === null).length;

  return (
    <>
      <Instruction text={step.label} sub={`남은 조각 ${remaining}개 · 돼지고기 ${remainingPork}/3 · 고구마채 ${remainingSweetpotato}/2`} />
      {/* 튀김 재료 선택 접시(반죽 볼) */}
      <div className="absolute" style={{ left: 16, top: 88, width: 154, height: 154 }}>
        <Sprite src={atlas.food} frame={FOOD.doughBowl} size={154} />
        {/* 접시 안쪽에 튀김 재료(돼지고기, 고구마) 배치 */}
        <div className="absolute inset-0 flex items-center justify-center gap-2" style={{ paddingBottom: 16 }}>
          {(['pork', 'sweetpotato'] as IngredientId[]).map((id) => {
            const left = id === 'pork' ? remainingPork : remainingSweetpotato;
            return (
              <div
                key={id}
                className="flex flex-col items-center select-none"
                style={{
                  width: 58,
                  touchAction: 'none',
                  cursor: left > 0 ? 'grab' : 'default',
                  opacity: left > 0 ? (isDragging ? 0.75 : 1) : 0.3,
                  filter: left > 0 ? 'drop-shadow(0 3px 3px rgba(0,0,0,0.45))' : 'grayscale(1)',
                }}
                onPointerDown={(e) => {
                  if (left > 0) startDrag(e, { type: 'dough', id, atlas: 'ingredients', frame: ING[id], size: 48 });
                }}
              >
                <Sprite src={atlas.ingredients} frame={ING[id]} size={42} className={left > 0 ? 'anim-bob' : ''} />
                <div className="font-black text-white stroke-thin text-center" style={{ fontSize: 9.5, marginTop: -2, whiteSpace: 'nowrap' }}>
                  {id === 'pork' ? `돼지 (${remainingPork})` : `고구마 (${remainingSweetpotato})`}
                </div>
              </div>
            );
          })}
        </div>
        <div className="absolute w-full text-center text-white font-black stroke-thin pointer-events-none" style={{ bottom: 12, fontSize: 10 }}>
          접시 안의 재료를 끌기
        </div>
      </div>
      {/* 튀김망 */}
      <div className="absolute" style={{ left: 190, top: 76, width: 150, height: 150 }}>
        <Sprite src={atlas.equipment} frame={EQUIP.fryer} size={150} />
        {slots.slice(0, step.count).map((sl, i) => (
          <div key={i} data-drop={`fslot-${i}`} className="absolute" style={{ left: sl.x, top: sl.y, width: 40, height: 40, borderRadius: 20, border: filled[i] ? 'none' : '2px dashed rgba(255,255,255,0.85)', background: filled[i] ? 'transparent' : 'rgba(255,255,255,0.15)', boxShadow: isDragging && !filled[i] ? '0 0 10px #ffe56a' : undefined }}>
            {filled[i] && <Sprite src={atlas.ingredients} frame={ING[filled[i]!]} size={40} className="anim-pop" style={{ filter: filled[i] === 'sweetpotato' ? 'sepia(0.5) brightness(1.15)' : undefined, pointerEvents: 'none' }} />}
          </div>
        ))}
      </div>
    </>
  );
}

// ───────────────────────── 튀기기 (Hold 온도 + Drag 건지기) ─────────────────────────
export function FryStep(p: StepProps) {
  const step = p.step as Extract<StepProps['step'], { kind: 'fry' }>;
  const { atlas } = useAssets();
  const { startDrag, dragging } = useDrag();
  const [temp, setTemp] = useState(30);
  const [done, setDone] = useState(0);
  const [holding, setHolding] = useState(false);
  const s = useRef({ temp: 30, hold: false, done: 0, burn: 0, soggy: 0, finished: false, sizzleT: 0 });
  const stoveUp = p.save.upgrades.stove;
  const target: [number, number] = stoveUp ? [step.target[0] - 5, Math.min(100, step.target[1] + 5)] : step.target;

  useEffect(() => { p.setToadBase('fire'); }, []); // eslint-disable-line

  useLoop((dt) => {
    const st = s.current;
    if (st.finished) return;
    if (st.hold) st.temp += 30 * dt; else st.temp -= 14 * dt;
    st.temp = Math.max(0, Math.min(100, st.temp));
    const rate = (st.temp / 70) * (100 / step.needSec);
    st.done = Math.min(140, st.done + rate * dt);
    // 튀김 소리
    st.sizzleT += dt;
    if (st.temp > 40 && st.sizzleT > 0.25) { st.sizzleT = 0; sfx.sizzle(); }
    if (st.temp > target[1]) st.burn += dt * (st.temp - target[1]) / 20;
    if (st.temp < target[0] && st.done > 10) st.soggy += dt * 0.5;
    setTemp(st.temp); setDone(st.done);
    if (st.done >= 140 || st.burn > 4) {
      st.finished = true;
      p.setVis({ fried: 'done' });
      p.flashToad('fail', 1500);
      p.onDone(0.1, { burnt: true, msg: '새까맣게 타버렸다!' });
    }
  });

  useDrop((payload, dropId) => {
    if (payload.type !== 'basket') return false;
    const st = s.current;
    if (st.finished) return true;
    if (dropId !== 'fry-plate') { p.toast('접시 위에 놓아라!', false); return true; }
    st.finished = true;
    const d = st.done;
    let base: number; let msg: string;
    if (d < 60) { base = Math.max(0.15, d / 100); msg = '덜 익어 눅눅하다'; }
    else if (d > 115) { base = Math.max(0.15, 1 - (d - 115) / 30); msg = '너무 오래 튀겼다'; }
    else { base = 1 - Math.abs(d - 90) / 90; msg = '바삭하게 잘 튀겨졌다!'; }
    const score = Math.max(0.1, base - Math.min(0.4, st.burn * 0.12) - Math.min(0.3, st.soggy * 0.1));
    p.setVis({ fried: 'done' });
    p.flashToad(score > 0.6 ? 'happy' : 'panic', 800);
    p.onDone(score, { msg: score > 0.6 ? msg : (st.soggy > 1.5 ? '온도가 낮아 눅눅해졌다' : msg) });
    return true;
  });

  const setHold = (v: boolean) => { s.current.hold = v; setHolding(v); };
  const isDragging = dragging?.type === 'basket';
  const readiness = done < 60 ? '덜 익음 (뽀얀 튀김옷)' : done <= 115 ? '노릇노릇 바삭! 지금 건져라!' : '타고 있다!';
  
  // 색상 필터 계산:
  // 1) 안 익었을 때 (done < 60): 튀김옷이 안 익어 새하얗고 뽀얀 상태 (brightness 상승, 채도 낮춤)
  // 2) 잘 익었을 때 (60 <= done <= 115): 본래의 노릇노릇하고 먹음직스러운 황금빛 튀김 색 (원색 100%)
  // 3) 탈 때 (done > 115): 새까맣게 타들어감 (brightness 대폭 하락, 검정색으로 변색)
  const friedFilter = (() => {
    if (done < 60) {
      // 0 -> done: 60 으로 갈수록 뽀얀 흰색에서 본래 노릇한 황금색으로 점진적 변화
      const rawFactor = 1 - (done / 60); // 1 -> 0
      const b = 1 + rawFactor * 0.45; // 1.45 -> 1.0 (밝고 뽀얗게)
      const s = 1 - rawFactor * 0.6; // 0.4 -> 1.0 (채도 낮춤)
      return `brightness(${b}) saturate(${s}) contrast(0.95)`;
    } else if (done <= 115) {
      // 황금빛 바삭한 보통 색상 그대로 유지
      return 'brightness(1.05) saturate(1.1)';
    } else {
      // 115 넘어서 탈 때: 급격히 검정색으로 탄화
      const burnProg = Math.min(1, (done - 115) / 25); // 0 -> 1
      const b = Math.max(0.15, 1.05 - burnProg * 0.85); // 1.05 -> 0.2 (새까만 검정)
      const c = 1 + burnProg * 0.6;
      return `brightness(${b}) contrast(${c}) grayscale(${burnProg * 0.85})`;
    }
  })();

  return (
    <>
      <Instruction text={step.label} sub={`${readiness} · 온도 ${target[0]}~${target[1]} 유지`} />
      <Stove x={STOVE.x} y={STOVE.y} size={STOVE.size} upgraded={stoveUp} />
      <Flame heat={temp} x={WOK.cx} y={BURNER_FLAME_Y} size={130} />
      <div className="absolute" style={{ left: WOK.cx - 75, top: WOK.cy - 75, width: 150, height: 150 }}>
        {!isDragging && !s.current.finished && (
          <div style={{ touchAction: 'none' }} onPointerDown={(e) => startDrag(e, { type: 'basket', atlas: 'equipment', frame: EQUIP.fryer, size: 110 })}>
            <Sprite src={atlas.equipment} frame={EQUIP.fryer} size={150} style={{ filter: 'drop-shadow(0 4px 3px rgba(0,0,0,0.4))' }} />
            {/* 튀김옷 외곽선 그대로, 색상: 안익었을 때(흰색) -> 잘익었을 때(황금색) -> 탈 때(검정색) */}
            <Sprite src={atlas.food} frame={FOOD.friedChunks} size={90} className="absolute pointer-events-none" style={{ left: 30, top: 24, filter: friedFilter, transition: 'filter 0.1s linear' }} />
          </div>
        )}
        {temp > 30 && <Steam x={75} y={40} count={2} dark={done > 115} />}
        {temp > 50 && <Burst frame={FX.splash} x={75 + (Math.random() * 40 - 20)} y={50} size={40} />}
      </div>
      {/* 접시: 단계 진행 표시(top 56~82) 아래 */}
      <div className="absolute" style={{ left: 8, top: 88, width: 90, height: 90 }} data-drop="fry-plate">
        <Sprite src={atlas.food} frame={FOOD.emptyPlate} size={90} dataDrop="fry-plate" style={{ filter: isDragging ? 'drop-shadow(0 0 10px #ffe56a)' : undefined }} />
        <div className="absolute w-full text-center text-white font-black stroke-thin pointer-events-none" style={{ top: 72, fontSize: 10, whiteSpace: 'nowrap' }}>튀김망 끌어 건지기</div>
      </div>
      {/* 게이지 2개는 오른쪽 하단에 세로로 쌓아 노브 라벨과 겹치지 않게 */}
      <Gauge x={GAUGE_X} y={GAUGE_Y - 38} w={150} value={Math.min(100, done)} target={[60, 100]} label="튀김 익힘" color="#e0a030" />
      <Gauge x={GAUGE_X} y={GAUGE_Y} w={150} value={temp} target={target} label="기름 온도" />
      <Knob x={36} y={180} heat={temp} holding={holding} setHolding={setHold} label="화력" onDown={() => sfx.click()} />
    </>
  );
}

// ───────────────────────── 소스 버무리기 (Swipe, 소스 퍼짐 마스크) ─────────────────────────
export function TossStep(p: StepProps) {
  const step = p.step as Extract<StepProps['step'], { kind: 'toss' }>;
  const { atlas } = useAssets();
  const [count, setCount] = useState(0);
  const [lost, setLost] = useState(0);
  const s = useRef({ count: 0, lost: 0, done: false });

  useEffect(() => { p.setToadBase('wok1'); }, []); // eslint-disable-line

  const { handlers, dx } = useSwipe({
    minAmp: 30,
    onStroke: (_d, amp) => {
      const st = s.current;
      if (st.done) return;
      if (amp > 130) { st.lost++; setLost(st.lost); p.addWaste(1); p.toast('탕수육이 튀어나갔다!', false); p.flashToad('panic', 500); sfx.angry(); }
      st.count++;
      setCount(st.count);
      sfx.stir(0.7);
      p.flashToad(st.count % 2 ? 'wok1' : 'wok2', 250);
      if (st.count >= step.count) {
        st.done = true;
        const score = Math.max(0.2, 1 - st.lost * 0.15);
        p.setVis({ fried: 'sauced' });
        p.flashToad('flip', 800);
        setTimeout(() => p.onDone(score, { msg: '소스가 골고루 입혀졌다!' }), 500);
      }
    },
  });

  const prog = Math.min(1, count / step.count);
  const size = 180;

  return (
    <>
      <Instruction text={step.label} sub={`버무리기 ${count}/${step.count} ${lost ? `· 손실 ${lost}` : ''}`} />
      <div className="absolute" style={{ left: WOK.cx - 110, top: 60, width: 220, height: 220, ...handlers.style }} onPointerDown={handlers.onPointerDown} onPointerMove={handlers.onPointerMove} onPointerUp={handlers.onPointerUp} onPointerCancel={handlers.onPointerCancel}>
        <div className="absolute pointer-events-none" style={{ left: 20 + dx, top: 20, width: size, height: size, transform: `rotate(${dx * 0.2}deg)` }}>
          <Sprite src={atlas.food} frame={FOOD.saucePot} size={size} className="absolute" style={{ left: 0, top: 0 }} />
          {/* 접시 없는 순수 튀김 조각들이 소스볼 중앙에 자리함 */}
          <div className="absolute pointer-events-none" style={{ left: 45, top: 38, width: 90, height: 90 }}>
            <Sprite src={atlas.food} frame={FOOD.friedChunks} size={90} className="absolute" style={{ left: 0, top: 0 }} />
            {/* 소스를 버무릴수록 튀김 덩어리 위로 퍼져나가는 윤기 나는 소스 (외곽선 완벽 일치) */}
            <div className="absolute inset-0" style={{ clipPath: `circle(${prog * 75 + 1}% at 50% 50%)`, transition: 'clip-path 0.15s' }}>
              <Sprite src={atlas.food} frame={FOOD.tangsuyukChunks} size={90} className="absolute" style={{ left: 0, top: 0 }} />
            </div>
          </div>
          {Math.abs(dx) > 20 && <Burst frame={FX.splash} x={size / 2 + dx} y={50} size={50} />}
        </div>
      </div>
      <div className="absolute text-white font-black stroke-thin anim-pulse pointer-events-none" style={{ left: WOK.cx - 100, top: 262, width: 200, textAlign: 'center', fontSize: 12 }}>← 볼을 좌우로 흔들어 버무려라 →</div>
      <Gauge x={20} y={GAUGE_TOP_Y} w={120} value={prog * 100} label="소스 코팅" color="#ff8c1a" />
    </>
  );
}
