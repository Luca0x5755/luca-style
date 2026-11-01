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

// 狀態總覽頁納入的畫面與四種狀態（PR-REVIEW-08、09）：截圖與 axe 共用同一份 48 種組合。
// 開發限定的頁面不在路由表，所以不併入 visualPages。
export const overviewScreen = '/templates/product';
export const overviewStates = ['loading', 'empty', 'error', 'success'] as const;
export type OverviewCell = { state: typeof overviewStates[number]; suite: typeof visualSuites[number]; mode: typeof visualModes[number]; width: typeof visualWidths[number] };
export const overviewCells: OverviewCell[] = overviewStates.flatMap((state) => visualSuites.flatMap((suite) => visualModes.flatMap((mode) => visualWidths.map((width) => ({ state, suite, mode, width })))));
// 路由的 slug 都不會以 state-overview- 開頭，所以不會與上面的基準同名；visual-config.spec 另外檢查。
export const overviewBaselineName = ({ state, suite, mode, width }: OverviewCell) => `state-overview-${pageSlug(overviewScreen)}-${state}-${suite}-${mode}-${width}`;
