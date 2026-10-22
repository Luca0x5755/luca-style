import { readFile, mkdir, writeFile } from 'node:fs/promises';
const source = JSON.parse(await readFile(new URL('./src/tokens.json', import.meta.url), 'utf8'));
const themes = {};
const css = [];
const declarations = values => Object.entries(values).map(([name,value]) => `  --${name}: ${value};`).join('\n');
for (const [suite, values] of Object.entries(source.suites)) {
  themes[suite] = {};
  for(const [mode, colors] of Object.entries(source.modes)) {
    const theme = {...source.common, ...colors, ...values.common, ...values[mode]};
    themes[suite][mode] = theme;
    const selector = `[data-luca-theme][data-suite="${suite}"][data-mode="${mode}"]`;
    css.push(`${suite === 'vibrant' && mode === 'light' ? ':root, ' : ''}${selector} {\n${declarations(theme)}\n  color-scheme: ${mode};\n}`);
  }
}
const roleVariables = device => Object.fromEntries(Object.entries(source.typography).flatMap(([name, role]) => [
  [`type-${name}-size`, role[device]], [`type-${name}-weight`, role.weight], [`type-${name}-line-height`, role.lineHeight],
]));
css.push(`:root, [data-luca-theme] {\n${declarations(roleVariables('mobile'))}\n}`);
css.push(`@media(min-width:600px) { :root, [data-luca-theme] {\n${declarations(roleVariables('tablet'))}\n} }`);
css.push(`@media(min-width:1024px) { :root, [data-luca-theme] {\n${declarations(roleVariables('desktop'))}\n} }`);
const output = new URL('./dist/', import.meta.url);
await mkdir(output, {recursive:true});
await Promise.all([
  writeFile(new URL('css.d.ts', output), 'export {};\n'),
  writeFile(new URL('typography.json', output), JSON.stringify(source.typography, null, 2) + '\n'),
  writeFile(new URL('tokens.json', output), JSON.stringify(themes, null, 2) + '\n'),
  writeFile(new URL('tokens.css', output), css.join('\n') + '\n'),
]);
