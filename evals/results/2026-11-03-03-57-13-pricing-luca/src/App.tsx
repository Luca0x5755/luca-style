import { useEffect, useState, type ReactNode } from 'react';
import { Button, ContentState, DataTable, StatusMessage } from '@luca-style/react';
import { fetchPlans, priceFor, readState, type Plan, type PageState } from './api';

const CONTACT_EMAIL = 'sales@flowdesk.example';

const highlights = [
  { title: '即時協作', body: '團隊成員同步編輯任務與文件，變更立即可見，不再來回寄檔案。' },
  { title: '自動化流程', body: '用簡單的規則串起重複工作，把時間留給真正重要的事。' },
  { title: '清晰的報表', body: '一眼掌握進度與瓶頸，並可隨時匯出給主管或客戶。' },
  { title: '企業級安全', body: '資料加密、權限控管與稽核紀錄，符合組織的合規要求。' },
];

const faqs = [
  { q: '試用期有多久？需要信用卡嗎？', a: '提供 14 天完整功能試用，不需要綁定信用卡，到期前會以電子郵件提醒。' },
  { q: '可以隨時更換或取消方案嗎？', a: '可以。升級立即生效並按比例計費；取消後可使用到當期結束，不收違約金。' },
  { q: '年繳方案如何計價？', a: '年繳比月繳便宜 20%，以年為單位一次收費，頁面顯示的是換算後的每月價格。' },
  { q: '企業方案支援發票與採購流程嗎？', a: '支援統一編號發票、報價單與公司間轉帳，請聯絡業務協助安排。' },
  { q: '資料存放在哪裡？', a: '資料存放於具備多重備援的雲端機房，並每日備份，可隨時匯出自己的資料。' },
];

type FeatureRow = { id: string; feature: string; values: Record<Plan['id'], string | boolean> };

const featureRows: FeatureRow[] = [
  { id: 'members', feature: '成員人數', values: { starter: '5 位', pro: '50 位', enterprise: '無限' } },
  { id: 'projects', feature: '專案數量', values: { starter: '3 個', pro: '無限', enterprise: '無限' } },
  { id: 'reports', feature: '進階報表與匯出', values: { starter: false, pro: true, enterprise: true } },
  { id: 'automation', feature: '自動化流程', values: { starter: false, pro: true, enterprise: true } },
  { id: 'sso', feature: '單一登入（SSO）', values: { starter: false, pro: false, enterprise: true } },
  { id: 'audit', feature: '稽核紀錄', values: { starter: false, pro: false, enterprise: true } },
  { id: 'support', feature: '支援', values: { starter: '電子郵件', pro: '優先支援', enterprise: '專屬客戶經理' } },
];

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <><span aria-hidden="true">✓</span><span className="sr-only">包含</span></>;
  if (value === false) return <><span aria-hidden="true">—</span><span className="sr-only">不包含</span></>;
  return <>{value}</>;
}

type Load =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; plans: Plan[] };

function usePlans(state: PageState) {
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<Load>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: 'loading' });
    fetchPlans(state).then(
      plans => { if (!cancelled) setLoad({ status: 'ready', plans }); },
      () => { if (!cancelled) setLoad({ status: 'error' }); },
    );
    return () => { cancelled = true; };
  }, [state, attempt]);

  return { load, retry: () => setAttempt(n => n + 1) };
}

function PlanCard({ plan, yearly }: { plan: Plan; yearly: boolean }) {
  const titleId = `plan-${plan.id}`;
  return (
    <li className={`plan${plan.recommended ? ' plan-recommended' : ''}`} aria-labelledby={titleId}>
      {plan.recommended && <span className="badge">推薦</span>}
      <h3 id={titleId} className="plan-name">{plan.name}</h3>
      <p className="muted">{plan.tagline}</p>
      <p className="price">
        <span className="price-amount">NT$ {priceFor(plan, yearly).toLocaleString('en-US')}</span>
        <span className="muted"> / 月</span>
      </p>
      <p className="muted small">{yearly ? '年繳，比月繳省 20%' : '月繳，隨時可取消'}</p>
      <ul className="feature-list">
        {plan.features.map(f => <li key={f}>{f}</li>)}
      </ul>
      <Button
        variant={plan.recommended ? 'primary' : 'secondary'}
        render={<a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(plan.name + '方案')}`} aria-label={`${plan.cta}（${plan.name}）`} />}
      >
        {plan.cta}
      </Button>
    </li>
  );
}

function PricingArea({ state, yearly }: { state: PageState; yearly: boolean }) {
  const { load, retry } = usePlans(state);

  if (load.status === 'loading') {
    return (
      <div data-eval-state="loading" className="state-box">
        <ContentState state="loading" title="正在載入方案" description="請稍候，我們正在取得最新的定價資料。" />
      </div>
    );
  }

  if (load.status === 'error') {
    return (
      <div data-eval-state="error" className="state-box" role="alert">
        <StatusMessage tone="error" label="載入失敗">無法取得定價方案，可能是網路或服務暫時發生問題。</StatusMessage>
        <p className="muted">您的資料沒有遺失，請按下按鈕重新載入方案與比較表。</p>
        <Button onClick={retry}>重新載入方案</Button>
      </div>
    );
  }

  if (load.plans.length === 0) {
    return (
      <div data-eval-state="empty" className="state-box">
        <h3 className="plan-name">目前沒有開放購買的方案</h3>
        <p className="muted">我們正在調整產品組合，線上購買暫時關閉。現有客戶不受影響，也歡迎洽詢客製報價。</p>
        <Button render={<a href={`mailto:${CONTACT_EMAIL}`} />}>聯絡業務取得報價</Button>
      </div>
    );
  }

  const plans = load.plans;
  return (
    <div data-eval-state="success">
      <ul className="plans">
        {plans.map(p => <PlanCard key={p.id} plan={p} yearly={yearly} />)}
      </ul>
      <h3 className="compare-title">方案比較</h3>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="方案比較表，可左右捲動">
        <DataTable
          caption={`各方案功能差異（${yearly ? '年繳' : '月繳'}價格為每月）`}
          rows={featureRows}
          rowKey={r => r.id}
          columns={[
            { key: 'feature', heading: '功能', render: r => r.feature },
            ...plans.map(p => ({
              key: p.id,
              heading: p.name,
              render: (r: FeatureRow) => <Cell value={r.values[p.id]} />,
            })),
          ]}
        >
          <tfoot>
            <tr>
              <th scope="row">每月價格</th>
              {plans.map(p => <td key={p.id}>NT$ {priceFor(p, yearly).toLocaleString('en-US')}</td>)}
            </tr>
          </tfoot>
        </DataTable>
      </div>
    </div>
  );
}

export function App(): ReactNode {
  const state = readState(window.location.search);
  const [yearly, setYearly] = useState(false);

  return (
    <>
      <a className="skip" href="#main">跳到主要內容</a>
      <header className="site-header">
        <span className="brand">FlowDesk</span>
        <nav aria-label="頁面章節">
          <a href="#features">功能</a>
          <a href="#pricing">定價</a>
          <a href="#faq">常見問題</a>
        </nav>
      </header>
      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title">FlowDesk</h1>
          <p className="lead">讓團隊的工作流程更順暢：協作、自動化與報表，一個平台全部搞定。</p>
          <div className="actions">
            <Button render={<a href="#pricing" />}>開始試用</Button>
            <Button variant="secondary" render={<a href="#contact" />}>聯絡業務</Button>
          </div>
        </section>

        <section id="features" className="section" aria-labelledby="features-title">
          <h2 id="features-title">功能亮點</h2>
          <ul className="grid">
            {highlights.map(h => (
              <li key={h.title} className="card">
                <h3>{h.title}</h3>
                <p className="muted">{h.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="pricing" className="section" aria-labelledby="pricing-title">
          <h2 id="pricing-title">定價方案</h2>
          <div className="toggle" role="group" aria-label="計費週期">
            <Button variant={yearly ? 'secondary' : 'primary'} aria-pressed={!yearly} onClick={() => setYearly(false)}>月繳</Button>
            <Button variant={yearly ? 'primary' : 'secondary'} aria-pressed={yearly} onClick={() => setYearly(true)}>年繳（省 20%）</Button>
          </div>
          <PricingArea state={state} yearly={yearly} />
        </section>

        <section id="faq" className="section" aria-labelledby="faq-title">
          <h2 id="faq-title">常見問題</h2>
          <div className="faq">
            {faqs.map(f => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p className="muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer id="contact" className="site-footer">
        <h2 className="footer-title">聯絡我們</h2>
        <p>
          電子郵件：<a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          <br />
          電話：<a href="tel:+886223456789">02-2345-6789</a>（週一至週五 09:00–18:00）
        </p>
        <p className="muted small">© 2026 FlowDesk Inc. 保留所有權利。</p>
      </footer>
    </>
  );
}
