import { useCallback, useEffect, useId, useState } from 'react';
import { fetchDashboard, type Alert, type Dashboard, type Point, type Range, type Service, type Status } from './api';

type Load = { s: 'loading' } | { s: 'error'; msg: string } | { s: 'empty' } | { s: 'success'; d: Dashboard };

const fmtTime = (iso: string) => new Date(iso).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const num = (n: number) => n.toLocaleString('zh-TW');
const statusText: Record<Status, string> = { ok: '正常', degraded: '降級', down: '中斷' };
const sevText = { critical: '嚴重', warning: '警告', info: '提示' } as const;

export default function App() {
  const [st, setSt] = useState<Load>({ s: 'loading' });
  const load = useCallback(() => {
    setSt({ s: 'loading' });
    fetchDashboard().then(
      d => setSt(d ? { s: 'success', d } : { s: 'empty' }),
      e => setSt({ s: 'error', msg: e instanceof Error ? e.message : '未知錯誤' }),
    );
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="page">
      <header><h1>服務監控</h1></header>
      <main>
        {st.s === 'loading' && <Loading />}
        {st.s === 'error' && (
          <section data-eval-state="error" className="panel notice" role="alert">
            <h2>無法載入監控資料</h2>
            <p>{st.msg}。請檢查網路連線後再試一次。</p>
            <button className="btn primary" onClick={load}>重試</button>
          </section>
        )}
        {st.s === 'empty' && (
          <section data-eval-state="empty" className="panel notice">
            <h2>還沒有受監控的服務</h2>
            <p>新增第一個服務後，這裡會顯示請求量、錯誤率、回應時間與告警。</p>
            <button className="btn primary" onClick={() => window.alert('新增服務流程（示意）')}>新增第一個服務</button>
          </section>
        )}
        {st.s === 'success' && <Success d={st.d} />}
      </main>
    </div>
  );
}

function Loading() {
  return (
    <section data-eval-state="loading" aria-busy="true">
      <p role="status" className="muted">載入中…</p>
      <div className="cards">{[0, 1, 2, 3].map(i => <div key={i} className="card skel" />)}</div>
      <div className="panel skel tall" />
      <div className="panel skel tall" />
      <div className="panel skel tall" />
    </section>
  );
}

function Success({ d }: { d: Dashboard }) {
  const s = d.summary;
  const pct = (a: number, b: number) => ((a - b) / b) * 100;
  const cards = [
    { k: '請求量', v: num(s.requests), c: pct(s.requests, s.prev.requests), goodUp: true },
    { k: '錯誤率', v: s.errorRate.toFixed(1) + '%', c: pct(s.errorRate, s.prev.errorRate), goodUp: false },
    { k: '平均回應時間', v: s.latency + ' ms', c: pct(s.latency, s.prev.latency), goodUp: false },
    { k: '線上服務數', v: `${s.online} / ${s.total}`, c: pct(s.online, s.prev.online), goodUp: true },
  ];
  return (
    <section data-eval-state="success">
      <h2 className="sr">摘要</h2>
      <div className="cards">
        {cards.map(c => {
          const up = c.c >= 0, good = up === c.goodUp;
          return (
            <div className="card" key={c.k}>
              <div className="muted">{c.k}</div>
              <div className="big">{c.v}</div>
              <div className={good ? 'delta good' : 'delta bad'}>
                {up ? '▲ 上升' : '▼ 下降'} {Math.abs(c.c).toFixed(1)}%
                <span className="muted"> 較上一段時間</span>
              </div>
            </div>
          );
        })}
      </div>
      <Trend trends={d.trends} />
      <ServiceList services={d.services} />
      <Alerts alerts={d.alerts} />
    </section>
  );
}

function Trend({ trends }: { trends: Record<Range, Point[]> }) {
  const [range, setRange] = useState<Range>('24h');
  const pts = trends[range];
  const opts: [Range, string][] = [['1h', '1 小時'], ['24h', '24 小時'], ['7d', '7 天']];
  return (
    <section className="panel" aria-labelledby="trend-h">
      <div className="row">
        <h2 id="trend-h">趨勢</h2>
        <div role="group" aria-label="時間範圍" className="seg">
          {opts.map(([k, l]) => (
            <button key={k} className="btn" aria-pressed={range === k} onClick={() => setRange(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="charts">
        <Chart title="請求量" pts={pts} pick={p => p.requests} color="#1d4ed8" fmt={num} />
        <Chart title="錯誤率 (%)" pts={pts} pick={p => p.errorRate} color="#b91c1c" fmt={v => v.toFixed(1)} />
      </div>
      <details>
        <summary>檢視資料表</summary>
        <div className="tablewrap">
          <table>
            <caption className="sr">{opts.find(o => o[0] === range)![1]}趨勢資料</caption>
            <thead><tr><th scope="col">時間</th><th scope="col" className="r">請求量</th><th scope="col" className="r">錯誤率</th></tr></thead>
            <tbody>
              {pts.map((p, i) => <tr key={i}><th scope="row">{p.label}</th><td className="r">{num(p.requests)}</td><td className="r">{p.errorRate.toFixed(1)}%</td></tr>)}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function Chart({ title, pts, pick, color, fmt }: { title: string; pts: Point[]; pick: (p: Point) => number; color: string; fmt: (n: number) => string }) {
  const W = 600, H = 180, L = 8, R = 8, T = 10, B = 24;
  const vals = pts.map(pick);
  const max = Math.max(...vals), min = Math.min(...vals);
  const lo = Math.max(0, min - (max - min) * 0.2), span = max - lo || 1;
  const x = (i: number) => L + (pts.length === 1 ? 0 : (i * (W - L - R)) / (pts.length - 1));
  const y = (v: number) => T + (1 - (v - lo) / span) * (H - T - B);
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const idx = [0, Math.floor((pts.length - 1) / 2), pts.length - 1];
  return (
    <figure className="chart">
      <figcaption>{title}<span className="muted">　最高 {fmt(max)}・最低 {fmt(min)}</span></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}趨勢折線圖，最高 ${fmt(max)}，最低 ${fmt(min)}，詳細數值請見資料表`}>
        {[0, 0.5, 1].map(t => <line key={t} x1={L} x2={W - R} y1={T + t * (H - T - B)} y2={T + t * (H - T - B)} stroke="#e2e8f0" />)}
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        {vals.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={color} />)}
        {idx.map((i, k) => <text key={k} x={x(i)} y={H - 6} fontSize="13" fill="#475569" textAnchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}>{pts[i].label}</text>)}
      </svg>
    </figure>
  );
}

function ServiceList({ services }: { services: Service[] }) {
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [asc, setAsc] = useState(true);
  const id = useId();
  const rows = services.filter(s => filter === 'all' || s.status === filter)
    .sort((a, b) => (asc ? 1 : -1) * a.name.localeCompare(b.name));
  return (
    <section className="panel" aria-labelledby="svc-h">
      <div className="row">
        <h2 id="svc-h">服務清單</h2>
        <div>
          <label htmlFor={id}>狀態篩選　</label>
          <select id={id} value={filter} onChange={e => setFilter(e.target.value as 'all' | Status)}>
            <option value="all">全部</option>
            <option value="ok">正常</option>
            <option value="degraded">降級</option>
            <option value="down">中斷</option>
          </select>
        </div>
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th scope="col" aria-sort={asc ? 'ascending' : 'descending'}>
                <button className="link" onClick={() => setAsc(!asc)}>服務名稱 {asc ? '▲' : '▼'}<span className="sr">，點擊切換排序</span></button>
              </th>
              <th scope="col">狀態</th>
              <th scope="col" className="r">回應時間</th>
              <th scope="col">最近檢查</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.id}>
                <th scope="row" className="name">{s.name}</th>
                <td><span className={'badge ' + s.status}>{statusText[s.status]}</span></td>
                <td className="r">{s.latency === null ? '—' : s.latency + ' ms'}</td>
                <td>{fmtTime(s.checkedAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="muted">沒有符合條件的服務</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted" role="status">顯示 {rows.length} / {services.length} 個服務</p>
    </section>
  );
}

function Alerts({ alerts }: { alerts: Alert[] }) {
  const [acked, setAcked] = useState<Set<string>>(new Set());
  const active = alerts.filter(a => !acked.has(a.id));
  const done = alerts.filter(a => acked.has(a.id));
  const item = (a: Alert, isDone: boolean) => (
    <li key={a.id} className="alert">
      <div>
        <span className={'badge sev-' + a.severity}>{sevText[a.severity]}</span>{' '}
        <strong>{a.service}</strong> <span className="muted">· {fmtTime(a.at)}</span>
        <p>{a.message}</p>
      </div>
      {!isDone && <button className="btn" onClick={() => setAcked(new Set(acked).add(a.id))} aria-label={`確認告警：${a.service} ${a.message}`}>標記為已確認</button>}
    </li>
  );
  return (
    <section className="panel" aria-labelledby="al-h">
      <h2 id="al-h">告警</h2>
      <h3>目前告警 ({active.length})</h3>
      {active.length ? <ul>{active.map(a => item(a, false))}</ul> : <p className="muted" role="status">目前沒有未確認的告警。</p>}
      <h3>已確認 ({done.length})</h3>
      {done.length ? <ul>{done.map(a => item(a, true))}</ul> : <p className="muted">尚無已確認的告警。</p>}
    </section>
  );
}
