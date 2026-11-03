export type Plan = {
  id: string;
  name: string;
  monthly: number;
  blurb: string;
  features: string[];
  cta: string;
  recommended?: boolean;
};

export type PricingState = 'loading' | 'empty' | 'error' | 'success';

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: '入門版',
    monthly: 290,
    blurb: '適合個人與小型團隊起步',
    features: ['最多 3 位成員', '5 個專案', '基本報表', '社群支援'],
    cta: '選擇入門版',
  },
  {
    id: 'pro',
    name: '專業版',
    monthly: 790,
    blurb: '成長中團隊的最佳選擇',
    features: ['最多 20 位成員', '無限專案', '進階報表', '自動化流程', '電子郵件支援'],
    cta: '選擇專業版',
    recommended: true,
  },
  {
    id: 'enterprise',
    name: '企業版',
    monthly: 1990,
    blurb: '大型組織的安全與規模需求',
    features: ['無限成員', '無限專案', '自訂報表', '單一登入 (SSO)', '專屬客戶經理'],
    cta: '選擇企業版',
  },
];

export const COMPARISON: { label: string; values: string[] }[] = [
  { label: '成員人數', values: ['3 位', '20 位', '無限'] },
  { label: '專案數量', values: ['5 個', '無限', '無限'] },
  { label: '報表', values: ['基本', '進階', '自訂'] },
  { label: '自動化流程', values: ['—', '有', '有'] },
  { label: '單一登入 (SSO)', values: ['—', '—', '有'] },
  { label: '客戶支援', values: ['社群', '電子郵件', '專屬經理'] },
];

/** 假的非同步 API：用 Promise 加延遲模擬。 */
export function fetchPlans(state: PricingState): Promise<Plan[]> {
  return new Promise((resolve, reject) => {
    if (state === 'loading') return; // 永遠不結束
    setTimeout(() => {
      if (state === 'error') reject(new Error('無法取得方案資料'));
      else if (state === 'empty') resolve([]);
      else resolve(PLANS);
    }, 700);
  });
}
