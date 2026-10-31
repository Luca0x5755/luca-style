import type {ReactNode} from 'react';
import {Product,type ProductState} from './product';

export type OverviewScreen={route:string;render:(state:ProductState)=>ReactNode};
// 總覽頁固定呈現四格，重試不切換狀態；各格仍顯示重試按鈕，才看得到 Error 的完整版面。
const keepState=()=>{};
// 納入狀態總覽頁的畫面清單；只由開發環境載入。
export const overviewScreens:OverviewScreen[]=[{route:'/templates/product',render:state=><Product state={state} onRetry={keepState}/>}];
