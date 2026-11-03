export type Plan = {
  id: string;
  name: string;
  monthly: number;
  blurb: string;
  features: string[];
  cta: string;
  recommended?: boolean;
};

export type PlanState = 'loading' | 'empty' | 'error' | 'success';

export function readState(): PlanState {
  const value = new URLSearchParams(window.location.search).get('state');
  return value === 'loading' || value === 'empty' || value === 'error' ? value : 'success';
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: '入門',
    monthly: 300,
    blurb: '適合個人與小型團隊起步。',
    features: ['最多 3 位成員', '5 個專案', '基本報表', '社群支援'],
    cta: '開始試用',
  },
  {
    id: 'pro',
    name: '專業',
    monthly: 900,
    blurb: '成長中團隊的完整協作功能。',
    features: ['最多 25 位成員', '無限專案', '進階報表', '自動化流程', '電子郵件支援'],
    cta: '開始試用',
    recommended: true,
  },
  {
    id: 'enterprise',
    name: '企業',
    monthly: 2500,
    blurb: '大型組織的安全與控管需求。',
    features: ['無限成員', '無限專案', '單一登入（SSO）', '稽核紀錄', '專屬客戶經理'],
    cta: '聯絡業務',
  },
];

/** 假的非同步 API：依網址參數 state 決定結果。loading 永遠不會結束。 */
export function fetchPlans(state: PlanState): Promise<Plan[]> {
  return new Promise((resolve, reject) => {
    if (state === 'loading') return;
    setTimeout(() => {
      if (state === 'error') reject(new Error('Fake API failure'));
      else if (state === 'empty') resolve([]);
      else resolve(PLANS);
    }, 700);
  });
}
