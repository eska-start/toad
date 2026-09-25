import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Sprite } from '../components/Sprite';
import { useAssets } from './AssetContext';
import type { AtlasKey } from './assets';

export const W = 360;
export const H = 640;

export interface ScaleInfo { scale: number; left: number; top: number }
export const ScaleContext = createContext<ScaleInfo>({ scale: 1, left: 0, top: 0 });

export function useToLogical() {
  const s = useContext(ScaleContext);
  return useCallback((clientX: number, clientY: number) => ({
    x: (clientX - s.left) / s.scale,
    y: (clientY - s.top) / s.scale,
  }), [s]);
}

export interface DragPayload {
  type: string;      // 'ingredient' | 'dish' | 'wok' | 'strainer' | 'dough' | 'basket' | 'saucebowl'
  id?: string;
  atlas: AtlasKey;
  frame: number;
  size: number;
  data?: unknown;
}

type DropHandler = (payload: DragPayload, dropId: string | null, pos: { x: number; y: number }) => boolean;

interface DragCtxValue {
  dragging: DragPayload | null;
  startDrag: (e: React.PointerEvent, payload: DragPayload) => void;
  registerDrop: (fn: DropHandler) => () => void;
}

const DragContext = createContext<DragCtxValue | null>(null);

export function useDrag() {
  const c = useContext(DragContext);
  if (!c) throw new Error('DragContext 없음');
  return c;
}

/** 드롭 핸들러 등록 훅. 핸들러가 true를 반환하면 소비된 것으로 간주 */
export function useDrop(handler: DropHandler) {
  const { registerDrop } = useDrag();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => registerDrop((p, id, pos) => ref.current(p, id, pos)), [registerDrop]);
}

export function DragProvider({ children }: { children: ReactNode }) {
  const { atlas } = useAssets();
  const toLogical = useToLogical();
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const handlers = useRef<Set<DropHandler>>(new Set());
  const dragRef = useRef<DragPayload | null>(null);

  const registerDrop = useCallback((fn: DropHandler) => {
    handlers.current.add(fn);
    return () => { handlers.current.delete(fn); };
  }, []);

  const startDrag = useCallback((e: React.PointerEvent, payload: DragPayload) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = payload;
    setDragging(payload);
    setPos(toLogical(e.clientX, e.clientY));
  }, [toLogical]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();
      setPos(toLogical(e.clientX, e.clientY));
    };
    const up = (e: PointerEvent) => {
      const p = dragRef.current;
      if (!p) return;
      dragRef.current = null;
      setDragging(null);
      const els = document.elementsFromPoint(e.clientX, e.clientY);
      let dropId: string | null = null;
      for (const el of els) {
        const id = (el as HTMLElement).dataset?.drop;
        if (id) { dropId = id; break; }
      }
      const lp = toLogical(e.clientX, e.clientY);
      for (const h of Array.from(handlers.current)) {
        if (h(p, dropId, lp)) break;
      }
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [toLogical]);

  return (
    <DragContext.Provider value={{ dragging, startDrag, registerDrop }}>
      {children}
      {dragging && (
        <div
          className="absolute pointer-events-none"
          style={{ left: pos.x - dragging.size / 2, top: pos.y - dragging.size / 2, zIndex: 1000, filter: 'drop-shadow(0 8px 6px rgba(0,0,0,0.45))' }}
        >
          <Sprite src={atlas[dragging.atlas]} frame={dragging.frame} size={dragging.size} style={{ transform: 'scale(1.1) rotate(-6deg)' }} />
        </div>
      )}
    </DragContext.Provider>
  );
}
