import { AnimSprite, Sprite } from '../Sprite';
import { ImgButton } from '../ImgButton';
import { useAssets } from '../../game/AssetContext';
import { FIRE_FRAMES, FOOD, UI } from '../../game/atlas';
import type { SaveData } from '../../game/save';

export function TitleScreen({ save, onStart, onReset, onPractice }: { save: SaveData; onStart: () => void; onReset: () => void; onPractice: () => void }) {
  const { atlas, bg } = useAssets();
  const hasSave = save.day > 1 || save.money !== 5000;
  return (
    <div className="absolute inset-0" style={{ backgroundImage: `url(${bg.title})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.6) 100%)' }} />
      {/* 로고 */}
      <div className="absolute w-full flex flex-col items-center" style={{ top: 34 }}>
        <div className="flex items-end">
          <Sprite src={atlas.food} frame={FOOD.jjamppong} size={54} className="anim-bob" />
          <div className="font-black stroke" style={{ fontSize: 46, color: '#ffe56a', letterSpacing: 4, lineHeight: 1 }}>두꺼비짬뽕</div>
          <Sprite src={atlas.food} frame={FOOD.tangsuyuk} size={54} className="anim-bob" style={{ animationDelay: '0.4s' }} />
        </div>
        <div className="font-black stroke-thin text-white" style={{ fontSize: 14, marginTop: 6 }}>불맛 가득 전통 주방 · 조리 액션 식당 운영</div>
      </div>
      <div className="absolute anim-wobble" style={{ left: 12, top: 380, opacity: 0.9 }}>
        <AnimSprite src={atlas.fx} frames={FIRE_FRAMES} fps={8} size={70} style={{ mixBlendMode: 'screen' }} />
      </div>
      {/* 버튼 */}
      <div className="absolute w-full flex flex-col items-center gap-3" style={{ bottom: 40 }}>
        <ImgButton label={hasSave ? `이어서 영업하기 (Day ${save.day})` : '영업 시작'} onClick={onStart} kind="red" width={250} height={70} fontSize={hasSave ? 19 : 24} className="anim-pulse" />
        {hasSave && <ImgButton label="처음부터" onClick={onReset} kind="wood" width={160} height={50} fontSize={15} />}
        <ImgButton label="메뉴 연습해보기" onClick={onPractice} kind="wood" width={200} height={56} fontSize={16} className="anim-bob" />
        <div className="flex items-center gap-1 mt-1">
          <Sprite src={atlas.ui} frame={UI.coin} size={22} />
          <div className="font-bold text-white stroke-thin" style={{ fontSize: 12 }}>보유 {save.money.toLocaleString()}원 · 누적 {save.totalServed}그릇</div>
        </div>
      </div>
    </div>
  );
}
