import {useState} from 'react';
import {Button,ContentState,MetricCard,TextField,type StyleSuite} from '@luca-style/react';

const deliveries=[['共同的視覺語言','色彩、字體、間距與明暗模式，對應相同的角色。'],['可沿用的元件','按鈕、表單與資訊呈現，維持一致的互動回應。'],['完整的頁面起點','產品介面與介紹頁範本，涵蓋電腦、平板與手機。']];
const values=[['一致，而不失個性','共同的元件與字體角色，讓每個畫面都熟悉；套系色彩與外形，留下專案自己的氣質。'],['從大畫面，到手中的螢幕','保留正文大小與資訊層次，透過排列與間距，讓不同裝置都能舒服閱讀。'],['明暗之間，保持清楚','暖白日間與炭黑暗黑，同時考慮文字、表面與操作回饋。']];
function PreviewMetric(){return <MetricCard label="讓每一份進展都清楚" eyebrow="本月累計 / MONTH TO DATE" value="128,640" detail="TWD · 資料更新於 09:30" highlight/>;}
function Statements({items}:{items:string[][]}){return <div className="editorial-statements">{items.map(([title,description],i)=><section key={title}><small>0{i+1}</small><h3>{title}</h3><p>{description}</p></section>)}</div>;}
export function Editorial({intro=false,suite}:{intro?:boolean;suite:StyleSuite}){
 const [state,setState]=useState<'success'|'loading'|'empty'|'error'>('success');
 const suiteName=suite==='vibrant'?'精緻活力 · 潮汐':'精緻專業 · 石墨紫';
 return <div className={`editorial-page ${intro?'intro-page':'home-page'}`}>
 <h1>{intro?<>為重要的事，<br/>留出清楚的空間。</>:<>為你的下一個專案，<br/>建立一致的起點。</>}</h1>
 <p className="description">{intro?'清楚的資訊，舒服的節奏。為你的專案建立值得細看的介紹頁。':'兩套風格，一致的閱讀與操作。從設計變數到完整頁面，讓每個專案保有自己的個性。'}</p>
 <label className="sample-control">樣張狀態<select value={state} onChange={e=>setState(e.target.value as typeof state)}><option value="success">Success · 正常內容</option><option value="loading">Loading · 載入中</option><option value="empty">Empty · 尚無內容</option><option value="error">Error · 載入失敗</option></select></label>
 {state!=='success'?<ContentState state={state} title={state==='loading'?'介紹內容載入中':state==='empty'?'介紹內容尚未提供':'介紹內容無法載入'} description={state==='loading'?'正在準備介紹內容，請稍候。':state==='empty'?'可先從下方入口繼續探索。':'請重試以重新顯示介紹內容。'} onRetry={()=>setState('success')}/>:intro?<>
 <section className="editorial-hero"><div><p>從第一眼的印象，到每天的使用。<br/>讓你的專案，有清楚而一致的個性。</p><Button onClick={()=>document.getElementById('intro-values-title')?.focus()}>了解設計 →</Button><p>產品介紹 · 個人作品 · 專案展示</p></div><aside className="intro-panel"><small>DESIGNED FOR EVERYDAY</small><h2>細節有秩序，<br/>個性有空間。</h2><p>{suite==='vibrant'?'親近、流動，帶一點活力。':'精準、俐落，讓細節保持秩序。'}</p><a href="/templates/product">查看範本 →</a></aside></section>
 <section className="intro-detail" id="intro-values"><div><h2 id="intro-values-title" tabIndex={-1}>好設計，讓重要的事更容易被看見</h2><p>不需要讓每個區塊都成為焦點。從主標到細節，建立自然的閱讀順序，讓內容自己說話。</p><Statements items={values}/></div><aside><h3>在真實內容中，感受差異</h3><PreviewMetric/><TextField label="計畫名稱" value="週末的羽球時光" readOnly helper="清楚的名稱，讓下一步更容易。"/><p>沿用同一組元件，組合不同用途的畫面。</p></aside></section>
 <section className="intro-close"><h2>讓下一個專案，從清楚開始。</h2><p>選定風格，再把你的內容放進來。</p><a href="/templates/product">查看完整範本 →</a></section>
 </>:<>
 <section className="start"><div><Button onClick={()=>window.location.assign('/foundations')}>探索設計基礎 →</Button><p>先選擇套系，再沿用元件與版型。<br/>日間與暗黑，從第一天一起考慮。</p></div><aside><h3>{suiteName}</h3><PreviewMetric/><p>{suite==='vibrant'?'柔和曲線，適中偏寬鬆。':'俐落邊界，適中偏密集。'}</p></aside></section>
 <section><h2>從規則，到完整畫面</h2><Statements items={deliveries}/></section>
 </>}
 <section className="editorial-explore" aria-label="繼續探索"><h2>繼續探索</h2><div><a href="/">返回設計系統入口</a><a href="/foundations">設計基礎</a><a href="/components">查看共用元件</a><a href="/templates/product">查看產品範本</a><a href="/templates/intro">查看介紹頁範本</a></div></section>
 </div>;
}
