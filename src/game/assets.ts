// 에셋 로더: 마젠타(#FF00FF) 크로마키 제거 + 가장자리 분홍 테두리(fringe) 제거
export type AtlasKey =
  | 'toad'
  | 'customers'
  | 'food'
  | 'ingredients'
  | 'equipment'
  | 'ui'
  | 'fx';

export type BgKey = 'title' | 'kitchen' | 'dayEnd';

const GRID_N = 4;

/** 잘라낸 개별 프레임: url + 원래 칸 기준 상대 위치/크기 */
export interface FrameInfo { url: string; rx: number; ry: number; rw: number; rh: number }
export interface AtlasData {
  frames: FrameInfo[];
  mode: 'fit' | 'cell'; // fit: 상자에 꽉 맞춤(음식/UI), cell: 프레임 간 일관 배율+하단 정렬(캐릭터)
  k: number;
}

export interface LoadedAssets {
  atlas: Record<AtlasKey, AtlasData>;
  bg: Record<BgKey, string>;
}

const ATLAS_SRC: Record<AtlasKey, string> = {
  toad: 'img/toad_atlas.png',
  customers: 'img/customers_atlas.png',
  food: 'img/food_atlas.png',
  ingredients: 'img/ingredients_atlas.png',
  equipment: 'img/equipment_atlas.png',
  ui: 'img/ui_atlas.png',
  fx: 'img/fx_atlas.png',
};

const BG_SRC: Record<BgKey, string> = {
  title: 'img/title.jpg',
  kitchen: 'img/kitchen_bg.jpg',
  dayEnd: 'img/day_end.jpg',
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지 로드 실패: ' + src));
    img.src = src;
  });
}

/**
 * 크로마키 제거.
 * 1) 마젠타와의 색 거리 기반으로 알파 계산 (JPEG 압축 노이즈 허용)
 * 2) 반투명 픽셀은 마젠타 성분을 역보정(un-premultiply)하여 분홍 테두리 제거
 * 3) 가장자리 픽셀 중 여전히 분홍기가 강한 픽셀은 주변 불투명 색으로 교체
 */
function chromaKey(img: HTMLImageElement): HTMLCanvasElement {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;

  const KR = 255, KG = 0, KB = 255;
  const HARD = 95; // 이 거리 이하는 완전 투명
  const SOFT = 175; // 이 거리 이상은 완전 불투명

  const alpha = new Float32Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    // 마젠타 성격: r,b 높고 g 낮음
    const dr = r - KR, dg = g - KG, db = b - KB;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    // 후보 조건: 마젠타 계열(빨강/파랑 높고 초록 매우 낮음)인 픽셀만 키 대상
    const m = Math.min(r, b);
    const candidate = m > 110 && g < 0.55 * m;
    let a: number;
    if (!candidate) a = 1;
    else if (dist <= HARD) a = 0;
    else if (dist >= SOFT) a = 1;
    else a = (dist - HARD) / (SOFT - HARD);
    // 추가: 분홍빛(마젠타 계열)인데 채도가 있는 경우 (r,b가 g보다 크게 높음)
    const pinkness = Math.min(r, b) - g;
    if (a > 0 && a < 1 && pinkness > 90) a *= 0.5;
    alpha[p] = a;
  }

  // 반투명 픽셀 언프리멀티플라이: c = (c - (1-a)*key)/a
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const a = alpha[p];
    if (a <= 0) {
      d[i + 3] = 0;
      continue;
    }
    if (a < 1) {
      const inv = 1 - a;
      let r = (d[i] - inv * KR) / a;
      let g = (d[i + 1] - inv * KG) / a;
      let b = (d[i + 2] - inv * KB) / a;
      r = Math.max(0, Math.min(255, r));
      g = Math.max(0, Math.min(255, g));
      b = Math.max(0, Math.min(255, b));
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
    d[i + 3] = Math.round(a * 255);
  }

  // 가장자리 디프린지: 투명 픽셀 인접 + 분홍기 남은 픽셀은 이웃 불투명 평균색으로 교체
  const copy = new Uint8ClampedArray(d);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      const i = p * 4;
      if (copy[i + 3] === 0) continue;
      const r = copy[i], g = copy[i + 1], b = copy[i + 2];
      const pink = Math.min(r, b) - g;
      if (pink < 60 && copy[i + 3] === 255) continue;
      // 이웃 중 투명 픽셀 있는지
      let nearTransparent = false;
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const q = ((y + dy) * w + (x + dx)) * 4;
          if (copy[q + 3] === 0) nearTransparent = true;
          else if (copy[q + 3] === 255 && Math.min(copy[q], copy[q + 2]) - copy[q + 1] < 60) {
            sr += copy[q]; sg += copy[q + 1]; sb += copy[q + 2]; n++;
          }
        }
      }
      if (nearTransparent && pink >= 60) {
        if (n > 0) {
          d[i] = sr / n; d[i + 1] = sg / n; d[i + 2] = sb / n;
        } else {
          // 이웃 색 없으면 채도 제거
          const avg = (r + g + b) / 3;
          d[i] = avg * 0.6; d[i + 1] = avg * 0.5; d[i + 2] = avg * 0.6;
        }
        d[i + 3] = Math.min(d[i + 3], 200);
      }
    }
  }

  ctx.putImageData(id, 0, 0);
  return c;
}

function canvasToUrl(c: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve) => {
    c.toBlob((blob) => {
      if (blob) resolve(URL.createObjectURL(blob));
      else resolve(c.toDataURL('image/png'));
    }, 'image/png');
  });
}

/**
 * 아틀라스 자동 슬라이싱.
 * AI 생성 아틀라스는 4x4 칸에 정확히 맞지 않으므로
 * 1) 불투명 영역을 블록 단위 연결 요소(Connected Component)로 검출
 * 2) 각 덩어리를 중심점이 속한 칸에 배정 (여러 칸에 걸친 거대 덩어리는 칸 경계로 분할)
 * 3) 칸마다 소유 픽셀만 마스킹하여 타이트하게 잘라낸 개별 프레임 PNG 생성
 */
/**
 * 탕수육 접시에서 하얀 접시를 외곽선 탐색 및 색상 분리로 제거하고,
 * 튀김 덩어리의 울퉁불퉁한 실제 외곽선(실루엣)만 깔끔하게 추출.
 */
async function extractContouredChunks(sourceCanvas: HTMLCanvasElement): Promise<FrameInfo> {
  const w = sourceCanvas.width, h = sourceCanvas.height;
  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true })!;
  const src = ctx.getImageData(0, 0, w, h);
  const s = src.data;
  const n = w * h;

  // 원본 색 복사본 (최종 출력에 원본 음식 색을 유지하기 위함)
  const orig = new Uint8ClampedArray(s);

  const aAt = (p: number) => orig[p * 4 + 3];
  const rAt = (p: number) => orig[p * 4];
  const gAt = (p: number) => orig[p * 4 + 1];
  const bAt = (p: number) => orig[p * 4 + 2];
  const satAt = (p: number) => {
    const r = rAt(p), g = gAt(p), b = bAt(p);
    return Math.max(r, g, b) - Math.min(r, g, b);
  };
  const warmAt = (p: number) => rAt(p) - bAt(p);
  const lumAt = (p: number) => (rAt(p) * 299 + gAt(p) * 587 + bAt(p) * 114) / 1000;

  // 접시/그림자 여부: 흰색·회색·어두운 저채도·차가운 색
  const isPlateOrShadow = (p: number) => {
    if (aAt(p) < 40) return true;
    const r = rAt(p), b = bAt(p);
    const sat = satAt(p);
    const warm = warmAt(p);
    const lum = lumAt(p);
    // 흰 접시 / 밝은 회색 반사
    if (sat < 28 && lum > 145) return true;
    // 접시 그림자(어두운 회색/갈색 저채도)
    if (sat < 36 && lum < 140 && warm < 45) return true;
    // 차가운 회색/파란빛 가장자리
    if (b >= r - 8 && sat < 40) return true;
    // 거의 무채색
    if (sat < 18) return true;
    return false;
  };

  // 확실한 음식 색 (황금 튀김 / 주황 소스)
  const isFoodCore = (p: number) => {
    if (aAt(p) < 90) return false;
    if (isPlateOrShadow(p)) return false;
    const sat = satAt(p), warm = warmAt(p), lum = lumAt(p);
    // 주황/빨강 소스
    if (rAt(p) >= 100 && warm >= 35 && sat >= 40 && lum >= 55) return true;
    // 황금 튀김옷
    if (rAt(p) >= 80 && warm >= 28 && sat >= 36 && gAt(p) >= 40 && lum >= 60) return true;
    return false;
  };

  // 1) 가장자리에서 출발: 음식 코어가 아닌 픽셀(투명/접시/그림자)만 배경으로 확장
  const bg = new Uint8Array(n);
  const q: number[] = [];
  const tryPush = (p: number) => {
    if (p < 0 || p >= n || bg[p]) return;
    if (isFoodCore(p)) return; // 음식에서 정지
    bg[p] = 1;
    q.push(p);
  };
  for (let x = 0; x < w; x++) { tryPush(x); tryPush((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { tryPush(y * w); tryPush(y * w + w - 1); }
  for (let head = 0; head < q.length; head++) {
    const p = q[head], x = p % w, y = (p / w) | 0;
    if (x > 0) tryPush(p - 1);
    if (x < w - 1) tryPush(p + 1);
    if (y > 0) tryPush(p - w);
    if (y < h - 1) tryPush(p + w);
  }

  // 2) 음식 마스크 = 배경이 아닌 영역 중 접시/그림자가 아닌 것
  const mask = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    if (bg[p] || aAt(p) < 40) continue;
    if (isFoodCore(p) || !isPlateOrShadow(p)) mask[p] = 1;
  }

  // 3) 음식 코어 연결요소만 유지 (작은 잔여 제거)
  const label = new Int32Array(n).fill(-1);
  let cid = 0;
  const areas: number[] = [];
  const hasCore: boolean[] = [];
  for (let p = 0; p < n; p++) {
    if (!mask[p] || label[p] >= 0) continue;
    const st = [p];
    label[p] = cid;
    let area = 0, core = false;
    while (st.length) {
      const cur = st.pop()!;
      area++;
      if (isFoodCore(cur)) core = true;
      const x = cur % w, y = (cur / w) | 0;
      for (const np of [x > 0 ? cur - 1 : -1, x < w - 1 ? cur + 1 : -1, y > 0 ? cur - w : -1, y < h - 1 ? cur + w : -1]) {
        if (np >= 0 && mask[np] && label[np] < 0) { label[np] = cid; st.push(np); }
      }
    }
    areas[cid] = area;
    hasCore[cid] = core;
    cid++;
  }
  for (let p = 0; p < n; p++) {
    const id = label[p];
    if (id < 0 || areas[id] < 80 || !hasCore[id]) mask[p] = 0;
  }

  // 4) 내부 구멍 메우기: 마스크 바깥(가장자리 연결)이 아닌 내부 빈 공간을 채움
  const outsideHole = new Uint8Array(n);
  const hq: number[] = [];
  const pushHole = (p: number) => {
    if (p < 0 || p >= n || outsideHole[p] || mask[p]) return;
    outsideHole[p] = 1;
    hq.push(p);
  };
  for (let x = 0; x < w; x++) { pushHole(x); pushHole((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { pushHole(y * w); pushHole(y * w + w - 1); }
  for (let head = 0; head < hq.length; head++) {
    const p = hq[head], x = p % w, y = (p / w) | 0;
    if (x > 0) pushHole(p - 1);
    if (x < w - 1) pushHole(p + 1);
    if (y > 0) pushHole(p - w);
    if (y < h - 1) pushHole(p + w);
  }
  for (let p = 0; p < n; p++) {
    if (!mask[p] && !outsideHole[p]) mask[p] = 1; // 내부 구멍
  }

  // 5) 가장자리 잔여(접시/그림자 색) 1~2px 정리 — 내부는 건드리지 않음
  for (let pass = 0; pass < 2; pass++) {
    const snap = Uint8Array.from(mask);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (!snap[p]) continue;
      const edge = !snap[p - 1] || !snap[p + 1] || !snap[p - w] || !snap[p + w];
      if (edge && isPlateOrShadow(p)) mask[p] = 0;
    }
  }

  // 6) 다시 한 번 내부 구멍 메우기 (가장자리 정리 후 생길 수 있는 구멍 방지)
  outsideHole.fill(0);
  hq.length = 0;
  for (let x = 0; x < w; x++) { pushHole(x); pushHole((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { pushHole(y * w); pushHole(y * w + w - 1); }
  for (let head = 0; head < hq.length; head++) {
    const p = hq[head], x = p % w, y = (p / w) | 0;
    if (x > 0) pushHole(p - 1);
    if (x < w - 1) pushHole(p + 1);
    if (y > 0) pushHole(p - w);
    if (y < h - 1) pushHole(p + w);
  }
  for (let p = 0; p < n; p++) {
    if (!mask[p] && !outsideHole[p]) mask[p] = 1;
  }

  // 7) 최종 픽셀 기록: 마스크 안은 원본 색, 밖은 투명
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (mask[p]) {
      s[i] = orig[i]; s[i + 1] = orig[i + 1]; s[i + 2] = orig[i + 2]; s[i + 3] = 255;
    } else {
      s[i] = 0; s[i + 1] = 0; s[i + 2] = 0; s[i + 3] = 0;
    }
  }

  // 8) 외곽 검은 라인 (2px) — 마스크 바깥에만, 내부 구멍 없음
  const foodMask = Uint8Array.from(mask);
  for (let pass = 0; pass < 2; pass++) {
    const base = Uint8Array.from(foodMask);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (base[p]) continue;
      let touch = false;
      for (let dy = -1; dy <= 1 && !touch; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (base[(y + dy) * w + (x + dx)]) touch = true;
      }
      if (touch) {
        const i = p * 4;
        s[i] = 28; s[i + 1] = 16; s[i + 2] = 10; s[i + 3] = 255;
        foodMask[p] = 1;
      }
    }
  }

  // 9) 타이트 크롭
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (s[(y * w + x) * 4 + 3] > 20) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) {
    const fallbackUrl = await canvasToUrl(sourceCanvas);
    return { url: fallbackUrl, rx: 0, ry: 0, rw: 1, rh: 1 };
  }
  const pad = 3;
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(w - 1, maxX + pad) - cropX + 1;
  const cropH = Math.min(h - 1, maxY + pad) - cropY + 1;
  const cropped = document.createElement('canvas');
  cropped.width = cropW; cropped.height = cropH;
  const cctx = cropped.getContext('2d')!;
  const cd = cctx.createImageData(cropW, cropH);
  for (let y = 0; y < cropH; y++) for (let x = 0; x < cropW; x++) {
    const si = ((cropY + y) * w + (cropX + x)) * 4;
    const di = (y * cropW + x) * 4;
    cd.data[di] = s[si]; cd.data[di + 1] = s[si + 1];
    cd.data[di + 2] = s[si + 2]; cd.data[di + 3] = s[si + 3];
  }
  cctx.putImageData(cd, 0, 0);
  const url = await canvasToUrl(cropped);
  return { url, rx: cropX / w, ry: cropY / h, rw: cropW / w, rh: cropH / h };
}

async function sliceAtlas(c: HTMLCanvasElement, mode: 'fit' | 'cell', atlasKey?: AtlasKey): Promise<AtlasData> {
  const w = c.width, h = c.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const src = ctx.getImageData(0, 0, w, h).data;
  const B = 4;
  const gw = Math.ceil(w / B), gh = Math.ceil(h / B);
  const cellW = w / GRID_N, cellH = h / GRID_N;

  // 블록 점유 맵
  const occ = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let cnt = 0;
      for (let yy = 0; yy < B; yy += 2) for (let xx = 0; xx < B; xx += 2) {
        const x = gx * B + xx, y = gy * B + yy;
        if (x < w && y < h && src[(y * w + x) * 4 + 3] > 60) cnt++;
      }
      if (cnt >= 2) occ[gy * gw + gx] = 1;
    }
  }
  const cellOfBlock = (gx: number, gy: number) => {
    const col = Math.min(GRID_N - 1, Math.floor((gx * B + B / 2) / cellW));
    const row = Math.min(GRID_N - 1, Math.floor((gy * B + B / 2) / cellH));
    return row * GRID_N + col;
  };

  // 연결 요소 라벨링 (8방향)
  const owner = new Int16Array(gw * gh).fill(-1);
  const visited = new Uint8Array(gw * gh);
  const cellBlockArea = (cellW / B) * (cellH / B);
  const minCount = Math.max(10, cellBlockArea * 0.004);
  const stack: number[] = [];
  const members: number[] = [];
  for (let i = 0; i < occ.length; i++) {
    if (!occ[i] || visited[i]) continue;
    members.length = 0;
    stack.push(i); visited[i] = 1;
    let sx = 0, sy = 0;
    while (stack.length) {
      const b = stack.pop()!;
      members.push(b);
      const bx = b % gw, by = (b - bx) / gw;
      sx += bx; sy += by;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = bx + dx, ny = by + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const n = ny * gw + nx;
        if (occ[n] && !visited[n]) { visited[n] = 1; stack.push(n); }
      }
    }
    if (members.length < minCount) continue; // 잡티 제거
    const cx = sx / members.length, cy = sy / members.length;
    const home = cellOfBlock(Math.round(cx), Math.round(cy));
    let inHome = 0;
    for (const b of members) { const bx = b % gw; if (cellOfBlock(bx, (b - bx) / gw) === home) inHome++; }
    const whole = inHome / members.length > 0.8 && members.length < cellBlockArea * 1.6;
    for (const b of members) {
      const bx = b % gw;
      owner[b] = whole ? home : cellOfBlock(bx, (b - bx) / gw);
    }
  }
  // 1블록 팽창: 안티앨리어싱 가장자리 픽셀 보존
  const owner2 = new Int16Array(owner);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const i = gy * gw + gx;
    if (owner[i] >= 0) continue;
    for (let dy = -1; dy <= 1 && owner2[i] < 0; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = gx + dx, ny = gy + dy;
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
      const o = owner[ny * gw + nx];
      if (o >= 0) { owner2[i] = o; break; }
    }
  }

  // 칸별 바운딩 박스
  const N = GRID_N * GRID_N;
  const minX = new Array(N).fill(Infinity), minY = new Array(N).fill(Infinity);
  const maxX = new Array(N).fill(-1), maxY = new Array(N).fill(-1);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const o = owner[gy * gw + gx];
    if (o < 0) continue;
    if (gx < minX[o]) minX[o] = gx; if (gx > maxX[o]) maxX[o] = gx;
    if (gy < minY[o]) minY[o] = gy; if (gy > maxY[o]) maxY[o] = gy;
  }

  const frames: FrameInfo[] = [];
  let canvas3: HTMLCanvasElement | null = null;
  let canvas7: HTMLCanvasElement | null = null;

  for (let f = 0; f < N; f++) {
    const col = f % GRID_N, row = Math.floor(f / GRID_N);
    const cellX = col * cellW, cellY = row * cellH;
    let x0: number, y0: number, x1: number, y1: number;
    const found = maxX[f] >= 0;
    if (found) {
      x0 = Math.max(0, (minX[f] - 1) * B); y0 = Math.max(0, (minY[f] - 1) * B);
      x1 = Math.min(w, (maxX[f] + 2) * B); y1 = Math.min(h, (maxY[f] + 2) * B);
    } else {
      x0 = Math.round(cellX); y0 = Math.round(cellY); x1 = Math.round(cellX + cellW); y1 = Math.round(cellY + cellH);
    }
    const fw = Math.max(1, x1 - x0), fh = Math.max(1, y1 - y0);
    const out = document.createElement('canvas');
    out.width = fw; out.height = fh;
    const octx = out.getContext('2d')!;
    const od = octx.createImageData(fw, fh);
    for (let y = 0; y < fh; y++) {
      const sy = y + y0;
      const gy = (sy / B) | 0;
      for (let x = 0; x < fw; x++) {
        const sx = x + x0;
        const gx = (sx / B) | 0;
        if (found && owner2[gy * gw + gx] !== f) continue;
        const si = (sy * w + sx) * 4, di = (y * fw + x) * 4;
        od.data[di] = src[si]; od.data[di + 1] = src[si + 1]; od.data[di + 2] = src[si + 2]; od.data[di + 3] = src[si + 3];
      }
    }
    octx.putImageData(od, 0, 0);
    if (atlasKey === 'food') {
      if (f === 3) canvas3 = out;
      if (f === 7) canvas7 = out;
    }
    const url = await canvasToUrl(out);
    frames.push({ url, rx: (x0 - cellX) / cellW, ry: (y0 - cellY) / cellH, rw: fw / cellW, rh: fh / cellH });
  }

  // food 아틀라스의 경우 하얀 접시를 크로마키/외곽선 분리로 제거한 튀김 단독 프레임 2개 추가
  if (atlasKey === 'food' && canvas7 && canvas3) {
    // frame 16: friedChunks (접시 없는 순수 튀김 실루엣)
    const friedChunks = await extractContouredChunks(canvas7);
    frames.push(friedChunks);
    // frame 17: tangsuyukChunks (접시 없는 소스 탕수육 실루엣)
    const tangsuyukChunks = await extractContouredChunks(canvas3);
    frames.push(tangsuyukChunks);
  }

  // cell 모드: 프레임 간 크기 일관성 유지용 공통 배율 (상위 75% 크기 기준)
  const dims = frames.slice(0, N).map((fr) => Math.max(fr.rw, fr.rh)).sort((a, b) => a - b);
  const ref = dims[Math.floor(0.75 * (dims.length - 1))] || 1;
  const k = Math.min(1.7, Math.max(1, 1 / ref));
  return { frames, mode, k };
}

export async function loadAllAssets(onProgress?: (p: number) => void): Promise<LoadedAssets> {
  const atlasKeys = Object.keys(ATLAS_SRC) as AtlasKey[];
  const bgKeys = Object.keys(BG_SRC) as BgKey[];
  const total = atlasKeys.length + bgKeys.length;
  let done = 0;
  const tick = () => { done++; onProgress?.(done / total); };

  const atlasEntries = await Promise.all(
    atlasKeys.map(async (k) => {
      const img = await loadImage(ATLAS_SRC[k]);
      const c = chromaKey(img);
      const data = await sliceAtlas(c, k === 'toad' || k === 'customers' ? 'cell' : 'fit', k);
      tick();
      return [k, data] as const;
    })
  );
  const bgEntries = await Promise.all(
    bgKeys.map(async (k) => {
      await loadImage(BG_SRC[k]);
      tick();
      return [k, BG_SRC[k]] as const;
    })
  );
  return {
    atlas: Object.fromEntries(atlasEntries) as Record<AtlasKey, AtlasData>,
    bg: Object.fromEntries(bgEntries) as Record<BgKey, string>,
  };
}
