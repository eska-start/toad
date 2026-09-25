import { createContext, useContext } from 'react';
import type { LoadedAssets } from './assets';

export const AssetContext = createContext<LoadedAssets | null>(null);

export function useAssets(): LoadedAssets {
  const a = useContext(AssetContext);
  if (!a) throw new Error('AssetContext 없음');
  return a;
}
