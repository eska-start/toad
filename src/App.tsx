import { useCallback, useEffect, useRef, useState } from 'react';
import { AssetContext } from './game/AssetContext';
import { loadAllAssets, LoadedAssets } from './game/assets';
import { H, ScaleContext, ScaleInfo, W } from './game/drag';
import { clearSave, DayStats, defaultSave, loadSave, SaveData, UpgradeId, UPGRADES, writeSave } from './game/save';
import { MenuId } from './game/recipes';
import { TitleScreen } from './components/Screens/TitleScreen';
import { MenuBoard } from './components/Screens/MenuBoard';
import { GameScreen } from './components/Game/GameScreen';
import { DayEndScreen } from './components/Screens/DayEndScreen';
import { ShopScreen } from './components/Screens/ShopScreen';
import { PracticeScreen } from './components/Screens/PracticeScreen';
import { ImgButton } from './components/ImgButton';
import { audio, sfx } from './game/sfx';

type Screen = 'title' | 'menu' | 'game' | 'dayend' | 'shop' | 'practice';

function useScale(): ScaleInfo {
  const calc = () => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const scale = Math.min(vw / W, vh / H);
    return { scale, left: (vw - W * scale) / 2, top: (vh - H * scale) / 2 };
  };
  const [s, setS] = useState<ScaleInfo>(calc);
  useEffect(() => {
    const on = () => setS(calc());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); };
  }, []);
  return s;
}

export default function App() {
  const [assets, setAssets] = useState<LoadedAssets | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const scale = useScale();
  const [screen, setScreen] = useState<Screen>('title');
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [dayStats, setDayStats] = useState<DayStats | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [preferred, setPreferred] = useState<MenuId | null>(null);
  const [endedDay, setEndedDay] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(() => !audio.isMuted());

  const toggleSound = () => {
    const enabled = !soundEnabled;
    audio.setMuted(!enabled);
    setSoundEnabled(enabled);
    if (enabled) sfx.pop();
  };

  useEffect(() => {
    loadAllAssets(setProgress).then(setAssets).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => { writeSave(save); }, [save]);

  const onMoney = useCallback((delta: number) => {
    setSave((s) => ({ ...s, money: s.money + delta, totalServed: s.totalServed + 1 }));
  }, []);

  const saveRef = useRef(save);
  saveRef.current = save;
  const onDayEnd = useCallback((stats: DayStats) => {
    setDayStats(stats);
    setEndedDay(saveRef.current.day);
    setSave((s) => ({ ...s, day: s.day + 1, bestDay: Math.max(s.bestDay, stats.revenue) }));
    setScreen('dayend');
  }, []);

  const buy = (id: UpgradeId) => {
    const u = UPGRADES.find((x) => x.id === id)!;
    setSave((s) => (s.upgrades[id] || s.money < u.cost ? s : { ...s, money: s.money - u.cost, upgrades: { ...s.upgrades, [id]: true } }));
  };

  const content = () => {
    if (error) return <div className="absolute inset-0 flex items-center justify-center text-white text-center p-6">{error}</div>;
    if (!assets) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: 'radial-gradient(circle at 50% 40%, #4a1a0c, #120806)' }}>
          <div className="font-black" style={{ fontSize: 34, color: '#ffe56a', letterSpacing: 4 }}>두꺼비짬뽕</div>
          <div className="text-white font-bold" style={{ fontSize: 13, marginTop: 8 }}>주방 준비 중... {Math.round(progress * 100)}%</div>
          <div style={{ width: 200, height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.15)', marginTop: 12, overflow: 'hidden' }}>
            <div style={{ width: `${progress * 100}%`, height: '100%', background: '#ff7a1a', transition: 'width 0.2s' }} />
          </div>
        </div>
      );
    }
    return (
      <AssetContext.Provider value={assets}>
        {screen === 'title' && (
          <TitleScreen
            save={save}
            onStart={() => { audio.startMusic(); setScreen('menu'); }}
            onReset={() => { if (confirm('저장된 진행을 지우고 처음부터 시작할까요?')) { clearSave(); setSave(defaultSave()); audio.startMusic(); setScreen('menu'); } }}
            onPractice={() => { audio.startMusic(); setScreen('practice'); }}
          />
        )}
        {screen === 'menu' && <MenuBoard save={save} onOpen={(m) => { setPreferred(m); setGameKey((k) => k + 1); setScreen('game'); }} onShop={() => setScreen('shop')} />}
        {screen === 'game' && <GameScreen key={gameKey} save={save} onMoney={onMoney} onDayEnd={onDayEnd} preferredMenu={preferred} />}
        {screen === 'dayend' && dayStats && <DayEndScreen day={endedDay} stats={dayStats} onNext={() => setScreen('shop')} />}
        {screen === 'shop' && <ShopScreen save={save} onBuy={buy} onDone={() => setScreen('menu')} />}
        {screen === 'practice' && <PracticeScreen onBack={() => setScreen('title')} />}
        <ImgButton
          label={soundEnabled ? '소리 켬' : '소리 끔'}
          onClick={toggleSound}
          kind="wood"
          width={screen === 'game' ? 54 : 64}
          height={screen === 'game' ? 28 : 38}
          fontSize={screen === 'game' ? 9 : 10}
          style={{ position: 'absolute', left: 4, top: screen === 'game' ? 40 : 5, zIndex: 60 }}
        />
      </AssetContext.Provider>
    );
  };

  return (
    <ScaleContext.Provider value={scale}>
      <div style={{ position: 'fixed', inset: 0, background: '#120806' }}>
        <div style={{ position: 'absolute', left: scale.left, top: scale.top, width: W, height: H, transform: `scale(${scale.scale})`, transformOrigin: '0 0', overflow: 'hidden', boxShadow: '0 0 40px rgba(0,0,0,0.8)' }}>
          {content()}
        </div>
      </div>
    </ScaleContext.Provider>
  );
}
