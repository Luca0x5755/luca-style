export type PlanId = 'starter' | 'pro' | 'enterprise';

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  /** 月繳價格（新台幣 / 月） */
  monthly: number;
  features: string[];
  cta: string;
  recommended?: boolean;
};

export type PageState = 'loading' | 'empty' | 'error' | 'success';

export function readState(search: string): PageState {
  const value = new URLSearchParams(search).get('state');
  return value === 'loading' || value === 'empty' || value === 'error' ? value : 'success';
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: '入門',
    tagline: '適合個人與小型團隊起步',
    monthly: 290,
    features: ['最多 5 位成員', '3 個專案', '基本報表', '電子郵件支援'],
    cta: '選擇入門方案',
  },
  {
    id: 'pro',
    name: '專業',
    tagline: '成長中團隊的最佳選擇',
    monthly: 790,
    features: ['最多 50 位成員', '無限專案', '進階報表與匯出', '自動化流程', '優先支援'],
    cta: '選擇專業方案',
    recommended: true,
  },
  {
    id: 'enterprise',
    name: '企業',
    tagline: '大型組織的安全與管理需求',
    monthly: 1990,
    features: ['無限成員', '單一登入（SSO）', '稽核紀錄', '專屬客戶經理', '99.9% 服務水準協議'],
    cta: '選擇企業方案',
  },
];

/** 假的非同步 API：依網址參數的狀態回應。loading 永遠不會結束。 */
export function fetchPlans(state: PageState): Promise<Plan[]> {
  return new Promise<Plan[]>((resolve, reject) => {
    if (state === 'loading') return;
    setTimeout(() => {
      if (state === 'error') reject(new Error('無法取得方案資料'));
      else if (state === 'empty') resolve([]);
      else resolve(PLANS);
    }, 700);
  });
}

export function priceFor(plan: Plan, yearly: boolean): number {
  return yearly ? Math.round(plan.monthly * 0.8) : plan.monthly;
}
