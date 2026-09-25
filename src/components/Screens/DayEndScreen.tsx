import { Sprite, SpriteBox } from '../Sprite';
import { ImgButton } from '../ImgButton';
import { useAssets } from '../../game/AssetContext';
import { UI } from '../../game/atlas';
import { gradeOf } from '../../game/recipes';
import type { DayStats } from '../../game/save';

export function DayEndScreen({ day, stats, onNext }: { day: number; stats: DayStats; onNext: () => void }) {
  const { atlas, bg } = useAssets();
  const avgQ = stats.qualities.length ? stats.qualities.reduce((a, b) => a + b, 0) / stats.qualities.length : 0;
  const avgS = stats.satisfaction.length ? stats.satisfaction.reduce((a, b) => a + b, 0) / stats.satisfaction.length : 0;
  const stars = Math.round(avgS * 5);
  const rows: [string, string][] = [
    ['오늘 매출', `${stats.revenue.toLocaleString()}원`],
    ['서빙한 그릇', `${stats.served}그릇`],
    ['음식 품질', stats.qualities.length ? `${gradeOf(avgQ)} (${Math.round(avgQ * 100)}점)` : '-'],
    ['실수 횟수', `${stats.mistakes}회`],
    ['버린 재료', `${stats.wasted}개`],
    ['최고 메뉴', stats.bestMenu],
  ];
  return (
    <div className="absolute inset-0" style={{ backgroundImage: `url(${bg.dayEnd})`, backgroundSize: 'cover', backgroundPosition: 'center top' }}>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.75) 100%)' }} />
      <div className="absolute w-full text-center" style={{ top: 16 }}>
        <div className="font-black stroke" style={{ fontSize: 28, color: '#ffe56a' }}>Day {day} 영업 종료</div>
        <div className="font-bold text-white stroke-thin" style={{ fontSize: 12 }}>"오늘도 정성껏 한 그릇을 대접했다."</div>
      </div>
      <div className="absolute" style={{ left: 20, top: 300, width: 320, height: 250 }}>
        <SpriteBox src={atlas.ui} frame={UI.panel} width={320} height={250} style={{ position: 'absolute', inset: 0 }} />
        <div className="absolute flex justify-center" style={{ left: 0, top: 18, width: 320, gap: 2 }}>
          {[0, 1, 2, 3, 4].map((i) => <Sprite key={i} src={atlas.ui} frame={UI.star} size={34} className={i < stars ? 'anim-pop' : ''} style={{ opacity: i < stars ? 1 : 0.25, filter: i < stars ? undefined : 'grayscale(1)', animationDelay: `${i * 0.12}s` }} />)}
        </div>
        <div className="absolute" style={{ left: 34, top: 60, width: 252 }}>
          <div className="text-center font-black" style={{ fontSize: 11, color: '#6b3b1c' }}>손님 만족도 {Math.round(avgS * 100)}%</div>
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between items-center" style={{ borderBottom: '1px dashed rgba(90,50,20,0.35)', padding: '4px 2px' }}>
              <div className="font-bold" style={{ fontSize: 12, color: '#4a2a12' }}>{k}</div>
              <div className="font-black" style={{ fontSize: 13, color: k === '오늘 매출' ? '#b3261e' : '#2a1208' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute w-full flex justify-center" style={{ bottom: 22 }}>
        <ImgButton label="업그레이드 상점으로" onClick={onNext} kind="red" width={230} height={64} fontSize={18} className="anim-pulse" />
      </div>
    </div>
  );
}
