import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {cp, mkdtemp, readdir, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
const root = fileURLToPath(new URL('../', import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run through npm run test:consumer');
const temporary = await mkdtemp(join(tmpdir(),'luca-consumer-'));
function npm(args,cwd) {
  const result=spawnSync(process.execPath,[npmCli,...args],{cwd,encoding:'utf8'});
  if(result.status!==0) throw new Error(`${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  console.log(result.stdout.trim());
}
let server;
let browser;
try {
  for(const name of ['tokens','react']) npm(['pack','--pack-destination',temporary],join(root,'packages',name));
  const consumer=join(temporary,'consumer');
  await cp(join(root,'examples','consumer'),consumer,{recursive:true,filter:source=>!['node_modules','dist'].includes(source.split(sep).at(-1))});
  const tarballs=(await readdir(temporary)).filter(name=>name.endsWith('.tgz')).map(name=>join(temporary,name));
  npm(['install','--no-audit','--no-fund',...tarballs],consumer);
  // tarball 須隨附 prepack 複製的 MIT 授權。
  for(const name of ['tokens','react']) assert.match(await readFile(join(consumer,'node_modules','@luca-style',name,'LICENSE'),'utf8'),/^MIT License/);
  npm(['run','build'],consumer);
  server=spawn(process.execPath,[join(consumer,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4174','--strictPort'],{cwd:consumer,stdio:'pipe'});
  await new Promise((done,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Consumer preview timed out')),15000);
    server.once('exit',code=>{clearTimeout(timer);reject(new Error(`Consumer preview exited ${code}`));});
    server.stdout.on('data',chunk=>{if(chunk.toString().includes('4174')) {clearTimeout(timer);done();}});
  });
  browser=await chromium.launch();
  const page=await browser.newPage({colorScheme:'light'});
  await page.goto('http://127.0.0.1:4174');
  // 自訂 brandHref 經公開匯入後須原樣出現在屬性中。
  assert.equal(await page.getByRole('navigation',{name:'子路徑導覽'}).locator('.luca-brand').getAttribute('href'),'/luca-style/');
  await page.getByRole('button',{name:'完成操作'}).click();
  assert.match(await page.getByRole('status').innerText(),/已完成 1 次/);
  // Select 是 Base UI 自訂選單（ISSUE-009），不能用 selectOption()：點欄位開啟，再點選項。
  const choose=async(label,option)=>{
    await page.getByLabel(label).click();
    const listbox=page.getByRole('listbox');
    await listbox.waitFor();
    // 選單 portal 到 ThemeProvider 的外層容器，主題屬性才套得到。
    const theme=await listbox.evaluate(element=>{const container=element.closest('[data-luca-theme]');return container && [container.getAttribute('data-suite'),container.getAttribute('data-mode')];});
    assert.ok(theme,`${label} 的選單不在主題容器內`);
    await listbox.getByRole('option',{name:option,exact:true}).click();
    await listbox.waitFor({state:'hidden'});
    return theme;
  };
  await choose('風格套系','精緻活力');
  // 開啟明暗選單時套系已切到 vibrant，選單所在容器同步顯示。
  assert.deepEqual(await choose('明暗模式','暗黑'),['vibrant','light']);
  await page.getByLabel('專案強調色').check();
  const theme=page.locator('[data-luca-theme]');
  assert.equal(await theme.getAttribute('data-suite'),'vibrant');
  assert.equal(await theme.getAttribute('data-mode'),'dark');
  const colors=await theme.evaluate(element=>{const s=getComputedStyle(element);return [s.getPropertyValue('--accent').trim(),s.getPropertyValue('--success').trim()];});
  // 範例只給日間主色，暗黑主色由 deriveAccent 推算。
  assert.deepEqual(colors.map(value=>value.toLowerCase()),['#7fb4e2','#7ed4ab']);
  await page.reload();
  assert.equal(await theme.getAttribute('data-mode'),'dark');
  for(const name of ['Inter 授權','Noto Sans TC 授權','IBM Plex Mono 授權']) {
    const url=await page.getByRole('link',{name,exact:true}).getAttribute('href');
    const response=await page.request.get(new URL(url,page.url()).href);
    assert.equal(response.status(),200);
    assert.match(await response.text(),/SIL OPEN FONT LICENSE/i);
  }
  assert.equal(await page.evaluate(async()=>{const faces=await Promise.all(['16px Inter','16px "Noto Sans TC"','16px "IBM Plex Mono"','600 16px "IBM Plex Mono"'].map(font=>document.fonts.load(font)));return faces.every(group=>group.length>0 && group.every(face=>face.status==='loaded'));}),true);
  console.log('PASS independent tarball consumer: install, public imports, typecheck, production build, theme/mode/accent/status, Select popup inside the theme container, fonts, font licenses and MIT license');
} finally {
  if(browser) await browser.close();
  if(server && server.exitCode===null) {const closed=new Promise(done=>server.once('exit',done));server.kill();await closed;}
  const path=resolve(temporary);
  assert.ok(path.startsWith(resolve(tmpdir())+sep) && path.split(sep).at(-1).startsWith('luca-consumer-'));
  await rm(path,{recursive:true,force:true});
}
