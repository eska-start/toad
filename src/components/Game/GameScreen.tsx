import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimSprite, Sprite, SpriteBox } from '../Sprite';
import { useAssets } from '../../game/AssetContext';
import { EQUIP, ING, ING_NAME, IngredientId, TOAD, ToadPose, UI } from '../../game/atlas';
import { DragProvider, useDrag, useDrop } from '../../game/drag';
import { buildDayOrders, GRADE_MULT, gradeOf, maxConcurrent, MenuId, RECIPES, Step } from '../../game/recipes';
import { DayStats, emptyStats, SaveData } from '../../game/save';
import { Customer, CustomerView } from './CustomerView';
import { CookVisual, StepProps } from './steps/common';
import { AddStep, FireStep, HeatStep, PourStep, ShakeStep, StirStep, STOVE, TransferStep, WOK } from './steps/WokSteps';
import { MixStep, NoodleStep, PlateStep, ServeStep } from './steps/NoodleSteps';
import { ChopStep, FryStep, ShapeStep, TossStep } from './steps/FrySteps';
import { sfx } from '../../game/sfx';
import { ImgButton } from '../ImgButton';

interface Cook {
  menu: MenuId;
  customerId: number;
  stepIdx: number;
  scores: number[];
  wasted: number;
  burnt: boolean;
  key: number;
}

const initialVis = (): CookVisual => ({ wok: 'empty', heat: 0, bowl: 'none', soupPct: 0, toppings: [], fried: 'none' });

const PATIENCE_FACTOR = [1.35, 0.8, 1.0, 1.1];

interface Props {
  save: SaveData;
  onMoney: (delta: number) => void;
  onDayEnd: (stats: DayStats) => void;
  preferredMenu: MenuId | null;
  practice?: boolean;
  onPracticeBack?: () => void;
  onMainMenu?: () => void;
}

export function GameScreen(props: Props) {
  return (
    <DragProvider>
      <GameInner {...props} />
    </DragProvider>
  );
}

function GameInner({ save, onMoney, onDayEnd, preferredMenu, practice, onPracticeBack, onMainMenu }: Props) {
  const { atlas, bg } = useAssets();
  const { dragging } = useDrag();
  const day = save.day;

  // 연습 모드: 연습 선택 메뉴를 반복적으로 큐에 넣음
  const practiceMenu = practice ? (preferredMenu ?? 'jjamppong') : null;

  // ── 손님 큐 ──
  const [queue, setQueue] = useState<MenuId[]>(() => {
    if (practice) return practiceMenu ? [practiceMenu] : ['jjamppong'];
    const q = buildDayOrders(day, save.upgrades.sign ? 1 : 0);
    if (preferredMenu && q[0] !== preferredMenu) q[0] = preferredMenu;
    return q;
  });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<DayStats>(emptyStats());
  const [money, setMoney] = useState(save.money);
  const nextId = useRef(1);
  const spawnTimer = useRef(1.2);
  const totalOrders = useRef(queue.length);
  const endedRef = useRef(false);

  // ── 조리 ──
  const [cook, setCook] = useState<Cook | null>(null);
  const cookRef = useRef<Cook | null>(cook);
  cookRef.current = cook;
  const stepSequence = useRef(0);
  const [cancelArmed, setCancelArmed] = useState(false);
  const cancelTimer = useRef<number | null>(null);
  useEffect(() => () => { if (cancelTimer.current !== null) window.clearTimeout(cancelTimer.current); }, []);
  const [vis, setVisState] = useState<CookVisual>(initialVis());
  const visRef = useRef(vis);
  const setVis = useCallback((patch: Partial<CookVisual>) => {
    // 수치형 값은 양자화하여 불필요한 리렌더 방지
    const p: Partial<CookVisual> = { ...patch };
    if (p.heat !== undefined) p.heat = Math.round(p.heat / 3) * 3;
    if (p.soupPct !== undefined) p.soupPct = Math.round(p.soupPct / 4) * 4;
    const cur = visRef.current;
    let changed = false;
    for (const k of Object.keys(p) as (keyof CookVisual)[]) {
      if (cur[k] !== p[k]) { changed = true; break; }
    }
    if (!changed) return;
    visRef.current = { ...cur, ...p };
    setVisState(visRef.current);
  }, []);
  const [toadBase, setToadBase] = useState<ToadPose>('idle1');
  const [toadFlash, setToadFlash] = useState<ToadPose | null>(null);
  const flashTimer = useRef(0);
  const flashToad = useCallback((pose: ToadPose, ms = 800) => {
    setToadFlash(pose);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setToadFlash(null), ms);
  }, []);
  const [toasts, setToasts] = useState<{ id: number; msg: string; good: boolean }[]>([]);
  const toastId = useRef(0);
  const toast = useCallback((msg: string, good = true) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, msg, good }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1700);
  }, []);
  const addWaste = useCallback((n = 1) => {
    setStats((s) => ({ ...s, wasted: s.wasted + n }));
    setCook((c) => (c ? { ...c, wasted: c.wasted + n } : c));
  }, []);
  const [stepMsg, setStepMsg] = useState<string | null>(null);

  // ── 게임 틱 (손님 이동/인내심/입장) ──
  const patienceMult = (save.upgrades.table ? 1.25 : 1) * (save.upgrades.light ? 1.1 : 1);
  const custRef = useRef<Customer[]>([]);
  custRef.current = customers;
  const queueRef = useRef<MenuId[]>(queue);
  queueRef.current = queue;
  useEffect(() => {
    const id = setInterval(() => {
      const dt = 0.1;
      let list = custRef.current.map((c) => ({ ...c }));
      let leftAngry = 0;
      let selectedCustomerLeft = false;
      for (const c of list) {
        c.timer += dt;
        if (c.state === 'enter' && c.timer >= 1.1) { c.state = 'wait'; c.timer = 0; }
        else if (c.state === 'wait') {
          c.patience -= dt;
          if (c.patience <= 0) {
            c.state = 'leave'; c.timer = 0; c.reaction = undefined; leftAngry++;
            if (c.id === cookRef.current?.customerId) selectedCustomerLeft = true;
          }
        } else if (c.state === 'eat' && c.timer >= 3) {
          c.state = c.reaction && c.reaction.grade !== '실패' ? 'happy' : 'angry'; c.timer = 0;
        } else if ((c.state === 'happy' || c.state === 'angry') && c.timer >= 1.6) {
          c.state = 'leave'; c.timer = 0;
        }
      }
      list = list.filter((c) => !(c.state === 'leave' && c.timer >= 1.2));
      if (leftAngry > 0) {
        setStats((s) => ({ ...s, mistakes: s.mistakes + leftAngry, satisfaction: [...s.satisfaction, ...Array(leftAngry).fill(0)] }));
        flashToad('angry', 1500);
        sfx.angry();
      }
      if (selectedCustomerLeft) toast('주문 손님 퇴장! 아래 조리 취소를 누르세요', false);
      // 입장
      spawnTimer.current -= dt;
      if (spawnTimer.current <= 0) {
        const q = queueRef.current;
        if (q.length > 0 && list.length < maxConcurrent(day)) {
          const [menu, ...rest] = q;
          const used = list.map((c) => c.seat);
          const seat = [0, 1, 2].find((s) => !used.includes(s)) ?? 0;
          const char = Math.floor(Math.random() * 4);
          const base = Math.max(45, 75 - day * 4) * PATIENCE_FACTOR[char] * patienceMult * (1 + (RECIPES[menu].difficulty - 1) * 0.15);
          list.push({ id: nextId.current++, char, menu, seat, state: 'enter', patience: base, maxPatience: base, timer: 0 });
          queueRef.current = rest;
          setQueue(rest);
        }
        spawnTimer.current = 4 + Math.random() * 4;
      }
      custRef.current = list;
      setCustomers(list);
    }, 100);
    return () => clearInterval(id);
  }, [day, patienceMult, flashToad, toast]);

  // ── 하루 종료 판정 ──
  useEffect(() => {
    if (endedRef.current) return;
    if (!practice && queue.length === 0 && customers.length === 0 && !cook && totalOrders.current > 0) {
      const t = setTimeout(() => {
        if (endedRef.current) return;
        endedRef.current = true;
        const s = { ...stats };
        let best = '-'; let bestN = 0;
        for (const [k, v] of Object.entries(s.menuCount)) if (v > bestN) { bestN = v; best = k; }
        s.bestMenu = best;
        onDayEnd(s);
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [practice, queue.length, customers.length, cook, stats, onDayEnd]);

  // ── 조리 시작 ──
  const startCook = (c: Customer) => {
    if (c.state !== 'wait') return;
    if (cook) { toast(`지금 ${RECIPES[cook.menu].name} 조리 중이야!`, false); flashToad('panic', 700); sfx.angry(); return; }
    visRef.current = initialVis();
    setVisState(visRef.current);
    const next: Cook = { menu: c.menu, customerId: c.id, stepIdx: 0, scores: [], wasted: 0, burnt: false, key: ++stepSequence.current };
    cookRef.current = next;
    setCook(next);
    setCancelArmed(false);
    if (cancelTimer.current !== null) window.clearTimeout(cancelTimer.current);
    setStepMsg(null);
    flashToad('happy', 700);
    sfx.pop();
    toast(`${RECIPES[c.menu].name} 주문 접수!`);
  };

  const recipe = cook ? RECIPES[cook.menu] : null;
  const step: Step | null = recipe && cook ? recipe.steps[cook.stepIdx] : null;

  const onStepDone = useCallback((key: number, score: number, opts?: Parameters<StepProps['onDone']>[1]) => {
    const current = cookRef.current;
    if (!current || current.key !== key) return;
    const nextKey = ++stepSequence.current;
    cookRef.current = { ...current, key: nextKey };
    setCook((c) => c?.key === key ? {
      ...c,
      stepIdx: c.stepIdx + 1,
      scores: [...c.scores, score],
      burnt: c.burnt || !!opts?.burnt,
      key: nextKey,
    } : c);
    if (opts?.msg) { setStepMsg(opts.msg); setTimeout(() => setStepMsg(null), 1500); }
  }, []);

  const computeQuality = (c: Cook) => {
    const avg = c.scores.length ? c.scores.reduce((a, b) => a + b, 0) / c.scores.length : 0;
    let q = avg - Math.min(0.3, c.wasted * 0.04);
    if (c.burnt) q = Math.min(q, 0.3);
    return Math.max(0, Math.min(1, q));
  };

  // ── 서빙 & 쓰레기통 드롭 ──
  useDrop((payload, dropId) => {
    if (payload.type === 'dish' && cook) {
      if (dropId === 'trash') { discard(); return true; }
      if (dropId?.startsWith('seat-')) {
        const seat = Number(dropId.split('-')[1]);
        const c = customers.find((x) => x.seat === seat && x.state === 'wait');
        if (!c) return true;
        if (c.menu !== cook.menu) {
          toast(`${c.menu ? RECIPES[c.menu].name : ''}을(를) 시켰는데?!`, false);
          flashToad('panic', 900);
          setStats((s) => ({ ...s, mistakes: s.mistakes + 1 }));
          setCustomers((prev) => prev.map((x) => (x.id === c.id ? { ...x, patience: Math.max(1, x.patience - 6) } : x)));
          return true;
        }
        if (c.id !== cook.customerId && customers.some((x) => x.id === cook.customerId && x.state === 'wait')) {
          toast('주문을 수락한 손님에게 서빙해!', false);
          return true;
        }
        serve(c);
        return true;
      }
      toast('손님에게 정확히 놓아라', false);
      return true;
    }
    if (payload.type === 'ingredient' && dropId === 'trash') {
      addWaste(1); toast('재료를 버렸다', false); return true;
    }
    return false;
  });

  const serve = (c: Customer) => {
    if (!cook) return;
    const q = computeQuality(cook);
    const grade = gradeOf(q);

    if (practice) {
      // 연습 모드: 메뉴 이름 + 판정만 표시하고 조리 초기화
      setCustomers((prev) => prev.map((x) => (x.id === c.id ? { ...x, state: 'eat', timer: 0, reaction: { grade, pay: 0 } } : x)));
      flashToad(grade === '실패' ? 'fail' : 'happy', 1800);
      if (grade !== '실패') sfx.serve(); else sfx.angry();
      toast(`완성! ${RECIPES[cook.menu].name} — ${grade}`, grade !== '실패');
      // 잠시 후 조리 초기화
      const menu = cook.menu;
      setTimeout(() => {
        cookRef.current = null;
        setCook(null);
        setCancelArmed(false);
        setToadBase('idle1');
        visRef.current = initialVis();
        setVisState(visRef.current);
        setStepMsg(null);
        toast(`${RECIPES[menu].name} 연습 완료! 다시 만들어보세요`);
        // 연습 모드: 다음 손님 자동 입장
        if (practice && practiceMenu) {
          queueRef.current = [practiceMenu];
          setQueue([practiceMenu]);
          spawnTimer.current = 2;
          endedRef.current = false;
        }
      }, 2500);
      return;
    }

    const ratio = Math.max(0, c.patience / c.maxPatience);
    const tip = ratio * 0.2 + (save.upgrades.sign ? 0.1 : 0) + (save.upgrades.decor ? 0.1 : 0);
    const pay = Math.round((RECIPES[cook.menu].price * GRADE_MULT[grade] * (1 + tip)) / 100) * 100;
    const satisfaction = Math.min(1, q * 0.7 + ratio * 0.3);
    setCustomers((prev) => prev.map((x) => (x.id === c.id ? { ...x, state: 'eat', timer: 0, reaction: { grade, pay } } : x)));
    setStats((s) => ({
      ...s,
      revenue: s.revenue + pay,
      served: s.served + 1,
      qualities: [...s.qualities, q],
      satisfaction: [...s.satisfaction, satisfaction],
      mistakes: s.mistakes + (grade === '실패' ? 1 : 0),
      menuCount: { ...s.menuCount, [RECIPES[cook.menu].name]: (s.menuCount[RECIPES[cook.menu].name] ?? 0) + 1 },
    }));
    setMoney((m) => m + pay);
    onMoney(pay);
    flashToad(grade === '실패' ? 'fail' : grade === '보통' ? 'idle2' : 'happy', 1800);
    if (grade !== '실패') sfx.serve(); else sfx.angry();
    toast(`${grade}! +${pay.toLocaleString()}원`, grade !== '실패');
    cookRef.current = null;
    setCook(null);
    setCancelArmed(false);
    if (cancelTimer.current !== null) window.clearTimeout(cancelTimer.current);
    setToadBase('idle1');
  };

  const discard = () => {
    if (!cook) return;
    const customerLeft = !custRef.current.some((c) => c.id === cook.customerId && c.state === 'wait');
    const n = Math.max(1, Math.ceil(RECIPES[cook.menu].ingredients.length / 2));
    setStats((s) => ({ ...s, wasted: s.wasted + n, mistakes: s.mistakes + (customerLeft ? 0 : 1) }));
    cookRef.current = null;
    setCook(null);
    visRef.current = initialVis();
    setVisState(visRef.current);
    setCancelArmed(false);
    if (cancelTimer.current !== null) window.clearTimeout(cancelTimer.current);
    setStepMsg(null);
    setToadBase('idle1');
    flashToad('fail', 1200);
    sfx.burn();
    toast(`요리를 버렸다 (재료 ${n}개 손실)`, false);
  };

  const cancelCook = () => {
    if (!cook || dragging) return;
    const customerLeft = !customers.some((c) => c.id === cook.customerId && c.state === 'wait');
    if (customerLeft || cancelArmed) { discard(); return; }
    setCancelArmed(true);
    toast('다시 누르면 조리를 취소합니다', false);
    if (cancelTimer.current !== null) window.clearTimeout(cancelTimer.current);
    cancelTimer.current = window.setTimeout(() => setCancelArmed(false), 3000);
  };

  const returnToMainMenu = () => {
    const message = cook
      ? '조리 중인 음식과 오늘 영업 진행을 취소하고 메인 메뉴로 돌아갈까요?'
      : '오늘 영업을 종료하고 메인 메뉴로 돌아갈까요?';
    if (confirm(message)) onMainMenu?.();
  };

  // ── 두꺼비 포즈 ──
  const toadPose: ToadPose = toadFlash ?? (cook ? toadBase : 'idle1');
  const toadFrames = useMemo(() => (toadPose === 'idle1' && !cook ? [TOAD.idle1, TOAD.idle2] : [TOAD[toadPose]]), [toadPose, cook]);
  const toadPos = (() => {
    switch (step?.kind) {
      case 'fry':
        // 화력 노브(좌하단)를 가리지 않도록 더 왼쪽으로
        return { x: -38, y: 200, s: 0.6 };
      case 'pour': case 'transfer': case 'shape': case 'noodle':
        return { x: -20, y: 200, s: 0.62 };
      case 'add':
        // 재료 투입 시 상단 좌측의 단계(top:56) 및 투입 재료(top:82)와 겹치지 않도록 두꺼비를 아래로 배치
        return { x: -16, y: 154, s: 0.85 };
      default:
        return { x: -14, y: 136, s: 0.9 };
    }
  })();

  // ── 트레이 ──
  const trayItems: IngredientId[] = recipe ? recipe.ingredients : [];
  const neededNow: IngredientId[] = step && step.kind === 'add' ? step.items : step && step.kind === 'plate' ? step.toppings : [];

  const remainingCount = queue.length + customers.filter((c) => c.state === 'enter' || c.state === 'wait').length;
  const anyWaiting = customers.some((c) => c.state === 'wait');
  const orderCustomerLeft = !!cook && !customers.some((c) => c.id === cook.customerId && c.state === 'wait');

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ backgroundImage: `url(${bg.kitchen})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      {/* 조명 업그레이드: 따뜻한 빛 */}
      {save.upgrades.light && <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 20%, rgba(255,200,120,0.35), rgba(0,0,0,0) 65%)', zIndex: 2 }} />}
      {!save.upgrades.light && <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(20,10,5,0.18)', zIndex: 2 }} />}

      {/* 연습 모드 배지 + 메뉴로 버튼 */}
      {practice && (
        <>
          <div className="absolute font-black text-yellow-300 stroke" style={{ left: 8, top: 78, zIndex: 12, fontSize: 11 }}>🎯 연습 모드</div>
          <div
            className="absolute flex items-center justify-center"
            style={{ right: 4, top: 4, zIndex: 12, width: 64, height: 28, background: 'rgba(90,50,20,0.85)', borderRadius: 6, cursor: 'pointer', border: '1px solid #aa6b35' }}
            onClick={() => { if (confirm('연습 모드를 종료하고 메뉴판으로 돌아갈까요?')) onPracticeBack?.(); }}
          >
            <span className="font-black text-yellow-200" style={{ fontSize: 11 }}>메뉴로</span>
          </div>
        </>
      )}
      {!practice && onMainMenu && (
        <ImgButton
          label="메인 메뉴"
          onClick={returnToMainMenu}
          kind="wood"
          width={64}
          height={30}
          fontSize={10}
          style={{ position: 'absolute', right: 4, top: 42, zIndex: 12 }}
        />
      )}
      {/* ── 상단: 간판/돈/일차 ── */}
      <div className="absolute pointer-events-none" style={{ left: 0, top: 0, width: 360, height: 74, zIndex: 10 }}>
        <div className="absolute" style={{ left: 88, top: -4, width: 184, height: 70 }}>
          <SpriteBox src={atlas.equipment} frame={save.upgrades.sign ? EQUIP.signNew : EQUIP.signOld} width={184} height={70} />
          {/* 간판 윗부분 걸이를 제외한 판 중앙에 글자 배치 */}
          <div className="absolute flex items-center justify-center" style={{ left: 0, right: 0, top: 22, bottom: 6 }}>
            <div className="font-black stroke" style={{ fontSize: 19, color: save.upgrades.sign ? '#ffe56a' : '#fff3d6', letterSpacing: 2 }}>두꺼비짬뽕</div>
          </div>
        </div>
        <div className="absolute flex items-center" style={{ left: 4, top: 6 }}>
          <Sprite src={atlas.ui} frame={UI.coin} size={34} />
          <div className="font-black text-yellow-200 stroke" style={{ fontSize: 15, marginLeft: -2 }}>{money.toLocaleString()}</div>
        </div>
        <div className="absolute flex flex-col items-end" style={{ right: 6, top: 6 }}>
          <div className="font-black text-white stroke" style={{ fontSize: 14 }}>Day {day}</div>
          <div className="flex items-center">
            <Sprite src={atlas.ui} frame={UI.clock} size={22} />
            <div className="font-bold text-white stroke-thin" style={{ fontSize: 11 }}>남은 손님 {remainingCount}</div>
          </div>
        </div>
      </div>

      {/* 장식 업그레이드: 홍등 */}
      {save.upgrades.decor && (
        <>
          <Sprite src={atlas.equipment} frame={EQUIP.lantern} size={40} className="absolute anim-wobble" style={{ left: 30, top: 44, zIndex: 3 }} />
          <Sprite src={atlas.equipment} frame={EQUIP.lantern} size={40} className="absolute anim-wobble" style={{ left: 290, top: 44, zIndex: 3, animationDelay: '0.3s' }} />
        </>
      )}

      {/* ── 손님 영역 ── */}
      <div className="absolute" style={{ left: 0, top: 30, width: 360, height: 200, zIndex: 4 }}>
        {customers.map((c) => (
          <CustomerView key={c.id} c={c} onTapOrder={startCook} accepted={cook?.customerId === c.id} highlight={dragging?.type === 'dish' && c.state === 'wait' && dragging.id === c.menu && (cook?.customerId === c.id || !customers.some((x) => x.id === cook?.customerId && x.state === 'wait'))} />
        ))}
        {/* 테이블 (업그레이드 반영) */}
        <SpriteBox src={atlas.equipment} frame={save.upgrades.table ? EQUIP.tableNew : EQUIP.tableOld} width={360} height={80} style={{ position: 'absolute', left: 0, top: 152, zIndex: 6, pointerEvents: 'none' }} />
        {!cook && anyWaiting && (
          <div className="absolute w-full text-center font-black text-yellow-200 stroke anim-pulse pointer-events-none" style={{ top: 175, fontSize: 13, zIndex: 7 }}>▲ 말풍선의 음식 그림을 눌러 주문 수락</div>
        )}
        {!cook && !anyWaiting && customers.length === 0 && (
          <div className="absolute w-full text-center font-black text-white stroke" style={{ top: 175, fontSize: 13, zIndex: 7 }}>{queue.length > 0 ? '손님이 오고 있다...' : '오늘 영업 마감 중...'}</div>
        )}
      </div>

      {/* ── 조리 스테이션 ── */}
      <div className="absolute overflow-hidden" style={{ left: 0, top: 232, width: 360, height: 285, zIndex: 8 }}>
        {/* 두꺼비 요리사 */}
        <div className="absolute pointer-events-none" style={{ left: toadPos.x, top: toadPos.y, zIndex: 1, transform: `scale(${toadPos.s})`, transformOrigin: '0 0', transition: 'left 0.3s, top 0.3s, transform 0.3s' }}>
          <AnimSprite src={atlas.toad} frames={toadFrames} fps={1.2} size={116} className={toadPose === 'happy' ? 'anim-bob' : toadPose === 'angry' || toadPose === 'panic' ? 'anim-shake' : ''} style={{ filter: 'drop-shadow(0 4px 3px rgba(0,0,0,0.35))' }} />
        </div>
        <div className="absolute inset-0" style={{ zIndex: 2 }}>
          {cook && recipe && step ? (
            <StepRenderer key={cook.key} step={step} recipe={recipe} save={save} vis={vis} setVis={setVis} onDone={(score, opts) => onStepDone(cook.key, score, opts)} flashToad={flashToad} setToadBase={setToadBase} addWaste={addWaste} toast={toast} />
          ) : (
            <IdleStation save={save} />
          )}
        </div>
        {/* 진행도 */}
        {cook && recipe && (
          <div className="absolute flex items-center gap-1" style={{ left: 8, top: 56, zIndex: 3 }}>
            <Sprite src={atlas.food} frame={recipe.foodFrame} size={26} />
            <div className="font-black stroke-thin" style={{ fontSize: 10, color: orderCustomerLeft ? '#ffaaaa' : '#fff' }}>
              {orderCustomerLeft ? '손님 퇴장! 아래 조리 취소를 누르세요' : `${recipe.name} · ${cook.stepIdx + 1}/${recipe.steps.length}단계`}
            </div>
          </div>
        )}
        {stepMsg && <div className="absolute w-full text-center font-black stroke anim-pop" style={{ top: 120, fontSize: 18, color: '#ffe56a', zIndex: 20, pointerEvents: 'none' }}>{stepMsg}</div>}
        {toasts.map((t, i) => (
          <div key={t.id} className="absolute w-full text-center font-black stroke anim-float" style={{ top: 70 + i * 22, fontSize: 13, color: t.good ? '#c8ffb0' : '#ff9d9d', zIndex: 21, pointerEvents: 'none' }}>{t.msg}</div>
        ))}
      </div>

      {/* ── 하단 재료 트레이 ── */}
      {/* ── 하단 재료 트레이 ── */}
      <div className="absolute" style={{ left: -12, top: 510, width: 384, height: 130, zIndex: 9 }}>
        <SpriteBox src={atlas.ui} frame={UI.panel} width={384} height={130} style={{ position: 'absolute', inset: 0, opacity: 0.98 }} />
        <div className="absolute" style={{ left: 58, top: 16, width: 254, height: 96, display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: '3px 2px' }}>
          {trayItems.map((id) => (
            <TrayItem key={id} id={id} highlight={neededNow.includes(id)} dim={neededNow.length > 0 && !neededNow.includes(id)} />
          ))}
          {!cook && (
            <div className="w-full h-full flex items-center justify-center text-center font-bold" style={{ color: '#5a3316', fontSize: 12, padding: '0 10px' }}>
              {anyWaiting ? '주문을 받으면 재료가 준비됩니다' : '두꺼비짬뽕 주방 — 손님을 기다리는 중'}
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label={orderCustomerLeft ? '떠난 손님의 요리 취소' : cancelArmed ? '요리 취소 확인' : '요리 취소'}
          data-drop="trash"
          onClick={cancelCook}
          className={orderCustomerLeft && cook ? 'absolute anim-pulse' : 'absolute'}
          style={{ right: 18, top: 18, width: 48, height: 76, border: 0, padding: 0, background: 'transparent', cursor: cook ? 'pointer' : 'default', touchAction: 'manipulation', opacity: cook ? 1 : 0.5 }}
        >
          <Sprite src={atlas.ui} frame={UI.btnRound} size={48} className="pointer-events-none" style={{ position: 'absolute', top: 0, left: 0, filter: orderCustomerLeft ? 'drop-shadow(0 0 8px #ff8e55)' : undefined }} />
          <Sprite src={atlas.ui} frame={orderCustomerLeft ? UI.x : UI.trash} size={24} className="pointer-events-none" style={{ position: 'absolute', left: 12, top: 12 }} />
          <span className="absolute font-black text-white stroke-thin pointer-events-none" style={{ left: 0, top: 52, width: 48, fontSize: 9 }}>{cancelArmed && !orderCustomerLeft ? '다시 누르기' : '조리 취소'}</span>
        </button>
      </div>
    </div>
  );
}

function TrayItem({ id, highlight, dim }: { id: IngredientId; highlight: boolean; dim: boolean }) {
  const { atlas } = useAssets();
  const { startDrag } = useDrag();
  return (
    <div className="flex flex-col items-center justify-center" style={{ width: 48, height: 42, touchAction: 'none', opacity: dim ? 0.55 : 1, cursor: 'grab' }}
      onPointerDown={(e) => startDrag(e, { type: 'ingredient', id, atlas: 'ingredients', frame: ING[id], size: 60 })}>
      <Sprite src={atlas.ingredients} frame={ING[id]} size={28} className={highlight ? 'anim-pulse' : ''} style={{ filter: highlight ? 'drop-shadow(0 0 6px #ffe56a)' : 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))' }} />
      <div className="font-bold text-center" style={{ width: '100%', fontSize: 8.5, lineHeight: '10px', color: highlight ? '#b3261e' : '#4a2a12', marginTop: 1, wordBreak: 'keep-all' }}>{ING_NAME[id]}</div>
    </div>
  );
}

function IdleStation({ save }: { save: SaveData }) {
  const { atlas } = useAssets();
  return (
    <>
      <Sprite src={atlas.equipment} frame={save.upgrades.stove ? EQUIP.stoveNew : EQUIP.stoveOld} size={STOVE.size} className="absolute pointer-events-none" style={{ left: STOVE.x, top: STOVE.y }} />
      <Sprite src={atlas.equipment} frame={save.upgrades.wok ? EQUIP.wokNew : EQUIP.wokOld} size={140} className="absolute pointer-events-none" style={{ left: WOK.cx - 70, top: WOK.cy - 70 }} />
      <Sprite src={atlas.equipment} frame={save.upgrades.knife ? EQUIP.knifeNew : EQUIP.knifeOld} size={70} className="absolute pointer-events-none" style={{ left: 120, top: 200, transform: 'rotate(-30deg)' }} />
      <Sprite src={atlas.equipment} frame={save.upgrades.pot ? EQUIP.potNew : EQUIP.potOld} size={80} className="absolute pointer-events-none" style={{ left: 280, top: 40 }} />
    </>
  );
}

function StepRenderer(p: StepProps) {
  switch (p.step.kind) {
    case 'heat': return <HeatStep {...p} />;
    case 'add': return <AddStep {...p} />;
    case 'stir': return <StirStep {...p} />;
    case 'shake': return <ShakeStep {...p} />;
    case 'pour': return <PourStep {...p} />;
    case 'fire': return <FireStep {...p} />;
    case 'noodle': return <NoodleStep {...p} />;
    case 'transfer': return <TransferStep {...p} />;
    case 'plate': return <PlateStep {...p} />;
    case 'mix': return <MixStep {...p} />;
    case 'chop': return <ChopStep {...p} />;
    case 'shape': return <ShapeStep {...p} />;
    case 'fry': return <FryStep {...p} />;
    case 'toss': return <TossStep {...p} />;
    case 'serve': return <ServeStep {...p} />;
  }
}
