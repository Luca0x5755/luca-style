import {ProductSamples} from './product';
import {Navigation} from '@luca-style/react';
import {withBase} from './routes';
import {useEffect,useRef,useState, type FormEvent} from 'react';
import {Button,TextField,Select,Checkbox,StatusMessage,ContentState} from '@luca-style/react';

export function Components() {
  const [state,setState]=useState('success');
  return <div className="components-page"><h1 className="page-title">共用元件</h1><p>讓每一次操作，都清楚而一致。</p>
    <label className="sample-control">樣張狀態<select value={state} onChange={e=>setState(e.target.value)}><option value="success">Success · 正常內容</option><option value="loading">Loading · 載入中</option><option value="empty">Empty · 尚無內容</option><option value="error">Error · 載入失敗</option></select></label>
    {state !== 'success' ? <ContentState state={state as 'loading'|'empty'|'error'} title={state === 'loading' ? '元件展示載入中' : state === 'empty' ? '目前沒有可顯示的元件' : '元件展示內容載入失敗'} onRetry={()=>setState('success')}/> : <>
      <section aria-labelledby="component-buttons"><h2 id="component-buttons">按鈕與互動</h2><p>移入滑鼠查看 hover，使用 Tab 查看焦點。</p><div className="component-grid">
        <div className="component-sample"><small>Primary / Default</small><Button>主要操作</Button></div><div className="component-sample"><small>Secondary / Default</small><Button variant="secondary">次要操作</Button></div><div className="component-sample"><small>Hover / Focus</small><Button>移入或聚焦</Button></div>
        <div className="component-sample"><small>Disabled</small><Button disabled>暫不可用</Button></div><div className="component-sample"><small>Loading</small><Button loading>處理中…</Button></div></div></section>
      <section aria-labelledby="component-fields"><h2 id="component-fields">表單控制</h2><div className="component-grid">
        <TextField label="預設欄位" defaultValue="週末的羽球時光" helper="清楚的名稱，讓下一步更容易。"/><TextField label="聚焦欄位" placeholder="使用 Tab 或點擊查看 focus"/><TextField label="錯誤欄位" error="請填寫必要資訊。"/>
        <TextField label="停用欄位" defaultValue="目前不可編輯" disabled/><Select label="選單示例" defaultValue="vibrant"><option value="vibrant">精緻活力 · 潮汐</option><option value="professional">精緻專業 · 石墨紫</option><option value="custom">自訂強調色</option><option value="legacy" disabled>舊版主題</option></Select><div className="component-sample"><Checkbox label="接收更新通知"/><Checkbox label="已停用的通知" disabled defaultChecked/></div></div></section>
      <section aria-labelledby="component-status"><h2 id="component-status">操作結果</h2><div className="component-grid"><StatusMessage tone="success">設定已儲存。</StatusMessage><StatusMessage tone="warning">請確認後再繼續。</StatusMessage><StatusMessage tone="error">儲存失敗，請重試。</StatusMessage></div></section>
      <section aria-labelledby="component-states"><h2 id="component-states">內容狀態</h2><p>內容是否可用，與操作結果分開呈現。</p><StateExamples/></section>
      <section aria-label="導覽示例"><Navigation label="範例導覽" items={[{label:"設計基礎",href:withBase("/foundations")},{label:"產品範本",href:withBase("/templates/product")}]}/><Navigation label="子路徑導覽" brand="子路徑部署 /" brandHref="/luca-style/" items={[{label:"部署首頁",href:"/luca-style/"}]}/></section><ProductSamples/><section aria-labelledby="component-form"><h2 id="component-form">試試實際操作</h2><p>本機示例，資料不會傳送或永久儲存。</p><DemoForm/></section>
    </>}
  </div>;
}
function StateExamples() {
  const [retried,setRetried]=useState(false);
  return <div className="component-grid"><ContentState state="loading"/><ContentState state="empty"/>{retried ? <div className="luca-content-state"><h3>內容已重新載入</h3><p>重試完成，可以繼續操作。</p><Button variant="secondary" onClick={()=>setRetried(false)}>再次示範錯誤</Button></div> : <ContentState state="error" onRetry={()=>setRetried(true)}/>}</div>;
}
function DemoForm() {
  const [name,setName]=useState('');
  const [confirmed,setConfirmed]=useState(false);
  const [submitted,setSubmitted]=useState(false);
  const [busy,setBusy]=useState(false);
  const [fail,setFail]=useState(false);
  const [result,setResult]=useState<'success'|'error'|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy)return;
    setSubmitted(true);
    setResult(null);
    if(!name.trim() || !confirmed) {
      const control=event.currentTarget.elements.namedItem(!name.trim() ? 'planName' : 'confirmed');
      if(control instanceof HTMLElement)control.focus();
      return;
    }
    setBusy(true);
    timer.current=setTimeout(()=>{setBusy(false);setResult(fail ? 'error' : 'success');},650);
  }
  return <form aria-label="示範設定" className="demo-form" onSubmit={submit} noValidate>
    <fieldset disabled={busy}><legend>設定預覽</legend><TextField name="planName" label="計畫名稱" value={name} onChange={e=>setName(e.target.value)} error={submitted && !name.trim() ? '請輸入計畫名稱。' : undefined}/>
    <Select label="通知頻率" defaultValue="weekly"><option value="weekly">每週摘要</option><option value="daily">每日更新</option><option value="none">不通知</option></Select>
    <Checkbox name="confirmed" label="我已確認設定" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} error={submitted && !confirmed ? '請先確認設定。' : undefined}/>
    <Button type="submit" loading={busy}>{busy ? '儲存中…' : '儲存設定'}</Button></fieldset>
    <Checkbox label="模擬儲存失敗" checked={fail} disabled={busy} onChange={e=>setFail(e.target.checked)}/>
    {result && <StatusMessage tone={result}>{result === 'success' ? '設定已儲存。' : '儲存失敗，請重試。'}</StatusMessage>}
  </form>;
}
