import {useState} from 'react';
import {ContentState} from '@luca-style/react';
import {withBase} from './routes';

type SampleState = 'success' | 'loading' | 'empty' | 'error';

// 四態文案與 components.pen 的 NotFound/* frame 一致；以標題呈現整句，說明留空。
const stateTitles = {
  loading: '正在確認這個網址對應的頁面。',
  empty: '這個網址沒有可顯示的內容，可以先回到設計系統入口。',
  error: '頁面內容無法載入。請重試，或回到設計系統入口。',
};

export function NotFound({path}: {path: string}) {
  const [state, setState] = useState<SampleState>('success');
  return <div className="editorial-page not-found-page">
    <h1>找不到這個頁面</h1>
    <p className="description">網址 {path} 沒有對應的頁面。請回到設計系統入口，其他頁面也可從導覽進入。</p>
    <label className="sample-control">樣張狀態<select value={state} onChange={e => setState(e.target.value as SampleState)}><option value="success">Success · 正常內容</option><option value="loading">Loading · 載入中</option><option value="empty">Empty · 尚無內容</option><option value="error">Error · 載入失敗</option></select></label>
    <div><a className="not-found-action" href={withBase('/')}>返回設計系統入口</a></div>
    {state === 'success'
      ? <p>先回到入口，再選擇要檢視的設計基礎、元件或範本。</p>
      : <ContentState state={state} title={stateTitles[state]} description="" onRetry={() => setState('success')}/>}
  </div>;
}
