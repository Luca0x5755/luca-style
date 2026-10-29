import { test, expect, type Page } from '@playwright/test';
import { deriveAccent, type AccentRoles } from '../packages/tokens/accent.js';
import { hexChannels, neutralsOf, wcagContrast } from './tokens-helpers';

// PR-STYLE-32、33、45、47：專案強調色的推算規則，只透過 deriveAccent 的輸出觀察。
// OKLCH 由瀏覽器的 CSS 相對色彩語法換算，不用被測程式的轉換，避免同一份算式自己驗自己。

type Mode = 'light' | 'dark';
type Oklch = { l: number; c: number; h: number };

async function oklchOf(page: Page, colors: string[]): Promise<Oklch[]> {
  return page.evaluate(list => list.map(color => {
    const probe = document.createElement('div');
    probe.style.color = `oklch(from ${color} l c h)`;
    document.body.append(probe);
    const [l, c, h] = getComputedStyle(probe).color.match(/[\d.]+/g)!.map(Number);
    probe.remove();
    return { l, c, h };
  }), colors);
}

const contrast = (a: string, b: string) => wcagContrast(hexChannels(a), hexChannels(b));

const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

// 中段色：位移後不需補正，滑過、按下應剛好是 0.05、0.10（8-bit 量化誤差 0.005 內）。
const midRange: Record<Mode, string[]> = {
  light: ['#147F82', '#625C83', '#9A4C32'],
  dark: ['#64C2BC', '#ABA4D7', '#E8A18B'],
};

for (const mode of ['light', 'dark'] as const) {
  test(`${mode} hover and pressed shift OKLCH lightness by exactly 0.05 and 0.10 for mid-range primaries, keeping hue`, async ({ page }) => {
    const neutrals = await neutralsOf(mode);
    const direction = mode === 'light' ? -1 : 1;
    for (const primary of midRange[mode]) {
      const roles = deriveAccent(mode === 'light' ? { light: primary } : { light: '#000000', dark: primary }, mode, neutrals);
      const [base, hover, pressed] = await oklchOf(page, [primary, roles['accent-hover'], roles['accent-pressed']]);
      expect(Math.abs(hover.l - base.l - direction * 0.05), `${primary} hover`).toBeLessThan(0.005);
      expect(Math.abs(pressed.l - base.l - direction * 0.10), `${primary} pressed`).toBeLessThan(0.005);
      expect(hueGap(hover.h, base.h), `${primary} hover hue`).toBeLessThan(2);
      expect(hueGap(pressed.h, base.h), `${primary} pressed hue`).toBeLessThan(2);
    }
  });
}

// PR-STYLE-33：多組強調色（含極亮、極暗）只給日間主色，推算出的角色在兩種模式都過門檻。
// 套系的人工設計值不在此列（decision-log：例如 vibrant/light #147F82 對 bg 約 4.45:1，維持不變）。
const samples = ['#147F82', '#625C83', '#9A4C32', '#FFFFFF', '#000000', '#FFFF00', '#F5F5F5', '#111111', '#00FF00', '#0000FF', '#FF0000', '#808080'];

for (const mode of ['light', 'dark'] as const) {
  test(`${mode}: every derived role passes the text and focus contrast thresholds for extreme and ordinary primaries`, async () => {
    const neutrals = await neutralsOf(mode);
    const problems: string[] = [];
    const check = (primary: string, pair: string, ratio: number, floor: number) => {
      if (ratio < floor) problems.push(`${primary} ${pair}: ${ratio.toFixed(2)} < ${floor}`);
    };
    for (const primary of samples) {
      const roles = deriveAccent({ light: primary }, mode, neutrals);
      const fills: (keyof AccentRoles)[] = ['accent-hover', 'accent-pressed', ...(mode === 'dark' ? ['accent' as const] : [])];
      for (const role of fills) {
        check(primary, `accent-ink on ${role}`, contrast(neutrals['accent-ink'], roles[role]), 4.5);
        check(primary, `${role} on bg`, contrast(roles[role], neutrals.bg), 4.5);
        check(primary, `${role} on surface`, contrast(roles[role], neutrals.surface), 4.5);
      }
      check(primary, 'text on accent-soft', contrast(neutrals.text, roles['accent-soft']), 4.5);
      check(primary, 'muted on accent-soft', contrast(neutrals.muted, roles['accent-soft']), 4.5);
      for (const background of ['bg', 'surface', 'surface-subtle'] as const) {
        check(primary, `focus-ring on ${background}`, contrast(roles['focus-ring'], neutrals[background]), 3);
      }
    }
    expect(problems).toEqual([]);
  });
}

test('a hover shift that falls short of the threshold keeps darkening until it passes, and pressed stays further than hover', async ({ page }) => {
  const neutrals = await neutralsOf('light');
  // 亮黃 L≈0.97：位移 0.05 後白字對比仍遠低於 4.5。
  const primary = '#FFFF00';
  const roles = deriveAccent({ light: primary }, 'light', neutrals);
  expect(contrast(neutrals['accent-ink'], roles['accent-hover'])).toBeGreaterThanOrEqual(4.5);
  const [base, hover, pressed] = await oklchOf(page, [primary, roles['accent-hover'], roles['accent-pressed']]);
  expect(base.l - hover.l).toBeGreaterThan(0.05 + 0.005);
  expect(base.l - pressed.l).toBeGreaterThanOrEqual(base.l - hover.l + 0.05 - 0.005);
  expect(hueGap(hover.h, base.h)).toBeLessThan(2);
});

test('with no room in the mode direction, hover and pressed shift the other way and pressed still moves further', async ({ page }) => {
  // 黑色無法再加深（日間）、白色無法再加亮（暗黑）：改為反向（decision-log）。
  for (const [mode, primary, direction] of [['light', '#000000', 1], ['dark', '#FFFFFF', -1]] as const) {
    const roles = deriveAccent(mode === 'light' ? { light: primary } : { light: '#147F82', dark: primary }, mode, await neutralsOf(mode));
    const [base, hover, pressed] = await oklchOf(page, [primary, roles['accent-hover'], roles['accent-pressed']]);
    expect(direction * (hover.l - base.l), `${mode} hover`).toBeGreaterThanOrEqual(0.05 - 0.005);
    expect(direction * (pressed.l - base.l), `${mode} pressed`).toBeGreaterThan(direction * (hover.l - base.l));
  }
});

test('supplied dark, secondary and soft colours are used as given; a missing secondary follows the primary of each mode', async () => {
  const given = { light: '#9A4C32', dark: '#E8A18B', secondary: '#BD7454', soft: { light: '#F7F1EB', dark: '#382820' } };
  const light = deriveAccent(given, 'light', await neutralsOf('light'));
  const dark = deriveAccent(given, 'dark', await neutralsOf('dark'));
  expect([light.accent, light['accent-secondary'], light['accent-soft']]).toEqual(['#9A4C32', '#BD7454', '#F7F1EB']);
  expect([dark.accent, dark['accent-secondary'], dark['accent-soft']]).toEqual(['#E8A18B', '#BD7454', '#382820']);
  const onlyLight = { light: '#9A4C32' };
  expect(deriveAccent(onlyLight, 'light', await neutralsOf('light'))['accent-secondary']).toBe('#9A4C32');
  const derivedDark = deriveAccent(onlyLight, 'dark', await neutralsOf('dark'));
  expect(derivedDark['accent-secondary']).toBe(derivedDark.accent);
  expect(derivedDark.accent).not.toBe('#9A4C32');
});

test('a derived dark primary keeps the hue of the light primary and is lighter than it', async ({ page }) => {
  const roles = deriveAccent({ light: '#9A4C32' }, 'dark', await neutralsOf('dark'));
  const [light, dark] = await oklchOf(page, ['#9A4C32', roles.accent]);
  expect(dark.l).toBeGreaterThan(light.l);
  expect(hueGap(dark.h, light.h)).toBeLessThan(2);
});

test('the focus ring is the primary itself whenever the primary already reaches 3:1', async () => {
  for (const mode of ['light', 'dark'] as const) {
    const roles = deriveAccent({ light: '#147F82', dark: '#64C2BC' }, mode, await neutralsOf(mode));
    expect(roles['focus-ring']).toBe(roles.accent);
  }
});
