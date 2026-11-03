import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Plan = { id: string; name: string; price: number; features: string[]; cta: string; recommended?: boolean };
type Mode = 'loading' | 'empty' | 'error' | 'success';

const PLANS: Plan[] = [
  { id: 'starter', name: '入門版', price: 290, features: ['最多 5 位成員', '基本報表', '電子郵件支援'], cta: '選擇入門版' },
  { id: 'pro', name: '專業版', price: 790, features: ['最多 50 位成員', '進階報表與自動化', '優先客服支援'], cta: '選擇專業版', recommended: true },
  { id: 'ent', name: '企業版', price: 1990, features: ['無限成員', '單一登入與稽核紀錄', '專屬客戶經理'], cta: '選擇企業版' },
];

const ROWS: [string, (boolean | string)[]][] = [
  ['成員人數', ['5 位', '50 位', '無限']],
  ['基本報表', [true, true, true]],
  ['進階報表與自動化', [false, true, true]],
  ['優先客服支援', [false, true, true]],
  ['單一登入 (SSO)', [false, false, true]],
  ['專屬客戶經理', [false, false, true]],
];

function getMode(): Mode {
  const s = new URLSearchParams(location.search).get('state');
  return s === 'loading' || s === 'empty' || s === 'error' ? s : 'success';
}

// 假的非同步 API
function fetchPlans(mode: Mode): Promise<Plan[]> {
  return new Promise((resolve, reject) => {
    if (mode === 'loading') return; // 永遠不 resolve，維持載入中
    setTimeout(() => {
      if (mode === 'error') reject(new Error('fail'));
      else resolve(mode === 'empty' ? [] : PLANS);
    }, 800);
  });
}

const fmt = (n: number) => 'NT$ ' + n.toLocaleString('en-US');

const FAQ = [
  ['可以免費試用嗎？', '可以，所有方案都提供 14 天免費試用，不需要信用卡。'],
  ['可以隨時更換方案嗎？', '可以，升級立即生效，降級會在下個計費週期開始套用。'],
  ['年繳如何計費？', '年繳每月價格為月繳的 8 折，一次收取全年費用。'],
  ['支援哪些付款方式？', '支援信用卡與企業匯款，企業版可開立發票與簽訂合約。'],
  ['資料安全如何保障？', '資料傳輸與儲存皆加密，並定期進行第三方安全稽核。'],
];

function Pricing() {
  const mode = getMode();
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [yearly, setYearly] = useState(false);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let live = true;
    setStatus('loading');
    fetchPlans(mode).then(
      (p) => { if (live) { setPlans(p); setStatus('ready'); } },
      () => { if (live) setStatus('error'); },
    );
    return () => { live = false; };
  }, [mode, tries]);

  const head = (
    <>
      <h2 id="pricing-title">定價方案</h2>
      <p className="lead">選擇適合團隊的方案，年繳享 8 折優惠。</p>
    </>
  );

  if (status === 'loading')
    return (
      <section className="block wrap" aria-labelledby="pricing-title" id="pricing">
        <div data-eval-state="loading">
          {head}
          <div className="state" role="status" aria-live="polite">
            <div className="spin" aria-hidden="true" />
            <h3>方案載入中…</h3>
            <p>正在取得最新的方案與價格，請稍候。</p>
          </div>
        </div>
      </section>
    );

  if (status === 'error')
    return (
      <section className="block wrap" aria-labelledby="pricing-title" id="pricing">
        <div data-eval-state="error">
          {head}
          <div className="state err" role="alert">
            <h3>無法載入方案資料</h3>
            <p>連線發生問題，方案與價格暫時無法顯示。請再試一次。</p>
            <button className="btn" onClick={() => setTries((t) => t + 1)}>重試</button>
          </div>
        </div>
      </section>
    );

  if (plans.length === 0)
    return (
      <section className="block wrap" aria-labelledby="pricing-title" id="pricing">
        <div data-eval-state="empty">
          {head}
          <div className="state emp">
            <h3>目前沒有開放購買的方案</h3>
            <p>我們正在調整產品方案，暫時不開放自助購買。歡迎聯絡業務，由專人為您報價。</p>
            <a className="btn" href="mailto:sales@flowdesk.example">聯絡業務</a>
          </div>
        </div>
      </section>
    );

  return (
    <section className="block wrap" aria-labelledby="pricing-title" id="pricing">
      <div data-eval-state="success">
        {head}
        <fieldset className="toggle">
          <legend>計費週期</legend>
          <label><input type="radio" name="cycle" checked={!yearly} onChange={() => setYearly(false)} /><span>月繳</span></label>
          <label><input type="radio" name="cycle" checked={yearly} onChange={() => setYearly(true)} /><span>年繳（省 20%）</span></label>
        </fieldset>
        <div className="plans">
          {plans.map((p) => (
            <article key={p.id} className={'plan' + (p.recommended ? ' rec' : '')} aria-labelledby={'p-' + p.id}>
              {p.recommended && <span className="badge">推薦</span>}
              <h3 id={'p-' + p.id}>{p.name}</h3>
              <div className="price">{fmt(yearly ? p.price * 0.8 : p.price)}<small> / 月</small></div>
              <p className="note">{yearly ? `年繳，共 ${fmt(p.price * 0.8 * 12)} / 年` : '按月計費'}</p>
              <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
              <a className={'btn' + (p.recommended ? '' : ' secondary')} href="#trial">{p.cta}</a>
            </article>
          ))}
        </div>
        <h3 className="sub">方案比較</h3>
        <table>
          <caption>各方案功能比較</caption>
          <thead>
            <tr><th scope="col">功能</th>{plans.map((p) => <th scope="col" key={p.id}>{p.name}</th>)}</tr>
          </thead>
          <tbody>
            {ROWS.map(([label, vals]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {vals.map((v, i) => (
                  <td key={i}>{typeof v === 'string' ? v : v ? <span aria-label="包含">✓</span> : <span aria-label="不包含">—</span>}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function App() {
  return (
    <>
      <header className="wrap nav">
        <span className="logo">Flowdesk</span>
        <nav aria-label="主選單">
          <a href="#features">功能</a><a href="#pricing">定價</a><a href="#faq">常見問題</a>
        </nav>
      </header>
      <main>
        <div className="hero" id="trial">
          <div className="wrap">
            <h1>Flowdesk：讓團隊協作更簡單</h1>
            <p>整合任務、報表與自動化流程，讓團隊把時間花在真正重要的事。</p>
            <div className="actions">
              <a className="btn" href="#pricing">開始試用</a>
              <a className="btn secondary" href="mailto:sales@flowdesk.example">聯絡業務</a>
            </div>
          </div>
        </div>
        <section className="block wrap" id="features" aria-labelledby="f-title">
          <h2 id="f-title">功能亮點</h2>
          <p className="lead">為成長中的團隊打造的核心能力。</p>
          <ul className="features">
            <li><h3>即時協作</h3><p>多人同時編輯與留言，進度一目了然。</p></li>
            <li><h3>自動化流程</h3><p>用簡單規則取代重複工作，減少人為錯誤。</p></li>
            <li><h3>洞察報表</h3><p>自訂儀表板，快速掌握團隊績效與趨勢。</p></li>
          </ul>
        </section>
        <Pricing />
        <section className="block wrap" id="faq" aria-labelledby="faq-title">
          <h2 id="faq-title">常見問題</h2>
          {FAQ.map(([q, a]) => (
            <details key={q}><summary>{q}</summary><p>{a}</p></details>
          ))}
        </section>
      </main>
      <footer>
        <div className="wrap">
          <p>聯絡我們：<a href="mailto:sales@flowdesk.example">sales@flowdesk.example</a>｜電話 02-1234-5678</p>
          <p>© 2026 Flowdesk. 保留所有權利。</p>
        </div>
      </footer>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
