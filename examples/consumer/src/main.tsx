import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider, useTheme, Button, Select, Checkbox, StatusMessage, type StyleSuite} from '@luca-style/react';
import '@luca-style/tokens/css';
import '@luca-style/react/fonts.css';
import '@luca-style/react/css';
import themes from '@luca-style/tokens/data';
import typography from '@luca-style/tokens/typography';
import interLicense from '@luca-style/react/licenses/inter?url';
import notoLicense from '@luca-style/react/licenses/notosanstc?url';
import monoLicense from '@luca-style/react/licenses/ibmplexmono?url';
import './style.css';
function ModeControl() {
  const {mode, setMode} = useTheme();
  return <Select label="明暗模式" value={mode} onChange={event => setMode(event.target.value as typeof mode)}><option value="system">跟隨系統</option><option value="light">日間</option><option value="dark">暗黑</option></Select>;
}
function App() {
  const [suite,setSuite] = useState<StyleSuite>('professional');
  const [custom,setCustom] = useState(false);
  const [count,setCount] = useState(0);
  return <ThemeProvider suite={suite} accent={custom ? {primary:'#275A83',secondary:'#6995B8',soft:'#E7F0F7',ink:'#FFFFFF'} : undefined}>
    <main><h1>新專案接入範例</h1><p>公開資料包含 {Object.keys(themes).length} 套風格；正文角色：{typography.body.desktop}。</p>
      <Select label="風格套系" value={suite} onChange={event=>setSuite(event.target.value as StyleSuite)}><option value="vibrant">精緻活力</option><option value="professional">精緻專業</option></Select>
      <ModeControl/><Checkbox label="專案強調色" checked={custom} onChange={event=>setCustom(event.target.checked)}/>
      <Button onClick={()=>setCount(count+1)}>完成操作</Button><StatusMessage tone="success">已完成 {count} 次操作</StatusMessage>
      <p className="domain-signal">↑ 業務成長資料（藍），與成功回饋分開</p>
      <p className="mono">123,456</p>
      <footer><a href={interLicense}>Inter 授權</a> · <a href={notoLicense}>Noto Sans TC 授權</a> · <a href={monoLicense}>IBM Plex Mono 授權</a></footer>
    </main>
  </ThemeProvider>;
}
createRoot(document.getElementById('root')!).render(<App/>);
