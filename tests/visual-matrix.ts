import { routeTable } from './route-table';

// 截圖基準的組合：頁面清單、套系、明暗、寬度的唯一來源，visual.spec 與 visual-config.spec 共用。
// 頁面取自路由表，再加一條不在表內的路徑代表「找不到頁面」（前端規格 §5.3、§5.3.6）。
export const notFoundPath = '/visual-unlisted-path';
export const visualPages = [...routeTable, notFoundPath];
export const visualSuites = ['vibrant', 'professional'] as const;
export const visualModes = ['light', 'dark'] as const;
export const visualWidths = [1280, 834, 390] as const;

// 基準檔名（不含副檔名）：頁面-套系-明暗-寬度。
export const pageSlug = (path: string) => (path === '/' ? 'root' : path.replace(/\W+/g, '-').replace(/^-|-$/g, ''));
export const baselineName = (path: string, suite: string, mode: string, width: number) => `${pageSlug(path)}-${suite}-${mode}-${width}`;
