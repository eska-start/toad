import { CSSProperties, ReactNode, useEffect, useState } from 'react';
import type { AtlasData } from '../game/assets';

interface SpriteProps {
  src: AtlasData;
  frame: number;
  size: number; // 표시 크기(px, 정사각형 상자)
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
  flip?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  dataDrop?: string;
}

/**
 * 자동 슬라이싱된 아틀라스 프레임 표시.
 * - fit 모드: 프레임을 상자에 비율 유지하며 꽉 맞춤 (음식/재료/도구/UI/FX)
 * - cell 모드: 아틀라스 공통 배율 + 하단 중앙 정렬 → 애니메이션 중 크기/위치 흔들림 없음 (캐릭터)
 */
export function Sprite({ src, frame, size, style, className, children, flip, onPointerDown, onClick, dataDrop }: SpriteProps) {
  const f = src.frames[frame] ?? src.frames[0];
  let inner: CSSProperties;
  if (src.mode === 'cell') {
    const w = f.rw * src.k * size;
    const h = f.rh * src.k * size;
    inner = {
      position: 'absolute', left: (size - w) / 2, top: size - h, width: w, height: h,
      backgroundImage: `url(${f.url})`, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat',
    };
  } else {
    inner = {
      position: 'absolute', left: 0, top: 0, width: '100%', height: '100%',
      backgroundImage: `url(${f.url})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
    };
  }
  return (
    <div
      className={className}
      data-drop={dataDrop}
      onPointerDown={onPointerDown}
      onClick={onClick}
      style={{ width: size, height: size, transform: flip ? 'scaleX(-1)' : undefined, ...style }}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%' }} data-drop={dataDrop}>
        <div style={{ ...inner, pointerEvents: 'none' }} />
        {children}
      </div>
    </div>
  );
}

interface AnimProps extends Omit<SpriteProps, 'frame'> {
  frames: number[];
  fps?: number;
  playing?: boolean;
}

/** 프레임 배열을 순환 재생하는 스프라이트 애니메이션 */
export function AnimSprite({ frames, fps = 6, playing = true, ...rest }: AnimProps) {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    if (!playing || frames.length <= 1) return;
    const id = setInterval(() => setI((v) => (v + 1) % frames.length), 1000 / fps);
    return () => clearInterval(id);
  }, [frames.join(','), fps, playing]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Sprite {...rest} frame={frames[i % frames.length]} />;
}

/** 직사각형 UI 상자: 잘라낸 프레임을 상자 크기에 맞춰 늘려 표시 (버튼/패널/주문서/간판/테이블) */
export function SpriteBox({
  src, frame, width, height, style, className, children, onClick, onPointerDown, dataDrop,
}: {
  src: AtlasData; frame: number; width: number; height: number; style?: CSSProperties; className?: string;
  children?: ReactNode; onClick?: (e: React.MouseEvent) => void; onPointerDown?: (e: React.PointerEvent) => void; dataDrop?: string;
}) {
  const f = src.frames[frame] ?? src.frames[0];
  return (
    <div
      className={className}
      data-drop={dataDrop}
      onClick={onClick}
      onPointerDown={onPointerDown}
      style={{
        width, height,
        backgroundImage: `url(${f.url})`,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
