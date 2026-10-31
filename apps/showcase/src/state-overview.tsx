import {Product,type ProductState} from './product';
import './state-overview.css';

const cells:{state:ProductState;label:string}[]=[{state:'loading',label:'Loading'},{state:'empty',label:'Empty'},{state:'error',label:'Error'},{state:'success',label:'Success'}];
// 總覽頁固定呈現四格，重試不切換狀態；各格仍顯示重試按鈕，才看得到 Error 的完整版面。
const keepState=()=>{};

// 狀態總覽頁（§5.3.7）：只在開發環境由 main.tsx 載入，不屬於樣張網站。切換控制與桌機並排方式屬於 ISSUE-003。
export function StateOverview(){
 return <main className="state-overview"><h1>狀態總覽頁 · /templates/product</h1><div className="state-overview-cells">{cells.map(({state,label})=><section key={state} className="state-overview-cell" aria-label={label}><h2>{label}</h2><Product state={state} onRetry={keepState}/></section>)}</div></main>;
}
