import {useState} from 'react';
import {Product,type ProductState} from './product';
// 樣張網站的產品範本：「樣張狀態」選單與目前狀態都放在這裡，再傳給 Product。
export function ProductTemplate(){
 const [state,setState]=useState<ProductState>('success');
 return <Product state={state} onRetry={()=>setState('success')} sampleControl={<label className="sample-control">樣張狀態<select value={state} onChange={e=>setState(e.target.value as ProductState)}><option value="success">Success · 正常內容</option><option value="loading">Loading · 載入中</option><option value="empty">Empty · 尚無資料</option><option value="error">Error · 載入失敗</option></select></label>}/>;
}
