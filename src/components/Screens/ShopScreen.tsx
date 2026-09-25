import { Sprite, SpriteBox } from '../Sprite';
import { ImgButton } from '../ImgButton';
import { useAssets } from '../../game/AssetContext';
import { UI } from '../../game/atlas';
import { SaveData, UpgradeId, UPGRADES } from '../../game/save';

export function ShopScreen({ save, onBuy, onDone }: { save: SaveData; onBuy: (id: UpgradeId) => void; onDone: () => void }) {
  const { atlas, bg } = useAssets();
  return (
    <div className="absolute inset-0" style={{ backgroundImage: `url(${bg.kitchen})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0" style={{ background: 'rgba(15,6,3,0.78)' }} />
      <div className="absolute w-full flex flex-col items-center" style={{ top: 8 }}>
        <div className="font-black stroke" style={{ fontSize: 24, color: '#ffe56a' }}>식당 업그레이드</div>
        <div className="flex items-center">
          <Sprite src={atlas.ui} frame={UI.coin} size={28} />
          <div className="font-black text-yellow-200 stroke" style={{ fontSize: 16 }}>{save.money.toLocaleString()}원</div>
        </div>
      </div>
      <div className="absolute overflow-y-auto" style={{ left: 8, top: 66, width: 344, height: 490, touchAction: 'pan-y' }}>
        <div className="grid grid-cols-2" style={{ gap: 6 }}>
          {UPGRADES.map((u) => {
            const owned = save.upgrades[u.id];
            const can = !owned && save.money >= u.cost;
            return (
              <div key={u.id} className="relative" style={{ width: 168, height: 152 }}>
                <SpriteBox src={atlas.ui} frame={UI.panel} width={168} height={152} style={{ position: 'absolute', inset: 0, filter: owned ? 'sepia(0.4) brightness(1.05)' : undefined }} />
                <div className="absolute inset-0 flex flex-col items-center" style={{ padding: '12px 10px 8px' }}>
                  <div className="flex items-center" style={{ gap: 4 }}>
                    <Sprite src={atlas.equipment} frame={u.oldFrame} size={40} style={{ opacity: owned ? 0.35 : 1, filter: owned ? 'grayscale(1)' : undefined }} />
                    <div className="font-black" style={{ fontSize: 14, color: '#6b3b1c' }}>→</div>
                    <Sprite src={atlas.equipment} frame={u.newFrame} size={48} style={{ filter: owned ? 'drop-shadow(0 0 6px #ffe56a)' : undefined }} />
                  </div>
                  <div className="font-black" style={{ fontSize: 12, color: '#3b1d0e' }}>{u.from} → {u.to}</div>
                  <div className="font-bold text-center" style={{ fontSize: 8.5, color: '#4a2a12', lineHeight: 1.2, height: 22 }}>{u.effect}</div>
                  {owned ? (
                    <div className="flex items-center" style={{ marginTop: 2 }}>
                      <Sprite src={atlas.ui} frame={UI.check} size={26} />
                      <div className="font-black" style={{ fontSize: 12, color: '#2e7d32' }}>구매 완료</div>
                    </div>
                  ) : (
                    <ImgButton label={`${u.cost.toLocaleString()}원`} onClick={() => onBuy(u.id)} kind={can ? 'red' : 'wood'} disabled={!can} width={120} height={36} fontSize={13} style={{ marginTop: 2 }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="absolute w-full flex justify-center" style={{ bottom: 14 }}>
        <ImgButton label={`Day ${save.day} 메뉴판 보기`} onClick={onDone} kind="red" width={230} height={60} fontSize={18} className="anim-pulse" />
      </div>
    </div>
  );
}
