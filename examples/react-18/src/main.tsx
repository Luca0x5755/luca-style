// PR-ADOPT-02：React 18 乾淨專案，依序操作每個公開元件。
import {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Button, Checkbox, ContentState, DataTable, MetricCard, Navigation, Select, StatusMessage, TextField, ThemeProvider, useTheme} from '@luca-style/react';
import '@luca-style/tokens/css';
import '@luca-style/react/fonts.css';
import '@luca-style/react/css';
import {RouterLink} from './router-link';

const items = [{label: '首頁', href: '/'}, {label: '其他頁', href: '/other'}];
const rows = [{name: '甲', amount: '1,200'}, {name: '乙', amount: '860'}];

function usePath() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const sync = () => setPath(location.pathname);
    addEventListener('popstate', sync);
    return () => removeEventListener('popstate', sync);
  }, []);
  return path;
}

function ModeButton() {
  const {resolvedMode, setMode} = useTheme();
  return <Button variant="secondary" onClick={() => setMode(resolvedMode === 'dark' ? 'light' : 'dark')}>切換明暗</Button>;
}

function App() {
  const path = usePath();
  const [clicks, setClicks] = useState(0);
  const [retries, setRetries] = useState(0);
  const [fruit, setFruit] = useState('apple');
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState('');
  return <ThemeProvider suite="professional" target="document">
    <Navigation items={items} currentPath={path} renderLink={props => <RouterLink {...props}/>}/>
    <main>
      <h1>{path === '/' ? '首頁' : '其他頁'}</h1>
      <Button render={<RouterLink href={path === '/' ? '/other' : '/'}/>}>切換頁面</Button>
      <Button onClick={() => setClicks(clicks + 1)}>點擊</Button>
      <ModeButton/>
      <TextField label="名稱" value={name} onChange={event => setName(event.target.value)}/>
      <Select label="水果" value={fruit} onChange={event => setFruit(event.target.value)}><option value="apple">蘋果</option><option value="pear">梨子</option></Select>
      <Checkbox label="同意條款" checked={agreed} onChange={event => setAgreed(event.target.checked)}/>
      <Checkbox label="隱藏標籤的勾選" hideLabel/>
      <StatusMessage tone="success">{`點擊 ${clicks} 次，重試 ${retries} 次，水果 ${fruit}，${agreed ? '已同意' : '未同意'}，名稱 ${name}`}</StatusMessage>
      <ContentState state="error" onRetry={() => setRetries(retries + 1)}/>
      <MetricCard label="營收" value="1,200"/>
      <DataTable caption="訂單" columns={[{key: 'name', heading: '名稱', render: row => row.name}, {key: 'amount', heading: '金額', render: row => row.amount}]} rows={rows} rowKey={row => row.name}/>
    </main>
  </ThemeProvider>;
}

createRoot(document.getElementById('root')!).render(<App/>);
