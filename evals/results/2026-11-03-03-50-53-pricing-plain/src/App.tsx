import { useCallback, useEffect, useState } from 'react';
import { COMPARISON, fetchPlans, type Plan, type PricingState } from './api';

const FEATURES = [
  { title: '即時協作', text: '團隊成員同步編輯任務與文件，變更立即呈現，不再來回寄檔案。' },
  { title: '自動化流程', text: '用簡單規則串起重複性工作，讓團隊把時間花在真正重要的事。' },
  { title: '洞察報表', text: '一目了然的儀表板，掌握進度、成本與團隊產能。' },
  { title: '企業級安全', text: '資料加密、細緻權限與稽核紀錄，符合企業合規需求。' },
];

const FAQS = [
  { q: '試用期有多久？需要信用卡嗎？', a: '提供 14 天免費試用，不需要綁定信用卡，期滿前會以電子郵件提醒您。' },
  { q: '可以隨時更換方案嗎？', a: '可以。升級會立即生效，降級則在目前計費週期結束後生效。' },
  { q: '年繳方案如何計算？', a: '年繳每月價格為月繳價格的 8 折，並於購買時一次收取全年費用。' },
  { q: '如何申請退款？', a: '付款後 30 天內若不滿意，聯絡我們即可全額退款。' },
  { q: '是否提供發票與企業採購？', a: '提供電子發票與統一編號開立，企業可洽業務取得報價與合約。' },
];

function getState(): PricingState {
  const s = new URLSearchParams(window.location.search).get('state');
  return s === 'loading' || s === 'empty' || s === 'error' ? s : 'success';
}

const fmt = (n: number) => `NT$ ${n.toLocaleString('en-US')}`;

function Pricing() {
  const state = getState();
  const [status, setStatus] = useState<PricingState>('loading');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [yearly, setYearly] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    setStatus('loading');
    fetchPlans(state).then(
      (p) => {
        if (cancelled) return;
        setPlans(p);
        setStatus(p.length ? 'success' : 'empty');
      },
      () => !cancelled && setStatus('error'),
    );
    return () => {
      cancelled = true;
    };
  }, [state]);

  useEffect(() => load(), [load]);

  return (
    <section id="pricing" aria-labelledby="pricing-title" className="section">
      <h2 id="pricing-title">定價方案</h2>
      <div data-eval-state={status} className="pricing-area">
        {status === 'loading' && (
          <p role="status" className="notice">
            <span className="spinner" aria-hidden="true" /> 方案資料載入中…
          </p>
        )}
        {status === 'empty' && (
          <div className="notice" role="status">
            <h3>目前沒有開放購買的方案</h3>
            <p>我們正在調整產品方案，暫時無法線上購買。如需報價或專屬方案，歡迎聯絡業務。</p>
            <a className="btn primary" href="#contact">聯絡業務</a>
          </div>
        )}
        {status === 'error' && (
          <div className="notice error" role="alert">
            <h3>無法載入方案資料</h3>
            <p>與伺服器連線時發生問題，請稍後再試。</p>
            <button className="btn primary" onClick={load}>重試</button>
          </div>
        )}
        {status === 'success' && (
          <>
            <div className="toggle" role="group" aria-label="計費週期">
              <button aria-pressed={!yearly} onClick={() => setYearly(false)}>月繳</button>
              <button aria-pressed={yearly} onClick={() => setYearly(true)}>
                年繳 <span className="save">省 20%</span>
              </button>
            </div>
            <ul className="plans">
              {plans.map((p) => {
                const price = yearly ? p.monthly * 0.8 : p.monthly;
                return (
                  <li key={p.id} className={'plan' + (p.recommended ? ' rec' : '')}>
                    {p.recommended && <span className="badge">推薦</span>}
                    <h3>{p.name}</h3>
                    <p className="muted">{p.blurb}</p>
                    <p className="price">
                      <strong>{fmt(price)}</strong> <span>/ 月{yearly ? '（年繳）' : ''}</span>
                    </p>
                    <ul className="checks">
                      {p.features.map((f) => <li key={f}>{f}</li>)}
                    </ul>
                    <a className={'btn ' + (p.recommended ? 'primary' : 'outline')} href="#contact">{p.cta}</a>
                  </li>
                );
              })}
            </ul>

            <h3 className="table-title">方案比較</h3>
            <table className="compare">
              <caption className="sr-only">各方案功能差異比較</caption>
              <thead>
                <tr>
                  <th scope="col">功能</th>
                  {plans.map((p) => <th scope="col" key={p.id}>{p.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((r) => (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    {r.values.map((v, i) => <td key={i}>{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
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
      <header className="topbar">
        <span className="logo">Flowdesk</span>
      </header>
      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title">Flowdesk</h1>
          <p className="lead">讓團隊協作更簡單，把專案、任務與報表集中在同一個地方。</p>
          <div className="actions">
            <a className="btn primary" href="#pricing">開始試用</a>
            <a className="btn outline" href="#contact">聯絡業務</a>
          </div>
        </section>

        <section className="section" aria-labelledby="features-title">
          <h2 id="features-title">功能亮點</h2>
          <ul className="features">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <Pricing />

        <section className="section" aria-labelledby="faq-title">
          <h2 id="faq-title">常見問題</h2>
          <div className="faq">
            {FAQS.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer id="contact" className="footer">
        <h2>聯絡我們</h2>
        <p>
          業務信箱：<a href="mailto:sales@flowdesk.example">sales@flowdesk.example</a>
          　電話：<a href="tel:+886223456789">02-2345-6789</a>
        </p>
        <p>© 2026 Flowdesk Inc. 保留一切權利。</p>
      </footer>
    </>
  );
}
