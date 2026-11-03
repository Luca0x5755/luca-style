import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Plan = {
  id: string;
  name: string;
  monthly: number;
  blurb: string;
  features: string[];
  cta: string;
  recommended?: boolean;
};

type Status = 'loading' | 'empty' | 'error' | 'success';

const PLANS: Plan[] = [
  { id: 'starter', name: '入門', monthly: 300, blurb: '適合個人與小型團隊起步', features: ['最多 3 位成員', '5 個專案', '基本報表', '電子郵件支援'], cta: '選擇入門' },
  { id: 'pro', name: '專業', monthly: 800, blurb: '成長中團隊的最佳選擇', features: ['最多 20 位成員', '無限專案', '進階報表', '優先支援', '自動化流程'], cta: '選擇專業', recommended: true },
  { id: 'enterprise', name: '企業', monthly: 2000, blurb: '大型組織的安全與規模', features: ['無限成員', '無限專案', '自訂報表', '專屬客戶經理', '單一登入 (SSO)'], cta: '洽詢企業方案' },
];

const COMPARE: { label: string; values: string[] }[] = [
  { label: '成員數', values: ['3 位', '20 位', '無限'] },
  { label: '專案數', values: ['5 個', '無限', '無限'] },
  { label: '報表', values: ['基本', '進階', '自訂'] },
  { label: '自動化流程', values: ['—', '有', '有'] },
  { label: '單一登入 (SSO)', values: ['—', '—', '有'] },
  { label: '支援', values: ['電子郵件', '優先', '專屬經理'] },
];

function getState(): string {
  return new URLSearchParams(window.location.search).get('state') ?? 'success';
}

// 假的非同步 API：依網址參數模擬各種結果
function fetchPlans(state: string): Promise<Plan[]> {
  return new Promise((resolve, reject) => {
    if (state === 'loading') return; // 永遠不結束
    setTimeout(() => {
      if (state === 'error') reject(new Error('伺服器暫時無法回應'));
      else if (state === 'empty') resolve([]);
      else resolve(PLANS);
    }, 800);
  });
}

const fmt = (n: number) => `NT$${n.toLocaleString('en-US')}`;

const FEATURES = [
  { t: '即時協作', d: '團隊成員同步編輯與留言，所有變更即時更新，不再來回寄檔案。' },
  { t: '智慧報表', d: '自動整理關鍵指標，一鍵產出可分享的圖表，讓決策更有依據。' },
  { t: '安全可靠', d: '資料加密儲存並每日備份，提供權限控管與完整稽核紀錄。' },
];

const FAQS = [
  { q: '可以免費試用嗎？', a: '可以。所有方案皆提供 14 天免費試用，不需綁定信用卡。' },
  { q: '年繳如何計費？', a: '年繳方案每月價格為月繳的 8 折，一次收取全年費用。' },
  { q: '之後可以更換方案嗎？', a: '隨時可以升級或降級，差額會依使用天數按比例計算。' },
  { q: '提供哪些付款方式？', a: '支援信用卡與銀行轉帳，企業方案可開立發票並採月結。' },
  { q: '資料可以匯出嗎？', a: '可以，您能隨時以 CSV 或 JSON 格式匯出所有資料。' },
];

function PricingArea() {
  const [status, setStatus] = useState<Status>('loading');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [yearly, setYearly] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(() => {
    let cancelled = false;
    setStatus('loading');
    fetchPlans(getState()).then(
      (p) => {
        if (cancelled) return;
        setPlans(p);
        setStatus(p.length === 0 ? 'empty' : 'success');
      },
      () => !cancelled && setStatus('error'),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load, attempt]);

  const price = (p: Plan) => (yearly ? Math.round(p.monthly * 0.8) : p.monthly);

  if (status === 'loading')
    return (
      <div data-eval-state="loading" role="status" aria-live="polite" className="state-box">
        <div className="spinner" aria-hidden="true" />
        <p>正在載入方案資料…</p>
      </div>
    );

  if (status === 'empty')
    return (
      <div data-eval-state="empty" className="state-box">
        <h3>目前沒有開放購買的方案</h3>
        <p>我們正在調整產品方案，暫時無法線上購買。歡迎聯絡業務，我們會為您安排合適的報價。</p>
        <a className="btn primary" href="mailto:sales@cloudnest.example">聯絡業務取得報價</a>
      </div>
    );

  if (status === 'error')
    return (
      <div data-eval-state="error" className="state-box error" role="alert">
        <h3>無法載入方案資料</h3>
        <p>連線發生問題，方案資料取得失敗。請檢查網路後再試一次。</p>
        <button className="btn primary" onClick={() => setAttempt((a) => a + 1)}>重新載入</button>
      </div>
    );

  return (
    <div data-eval-state="success">
      <div className="toggle" role="group" aria-label="計費週期">
        <button aria-pressed={!yearly} onClick={() => setYearly(false)}>月繳</button>
        <button aria-pressed={yearly} onClick={() => setYearly(true)}>年繳（省 20%）</button>
      </div>
      <div className="cards">
        {plans.map((p) => (
          <article key={p.id} className={'card' + (p.recommended ? ' rec' : '')} aria-labelledby={`plan-${p.id}`}>
            {p.recommended && <span className="badge">推薦</span>}
            <h3 id={`plan-${p.id}`}>{p.name}</h3>
            <p className="muted">{p.blurb}</p>
            <p className="price">
              <strong>{fmt(price(p))}</strong> <span>/ 月{yearly ? '（年繳）' : ''}</span>
            </p>
            <ul>
              {p.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <a className={'btn ' + (p.recommended ? 'primary' : 'secondary')} href="#contact">{p.cta}</a>
          </article>
        ))}
      </div>

      <h3 className="cmp-title" id="cmp-title">方案比較</h3>
      <table className="cmp" aria-labelledby="cmp-title">
        <thead>
          <tr>
            <th scope="col">功能</th>
            {plans.map((p) => (
              <th scope="col" key={p.id}>{p.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARE.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              {r.values.map((v, i) => (
                <td key={i}>{v}</td>
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row">每月價格</th>
            {plans.map((p) => (
              <td key={p.id}>{fmt(price(p))}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function App() {
  return (
    <>
      <a className="skip" href="#main">跳到主要內容</a>
      <header className="top">
        <span className="logo">CloudNest</span>
        <nav aria-label="主選單">
          <a href="#features">功能</a>
          <a href="#pricing">定價</a>
          <a href="#faq">常見問題</a>
        </nav>
      </header>
      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title">CloudNest</h1>
          <p className="lead">讓團隊協作、報表與資料管理集中在同一個地方，工作更快、更簡單。</p>
          <div className="actions">
            <a className="btn primary" href="#pricing">開始試用</a>
            <a className="btn secondary" href="#contact">聯絡業務</a>
          </div>
        </section>

        <section id="features" aria-labelledby="features-title">
          <h2 id="features-title">功能亮點</h2>
          <div className="grid">
            {FEATURES.map((f) => (
              <div className="feature" key={f.t}>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" aria-labelledby="pricing-title">
          <h2 id="pricing-title">定價方案</h2>
          <PricingArea />
        </section>

        <section id="faq" aria-labelledby="faq-title">
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
      <footer id="contact">
        <p>聯絡我們：<a href="mailto:sales@cloudnest.example">sales@cloudnest.example</a>｜電話 <a href="tel:+886212345678">02-1234-5678</a></p>
        <p>© 2026 CloudNest. 保留所有權利。</p>
      </footer>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
