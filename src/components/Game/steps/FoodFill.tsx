import type { CSSProperties } from 'react';
import { useAssets } from '../../../game/AssetContext';

interface Props {
  baseFrame: number;
  filledFrame: number;
  fill: number;
  size: number;
}

/** Replace complementary image regions so the original bowl cannot show below the filled one. */
export function FoodFill({ baseFrame, filledFrame, fill, size }: Props) {
  const { atlas } = useAssets();
  const amount = Number.isFinite(fill) ? Math.max(0, Math.min(100, fill)) : 0;
  const layerStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundSize: 'contain',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };

  return (
    <div
      aria-hidden="true"
      data-fill={amount}
      style={{ position: 'relative', width: size, height: size, overflow: 'hidden', pointerEvents: 'none' }}
    >
      {amount < 100 && (
        <div
          style={{
            ...layerStyle,
            backgroundImage: `url(${atlas.food.frames[baseFrame].url})`,
            clipPath: `inset(0 0 ${amount}% 0)`,
          }}
        />
      )}
      {amount > 0 && (
        <div
          style={{
            ...layerStyle,
            backgroundImage: `url(${atlas.food.frames[filledFrame].url})`,
            clipPath: `inset(${100 - amount}% 0 0 0)`,
          }}
        />
      )}
    </div>
  );
}