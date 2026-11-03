import { useCallback, useEffect, useState } from 'react';
import { Button, ContentState, DataTable, StatusMessage } from '@luca-style/react';
import { fetchPlans, readState, type Plan, type PlanState } from './api';

const CONTACT_EMAIL = 'sales@flowdesk.example';
const fmt = (n: number) => `NT$${n.toLocaleString('en-US')}`;

const highlights = [
  { title: '即時協作', text: '任務、文件與留言集中在同一處，團隊隨時掌握最新進度。' },
  { title: '自動化流程', text: '用簡單規則取代重複工作，把時間留給真正重要的事。' },
  { title: '清楚的報表', text: '一眼看懂專案健康度與團隊產能，決策不再憑感覺。' },
  { title: '企業級安全', text: '資料加密、權限分級與稽核紀錄，讓合規審查輕鬆過關。' },
];

const faqs = [
  { q: '試用期有多長？', a: '所有方案都提供 14 天免費試用，不需要信用卡。' },
  { q: '可以隨時更換方案嗎？', a: '可以。升級立即生效，降級則在下個計費週期開始。' },
  { q: '年繳如何計費？', a: '年繳方案的每月價格比月繳便宜 20%，一次收取全年費用。' },
  { q: '支援哪些付款方式？', a: '支援信用卡與銀行轉帳，企業方案可開立發票並採月結。' },
  { q: '資料可以匯出嗎？', a: '可以。你隨時能以 CSV 或 JSON 匯出全部資料。' },
];

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; plans: Plan[] };

function usePlans() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoad({ status: 'loading' });
    fetchPlans(readState()).then(
      plans => alive && setLoad({ status: 'ready', plans }),
      () => alive && setLoad({ status: 'error' }),
    );
    return () => { alive = false; };
  }, [attempt]);
  return { load, retry: useCallback(() => setAttempt(n => n + 1), []) };
}

function ContactButton({ children, variant }: { children: string; variant?: 'primary' | 'secondary' }) {
  return <Button variant={variant} render={<a href={`mailto:${CONTACT_EMAIL}`} />}>{children}</Button>;
}

function PlanCard({ plan, yearly }: { plan: Plan; yearly: boolean }) {
  const price = yearly ? plan.monthly * 0.8 : plan.monthly;
  return (
    <li className={`plan${plan.recommended ? ' plan-rec' : ''}`}>
      {plan.recommended && <span className="badge">推薦</span>}
      <h3>{plan.name}</h3>
      <p className="muted">{plan.blurb}</p>
      <p className="price">
        <strong>{fmt(price)}</strong> <span className="muted">/ 月</span>
      </p>
      <p className="muted small">{yearly ? `年繳，共 ${fmt(price * 12)}` : '月繳，隨時可取消'}</p>
      <ul className="features">
        {plan.features.map(f => <li key={f}>{f}</li>)}
      </ul>
      {plan.cta === '聯絡業務'
        ? <ContactButton variant="secondary">{plan.cta}</ContactButton>
        : <Button variant={plan.recommended ? 'primary' : 'secondary'} render={<a href="#trial" />}>{plan.cta}</Button>}
    </li>
  );
}

const compareRows = [
  { feature: '成員數', values: ['3', '25', '無限'] },
  { feature: '專案數', values: ['5', '無限', '無限'] },
  { feature: '基本報表', values: [true, true, true] },
  { feature: '進階報表', values: [false, true, true] },
  { feature: '自動化流程', values: [false, true, true] },
  { feature: '單一登入（SSO）', values: [false, false, true] },
  { feature: '稽核紀錄', values: [false, false, true] },
  { feature: '支援', values: ['社群', '電子郵件', '專屬經理'] },
];

function Compare({ plans }: { plans: Plan[] }) {
  const cell = (v: string | boolean) =>
    v === true ? <span><span aria-hidden="true">✓</span><span className="sr">包含</span></span>
      : v === false ? <span><span aria-hidden="true">—</span><span className="sr">不含</span></span>
        : v;
  return (
    <div className="table-wrap" role="region" aria-label="方案比較表捲動區" tabIndex={0}>
      <DataTable
        caption="方案功能比較"
        rows={compareRows}
        rowKey={row => row.feature}
        columns={[
          { key: 'feature', heading: '功能', render: row => row.feature },
          ...plans.map((p, i) => ({ key: p.id, heading: p.name, render: (row: typeof compareRows[number]) => cell(row.values[i]) })),
        ]}
      />
    </div>
  );
}

function Pricing() {
  const { load, retry } = usePlans();
  const [yearly, setYearly] = useState(false);
  const state: PlanState = load.status === 'ready' ? (load.plans.length ? 'success' : 'empty') : load.status;

  return (
    <section id="pricing" aria-labelledby="pricing-h" className="section">
      <h2 id="pricing-h">定價方案</h2>
      <p className="muted">選擇適合團隊的方案，年繳享 8 折優惠。</p>
      <div data-eval-state={state} aria-busy={state === 'loading'}>
        {state === 'loading' && (
          <ContentState state="loading" title="載入方案中" description="正在取得最新的定價方案，請稍候。" />
        )}
        {state === 'error' && (
          <div className="state-box" role="alert">
            <StatusMessage tone="error" label="錯誤">無法載入定價方案，與伺服器的連線失敗。請檢查網路後重試。</StatusMessage>
            <Button onClick={retry}>重試載入</Button>
          </div>
        )}
        {state === 'empty' && (
          <div className="state-box">
            <h3>目前沒有開放購買的方案</h3>
            <p className="muted">我們正在調整產品方案，暫時未開放自助購買。若需要報價或試用，歡迎直接與業務團隊聯絡。</p>
            <ContactButton>聯絡業務</ContactButton>
          </div>
        )}
        {state === 'success' && load.status === 'ready' && (
          <>
            <div className="toggle" role="group" aria-label="計費週期">
              <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>月繳</button>
              <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>年繳（省 20%）</button>
            </div>
            <ul className="plans">
              {load.plans.map(p => <PlanCard key={p.id} plan={p} yearly={yearly} />)}
            </ul>
            <h3 className="compare-h">方案比較</h3>
            <Compare plans={load.plans} />
          </>
        )}
      </div>
    </section>
  );
}

export function App() {
  return (
    <>
      <a className="skip" href="#main">跳到主要內容</a>
      <header className="top">
        <span className="brand">FlowDesk</span>
        <nav aria-label="頁面導覽">
          <a href="#features">功能</a>
          <a href="#pricing">定價</a>
          <a href="#faq">常見問題</a>
        </nav>
      </header>
      <main id="main">
        <section className="hero" aria-labelledby="hero-h">
          <h1 id="hero-h">FlowDesk</h1>
          <p className="lead">讓團隊用更少的會議，完成更多的事。</p>
          <div className="actions">
            <Button render={<a href="#trial" />}>開始試用</Button>
            <ContactButton variant="secondary">聯絡業務</ContactButton>
          </div>
          <p id="trial" className="muted small">14 天免費試用，不需信用卡。</p>
        </section>

        <section id="features" className="section" aria-labelledby="features-h">
          <h2 id="features-h">功能亮點</h2>
          <ul className="cards">
            {highlights.map(h => (
              <li key={h.title} className="card">
                <h3>{h.title}</h3>
                <p className="muted">{h.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <Pricing />

        <section id="faq" className="section" aria-labelledby="faq-h">
          <h2 id="faq-h">常見問題</h2>
          <div className="faq">
            {faqs.map(f => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className="foot">
        <p>聯絡我們：<a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>　電話：<a href="tel:+886223456789">02-2345-6789</a></p>
        <p className="muted small">© 2026 FlowDesk. 保留所有權利。</p>
      </footer>
    </>
  );
}
