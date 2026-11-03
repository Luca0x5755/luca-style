import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@luca-style/tokens/css';
import '@luca-style/react/fonts.css';
import '@luca-style/react/css';
import './styles.css';
import { Button, ContentState, ThemeProvider } from '@luca-style/react';

type Mode = 'loading' | 'empty' | 'error' | 'success';
type Plan = {
  id: string;
  name: string;
  monthly: number;
  blurb: string;
  features: string[];
  cta: string;
  recommended?: boolean;
};

const PLANS: Plan[] = [
  { id: 'starter', name: '入門', monthly: 490, blurb: '適合個人與小型團隊起步。', cta: '開始試用', features: ['最多 5 位成員', '10 個專案', '基本報表', '電子郵件支援'] },
  { id: 'pro', name: '專業', monthly: 1490, blurb: '成長中團隊的完整協作功能。', cta: '開始試用', recommended: true, features: ['最多 50 位成員', '無限專案', '進階報表', '自動化流程', '優先支援'] },
  { id: 'enterprise', name: '企業', monthly: 3990, blurb: '大型組織所需的安全與管控。', cta: '聯絡業務', features: ['無限成員', '單一登入（SSO）', '稽核紀錄', '專屬客戶經理', '99.9% 服務水準'] },
];

const COMPARE: { feature: string; values: string[] }[] = [
  { feature: '團隊成員', values: ['5 位', '50 位', '無限'] },
  { feature: '專案數量', values: ['10 個', '無限', '無限'] },
  { feature: '報表', values: ['基本', '進階', '進階'] },
  { feature: '自動化流程', values: ['不提供', '提供', '提供'] },
  { feature: '單一登入（SSO）', values: ['不提供', '不提供', '提供'] },
  { feature: '客服支援', values: ['電子郵件', '優先支援', '專屬客戶經理'] },
];

function readMode(): Mode {
  const s = new URLSearchParams(window.location.search).get('state');
  return s === 'loading' || s === 'empty' || s === 'error' ? s : 'success';
}

// 假的非同步 API：依網址參數模擬各種結果
function fetchPlans(mode: Mode): Promise<Plan[]> {
  return new Promise((resolve, reject) => {
    if (mode === 'loading') return; // 永遠不結束
    setTimeout(() => {
      if (mode === 'error') reject(new Error('fake api failure'));
      else if (mode === 'empty') resolve([]);
      else resolve(PLANS);
    }, 600);
  });
}

const fmt = (n: number) => `NT$${n.toLocaleString('en-US')}`;

type Data = { status: 'loading' } | { status: 'error' } | { status: 'ready'; plans: Plan[] };

function Pricing() {
  const mode = readMode();
  const [data, setData] = useState<Data>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [yearly, setYearly] = useState(false);

  useEffect(() => {
    let alive = true;
    setData({ status: 'loading' });
    fetchPlans(mode).then(
      plans => alive && setData({ status: 'ready', plans }),
      () => alive && setData({ status: 'error' }),
    );
    return () => { alive = false; };
  }, [mode, attempt]);

  let body;
  if (data.status === 'loading') {
    body = (
      <div data-eval-state="loading">
        <ContentState state="loading" title="正在載入方案" description="請稍候，我們正在取得最新的定價方案。" />
      </div>
    );
  } else if (data.status === 'error') {
    body = (
      <div data-eval-state="error" className="state-box">
        <ContentState state="error" title="無法載入定價方案" description="連線發生問題，方案資料沒有取得成功。請重新嘗試。" retryLabel="重新載入" onRetry={() => setAttempt(a => a + 1)} />
      </div>
    );
  } else if (data.plans.length === 0) {
    body = (
      <div data-eval-state="empty" className="state-box">
        <ContentState state="empty" title="目前沒有開放購買的方案" description="我們正在調整產品方案，暫時無法線上訂閱。歡迎聯絡業務，由專人為您安排合適的方案。" />
        <div className="actions">
          <Button render={<a href="#contact" />}>聯絡業務</Button>
        </div>
      </div>
    );
  } else {
    const plans = data.plans;
    body = (
      <div data-eval-state="success">
        <div className="toggle" role="group" aria-label="計費週期">
          <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>月繳</button>
          <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>年繳（省 20%）</button>
        </div>
        <div className="plans">
          {plans.map(p => {
            const price = yearly ? p.monthly * 0.8 : p.monthly;
            return (
              <article key={p.id} className={`card plan${p.recommended ? ' featured' : ''}`} aria-labelledby={`plan-${p.id}`}>
                {p.recommended && <span className="badge">推薦</span>}
                <h3 id={`plan-${p.id}`}>{p.name}</h3>
                <p>{p.blurb}</p>
                <div>
                  <div className="price">{fmt(Math.round(price))} <small>/ 月</small></div>
                  <div className="note">{yearly ? `年繳，每年 ${fmt(Math.round(price * 12))}` : '月繳，可隨時取消'}</div>
                </div>
                <ul className="features">{p.features.map(f => <li key={f}>{f}</li>)}</ul>
                <Button variant={p.recommended ? 'primary' : 'secondary'} render={<a href={p.cta === '聯絡業務' ? '#contact' : '#pricing'} />}>{p.cta}</Button>
              </article>
            );
          })}
        </div>
        <div className="compare">
          <h3>方案比較</h3>
          <div className="scroll" role="region" aria-label="方案比較表（可左右捲動）" tabIndex={0}>
            <table>
              <caption className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>各方案功能差異</caption>
              <thead>
                <tr>
                  <th scope="col">功能</th>
                  {plans.map(p => <th key={p.id} scope="col">{p.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(r => (
                  <tr key={r.feature}>
                    <th scope="row">{r.feature}</th>
                    {r.values.map((v, i) => <td key={i}>{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section id="pricing" aria-labelledby="pricing-title">
      <div className="wrap">
        <div className="section-head">
          <h2 id="pricing-title">定價方案</h2>
          <p>選擇適合團隊規模的方案，年繳每月再省 20%。</p>
        </div>
        {body}
      </div>
    </section>
  );
}

const FEATURES = [
  { t: '即時協作', d: '團隊成員同步編輯、留言與追蹤進度，所有變更即時呈現。' },
  { t: '自動化流程', d: '用簡單的規則取代重複工作，把時間留給真正重要的事。' },
  { t: '洞察報表', d: '一目了然的儀表板，讓你隨時掌握專案狀態與團隊績效。' },
];

const FAQ = [
  { q: '試用期有多長？', a: '所有方案都提供 14 天免費試用，不需要綁定信用卡。' },
  { q: '可以隨時更換方案嗎？', a: '可以。升級立即生效，降級會在下一個計費週期開始時生效。' },
  { q: '年繳如何計費？', a: '年繳每月價格為月繳的 8 折，並於購買時一次收取全年費用。' },
  { q: '提供哪些付款方式？', a: '支援信用卡與銀行轉帳；企業方案可開立發票並採月結。' },
  { q: '資料安全如何保障？', a: '資料傳輸與儲存皆加密，並定期進行第三方安全稽核。' },
];

function App() {
  return (
    <ThemeProvider suite="professional" target="document">
      <header className="site-header">
        <div className="wrap">
          <a className="brand" href="/">雲端協作 Nimbus</a>
          <nav className="site-nav" aria-label="主要導覽">
            <ul>
              <li><a href="#features">功能</a></li>
              <li><a href="#pricing">定價</a></li>
              <li><a href="#faq">常見問題</a></li>
              <li><a href="#contact">聯絡</a></li>
            </ul>
          </nav>
        </div>
      </header>
      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="wrap">
            <h1 id="hero-title">Nimbus：讓團隊協作更簡單</h1>
            <p>把專案、任務與溝通整合在同一處，用更少的時間完成更多的事。</p>
            <div className="actions">
              <Button render={<a href="#pricing" />}>開始試用</Button>
              <Button variant="secondary" render={<a href="#contact" />}>聯絡業務</Button>
            </div>
          </div>
        </section>
        <section id="features" aria-labelledby="features-title">
          <div className="wrap">
            <div className="section-head"><h2 id="features-title">功能亮點</h2></div>
            <div className="grid">
              {FEATURES.map(f => (
                <div className="card" key={f.t}><h3>{f.t}</h3><p>{f.d}</p></div>
              ))}
            </div>
          </div>
        </section>
        <Pricing />
        <section id="faq" aria-labelledby="faq-title">
          <div className="wrap">
            <div className="section-head"><h2 id="faq-title">常見問題</h2></div>
            <div className="faq">
              {FAQ.map(f => (
                <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer" id="contact">
        <div className="wrap">
          <strong>聯絡我們</strong>
          <p>業務洽詢：<a href="mailto:sales@nimbus.example">sales@nimbus.example</a></p>
          <p>電話：<a href="tel:+886-2-1234-5678">02-1234-5678</a>（週一至週五 9:00–18:00）</p>
          <small>© 2026 Nimbus Inc. 版權所有。</small>
        </div>
      </footer>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
