import type {ReactNode} from 'react';
import {Product,type ProductState} from './product';

export type OverviewDirection={name:string;render:(state:ProductState)=>ReactNode};
// 全新畫面給兩個版面方向，其他畫面一個（docs/decision-log.md 2026-10-31）。name 也是格內網址裡的識別，兩個方向不可同名；一個方向時不會顯示。
export type OverviewScreen={route:string;directions:[OverviewDirection]|[OverviewDirection,OverviewDirection]};
// 總覽頁每格的狀態固定，重試不切換狀態；各格仍顯示重試按鈕，才看得到 Error 的完整版面。
const keepState=()=>{};
// 納入狀態總覽頁的畫面清單；只由開發環境載入。
export const overviewScreens:OverviewScreen[]=[{route:'/templates/product',directions:[{name:'現行版面',render:state=><Product state={state} onRetry={keepState}/>}]}];
