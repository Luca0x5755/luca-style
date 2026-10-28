// 專案強調色的角色推算（PR-STYLE-32、33、45、46、47）。
// 唯一一份：build.mjs 在建置時算套系預設色的滑過、按下與焦點框；ThemeProvider 在執行時算專案強調色；
// ISSUE-005 的設計檔匯入腳本也要從這裡 import，不另寫一份。純函式，不碰 DOM，不依賴任何套件。

// 現有文字對比門檻（§5.5.2）與焦點框門檻（PR-STYLE-46）。
const textContrast = 4.5;
const focusContrast = 3;
// 滑過、按下的 OKLCH 明度位移（PR-STYLE-45）；不過門檻時以 step 為步距沿同方向繼續。
const hoverShift = 0.05;
const pressedShift = 0.10;
const step = 0.01;
// 沒給暗黑主色、柔和底色時的目標明度，取自兩套系人工設計值（暗黑主色約 0.75，柔和底色約 0.95／0.30）。
const darkAccentLightness = 0.75;
const softLightness = { light: 0.95, dark: 0.30 };
const softChromaLimit = 0.035;

// sRGB 與 OKLab 互轉，矩陣取自 Björn Ottosson 的 OKLab 定義。
const toLinear = channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
const fromLinear = channel => channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;

function hexToRgb(hex) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) throw new Error(`強調色須為 #RRGGBB：${hex}`);
  return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
}

function toOklch(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return { l: L, c: Math.hypot(A, B), h: Math.atan2(B, A) };
}

function oklchToLinear({ l: L, c, h }) {
  const A = c * Math.cos(h), B = c * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076956384 * s,
  ];
}

const inGamut = rgb => rgb.every(channel => channel >= -1e-6 && channel <= 1 + 1e-6);

// 明度、色相固定，超出 sRGB 時以二分搜尋降低彩度，色相不變。
function toHex(color) {
  const l = Math.min(1, Math.max(0, color.l));
  let rgb = oklchToLinear({ ...color, l });
  if (!inGamut(rgb)) {
    let low = 0, high = color.c;
    for (let i = 0; i < 24; i++) {
      const middle = (low + high) / 2;
      if (inGamut(oklchToLinear({ ...color, l, c: middle }))) low = middle; else high = middle;
    }
    rgb = oklchToLinear({ ...color, l, c: low });
  }
  return '#' + rgb.map(channel => Math.round(fromLinear(Math.min(1, Math.max(0, channel))) * 255)
    .toString(16).padStart(2, '0')).join('').toUpperCase();
}

const luminance = hex => {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

// 8-bit 量化造成的明度誤差容忍值；接近黑色時一個色階就超過 0.05，須確認量化後真的到位。
const quantization = 0.005;

// 從 start 明度開始，沿 direction 每次 step 移動，回傳第一個「量化後明度已到 start」且通過 passes 的色；
// 到 0 或 1 仍不過就回傳端點。回傳的 l 是量化後的實際明度。
function walk(color, start, direction, passes) {
  for (let l = start; ; l += direction * step) {
    const bounded = Math.min(1, Math.max(0, l));
    const hex = toHex({ ...color, l: bounded });
    const actual = toOklch(hex).l;
    const reached = direction * (actual - start) >= -quantization;
    if ((reached && passes(hex)) || bounded === 0 || bounded === 1) return { hex, l: actual };
  }
}

/**
 * 依明暗模式推算強調色的整組角色。
 * @param {{light:string; dark?:string; secondary?:string; soft?:{light?:string; dark?:string}}} input
 * @param {'light'|'dark'} mode
 * @param {{bg:string; surface:string; 'surface-subtle':string; text:string; muted:string; 'accent-ink':string}} neutrals 該模式的中性色
 */
export function deriveAccent(input, mode, neutrals) {
  const ink = neutrals['accent-ink'];
  // 推算出的填色角色：上面的 accent-ink 與它當文字放在 bg、surface 上都要過文字門檻。
  const fillPasses = hex => [ink, neutrals.bg, neutrals.surface].every(other => contrast(hex, other) >= textContrast);
  // 日間變深、暗黑變亮（PR-STYLE-45）。
  const direction = mode === 'light' ? -1 : 1;

  let accent = mode === 'light' ? input.light : input.dark;
  if (!accent) {
    // 沒給暗黑主色：色相、彩度同日間主色，明度至少為套系暗黑主色的水準，不過門檻再加亮。
    const light = toOklch(input.light);
    accent = walk(light, Math.max(light.l, darkAccentLightness), 1, fillPasses).hex;
  }
  const base = toOklch(accent);

  // 該方向沒有空間容納按下位移時（極暗的日間主色、極亮的暗黑主色）改為反向，維持可見的回饋（decision-log）。
  const room = direction < 0 ? base.l - pressedShift : 1 - base.l - pressedShift;
  const shiftDirection = room < 0 ? -direction : direction;
  const hover = walk(base, base.l + shiftDirection * hoverShift, shiftDirection, fillPasses);
  // 按下至少位移 0.10，且至少比滑過多 0.05，維持按下幅度大於滑過。
  const pressedStart = shiftDirection < 0
    ? Math.min(base.l - pressedShift, hover.l - hoverShift)
    : Math.max(base.l + pressedShift, hover.l + hoverShift);
  const pressed = walk(base, pressedStart, shiftDirection, fillPasses);

  let soft = input.soft?.[mode];
  if (!soft) {
    // 沒給柔和底色：同色相、低彩度，日間淺、暗黑深；文字與次要文字疊在上面都要過門檻。
    const softPasses = hex => contrast(neutrals.text, hex) >= textContrast && contrast(neutrals.muted, hex) >= textContrast;
    soft = walk({ ...base, c: Math.min(base.c, softChromaLimit) }, softLightness[mode], -direction, softPasses).hex;
  }

  // 焦點框外圈一般就是主色；與任一可能的底色不到 3:1 時才沿模式方向位移（decision-log）。
  const focusPasses = hex => [neutrals.bg, neutrals.surface, neutrals['surface-subtle']].every(other => contrast(hex, other) >= focusContrast);
  const focusRing = focusPasses(accent) ? accent : walk(base, base.l, direction, focusPasses).hex;

  return {
    accent,
    // 沒給點綴色時沿用該模式的主色，不產生新色相（PR-STYLE-47）。
    'accent-secondary': input.secondary ?? accent,
    'accent-soft': soft,
    'accent-hover': hover.hex,
    'accent-pressed': pressed.hex,
    'focus-ring': focusRing,
  };
}
