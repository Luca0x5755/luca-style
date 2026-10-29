// 讀 PNG 的像素顏色與設計變數的頁面底色，供截圖檢查共用（verify-screenshots.mjs、tests/visual-config.spec.ts、
// scripts/design/import-accent.test.js）。
// 只支援 Chromium 截圖的格式：8 位元、非交錯的 RGB 或 RGBA；其他格式直接丟錯，不猜。只用 node:zlib，不加依賴。
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const root = new URL('../', import.meta.url);

// 解碼整張圖（傳入路徑或已讀出的 Buffer）；回傳寬高、pixel(x, y) → '#RRGGBB'（不含 alpha）與 alpha(x, y) → 0–255（RGB 圖恆為 255）。
export function readPng(source, path = typeof source === 'string' ? source : 'PNG') {
  const bytes = typeof source === 'string' ? readFileSync(source) : source;
  if (bytes.toString('latin1', 1, 4) !== 'PNG') throw new Error(`${path} 不是 PNG`);
  let offset = 8, width = 0, height = 0, channels = 0;
  const idat = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('latin1', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const [depth, colorType, , , interlace] = data.subarray(8, 13);
      channels = { 2: 3, 6: 4 }[colorType] ?? 0;
      if (depth !== 8 || !channels || interlace !== 0) throw new Error(`${path} 不是 8 位元、非交錯的 RGB／RGBA PNG`);
    }
    if (type === 'IDAT') idat.push(data);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let p = 0;
  // 逐列反做濾波（None、Sub、Up、Average、Paeth）。
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    for (let x = 0; x < stride; x++) {
      const value = raw[p++];
      const left = x >= channels ? out[y * stride + x - channels] : 0;
      const up = y ? out[(y - 1) * stride + x] : 0;
      const upLeft = x >= channels && y ? out[(y - 1) * stride + x - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = (left + up) >> 1;
      else if (filter === 4) {
        const base = left + up - upLeft;
        const pa = Math.abs(base - left), pb = Math.abs(base - up), pc = Math.abs(base - upLeft);
        predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      } else if (filter !== 0) throw new Error(`${path} 第 ${y} 列的濾波類型 ${filter} 不合法`);
      out[y * stride + x] = (value + predictor) & 255;
    }
  }
  const pixel = (x, y) => {
    if (!(x >= 0 && y >= 0 && x < width && y < height)) throw new Error(`${path} 沒有座標 (${x}, ${y})，尺寸為 ${width}×${height}`);
    const at = y * stride + x * channels;
    return '#' + [out[at], out[at + 1], out[at + 2]].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  const alpha = (x, y) => (channels === 4 ? out[y * stride + x * channels + 3] : 255);
  return { width, height, pixel, alpha };
}

// 該明暗模式的頁面底色，取自 DTCG 原始檔；不是 #RRGGBB（大寫）就丟錯，不拿格式錯的值去比對。
export function expectedBg(mode) {
  const source = `packages/tokens/src/mode/${mode}.tokens.json`;
  const value = JSON.parse(readFileSync(new URL(source, root), 'utf8')).bg?.$value;
  if (typeof value !== 'string' || !/^#[0-9A-F]{6}$/.test(value)) throw new Error(`${source} 的 bg.$value 應為 #RRGGBB，實際為 ${JSON.stringify(value)}`);
  return value;
}
