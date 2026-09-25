import { CSSProperties, ReactNode } from 'react';
import { SpriteBox } from './Sprite';
import { UI } from '../game/atlas';
import { useAssets } from '../game/AssetContext';
import { sfx } from '../game/sfx';

interface Props {
  label: ReactNode;
  onClick: () => void;
  kind?: 'wood' | 'red' | 'round';
  width?: number;
  height?: number;
  disabled?: boolean;
  style?: CSSProperties;
  fontSize?: number;
  className?: string;
}

/** PNG 아틀라스 기반 이미지 버튼 (텍스트 라벨 오버레이) */
export function ImgButton({ label, onClick, kind = 'wood', width = 200, height = 64, disabled, style, fontSize = 20, className }: Props) {
  const { atlas } = useAssets();
  const frame = kind === 'wood' ? UI.btnWood : kind === 'red' ? UI.btnRed : UI.btnRound;
  return (
    <div
      className={'relative select-none ' + (className ?? '')}
      style={{
        width, height,
        opacity: disabled ? 0.45 : 1,
        filter: disabled ? 'grayscale(0.8)' : undefined,
        transition: 'transform 0.1s',
        ...style,
      }}
      onPointerDown={(e) => { if (!disabled) { (e.currentTarget.style.transform = 'scale(0.94)'); sfx.click(); } }}
      onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onClick={() => { if (!disabled) onClick(); }}
    >
      <SpriteBox
        src={atlas.ui}
        frame={frame}
        width={width}
        height={height}
        style={{ position: 'absolute', inset: 0 }}
      />
      <div
        className="absolute inset-0 flex items-center justify-center font-black text-white stroke"
        style={{ fontSize, letterSpacing: 1 }}
      >
        {label}
      </div>
    </div>
  );
}
