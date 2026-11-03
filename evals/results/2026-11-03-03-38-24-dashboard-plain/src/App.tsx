import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchDashboard } from './data';
import type { Alert, DashboardData, Point, Range, Service, Severity, Status } from './data';

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; data: DashboardData };

const STATUS_LABEL: Record<Status, string> = { ok: '正常', degraded: '降級', down: '中斷' };
const STATUS_ICON: Record<Status, string> = { ok: '●', degraded: '▲', down: '✖' };
const SEV_LABEL: Record<Severity, string> = { critical: '嚴重', warning: '警告', info: '資訊' };
const RANGE_LABEL: Record<Range, string> = { '1h': '1 小時', '24h': '24 小時', '7d': '7 天' };

const fmt = new Intl.NumberFormat('zh-TW');

function ago(t: number, now: number) {
  const m = Math.max(0, Math.round((now - t) / 60000));
  if (m < 1) return '剛剛';
  if (m < 60) return `${m} 分鐘前`;
  if (m < 1440) return `${Math.floor(m / 60)} 小時前`;
  return `${Math.floor(m / 1440)} 天前`;
}
function clock(t: number, range: Range) {
  const d = new Date(t);
  const hm = d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
  return range === '7d' ? `${d.getMonth() + 1}/${d.getDate()} ${hm}` : hm;
}

function getState() {
  const s = new URLSearchParams(window.location.search).get('state');
  return s === 'loading' || s === 'empty' || s === 'error' ? s : 'success';
}

export default function App() {
  const state = getState();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });

  const run = useCallback(() => {
    setLoad({ kind: 'loading' });
    fetchDashboard(state).then(
      (data) => setLoad({ kind: 'ready', data }),
      (e: Error) => setLoad({ kind: 'error', message: e.message }),
    );
  }, [state]);

  useEffect(run, [run]);

  let body;
  if (load.kind === 'loading') {
    body = (
      <section data-eval-state="loading" aria-busy="true" aria-labelledby="st-title">
        <h2 id="st-title" className="sr-only">資料載入中</h2>
        <p role="status" className="loading-msg">正在載入監控資料…</p>
        <div className="cards" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <div key={i} className="card skeleton" />)}
        </div>
        <div className="skeleton block" aria-hidden="true" />
        <div className="skeleton block" aria-hidden="true" />
      </section>
    );
  } else if (load.kind === 'error') {
    body = (
      <section data-eval-state="error" className="panel notice" aria-labelledby="st-title">
        <h2 id="st-title">無法載入監控資料</h2>
        <p role="alert">{load.message}。請檢查網路連線後再試一次。</p>
        <button type="button" className="btn primary" onClick={run}>重試</button>
      </section>
    );
  } else if (load.data.services.length === 0) {
    body = (
      <section data-eval-state="empty" className="panel notice" aria-labelledby="st-title">
        <h2 id="st-title">尚未監控任何服務</h2>
        <p>你的帳號下還沒有受監控的服務。新增第一個服務後，這裡會顯示請求量、錯誤率與告警。</p>
        <a className="btn primary" href="#add-service" onClick={(e) => e.preventDefault()}>新增第一個服務</a>
      </section>
    );
  } else {
    body = <Dashboard data={load.data} />;
  }

  return (
    <div className="page">
      <header>
        <h1>服務監控</h1>
      </header>
      <main>{body}</main>
    </div>
  );
}

function Delta({ cur, prev, unit, lowerIsBetter, digits = 0 }: { cur: number; prev: number; unit: string; lowerIsBetter?: boolean; digits?: number }) {
  const diff = cur - prev;
  const pct = prev === 0 ? 0 : (diff / prev) * 100;
  const up = diff > 0;
  const flat = diff === 0;
  const good = flat ? true : lowerIsBetter ? !up : up;
  const text = unit === 'pt' ? `${Math.abs(diff).toFixed(digits)} 個百分點` : `${Math.abs(pct).toFixed(1)}%`;
  return (
    <p className={`delta ${good ? 'good' : 'bad'}`}>
      <span aria-hidden="true">{flat ? '—' : up ? '▲' : '▼'}</span>{' '}
      {flat ? '與上一段時間持平' : `${up ? '上升' : '下降'} ${text}`}
      <span className="muted"> （相較上一段時間）</span>
    </p>
  );
}

function Dashboard({ data }: { data: DashboardData }) {
  const s = data.summary;
  const [now] = useState(() => Date.now());
  return (
    <section data-eval-state="success" aria-label="服務監控儀表板">
      <h2 className="sr-only">監控總覽</h2>
      <ul className="cards" aria-label="摘要指標">
        <li className="card">
          <h3>請求量</h3>
          <p className="big">{fmt.format(s.requests)}</p>
          <Delta cur={s.requests} prev={s.requestsPrev} unit="%" />
        </li>
        <li className="card">
          <h3>錯誤率</h3>
          <p className="big">{s.errorRate.toFixed(1)}%</p>
          <Delta cur={s.errorRate} prev={s.errorRatePrev} unit="pt" lowerIsBetter digits={1} />
        </li>
        <li className="card">
          <h3>平均回應時間</h3>
          <p className="big">{s.latency} ms</p>
          <Delta cur={s.latency} prev={s.latencyPrev} unit="%" lowerIsBetter />
        </li>
        <li className="card">
          <h3>線上服務數</h3>
          <p className="big">{s.online} / {s.total}</p>
          <Delta cur={s.online} prev={s.onlinePrev} unit="%" />
        </li>
      </ul>
      <Trends series={data.series} />
      <ServiceList services={data.services} now={now} />
      <Alerts alerts={data.alerts} now={now} />
    </section>
  );
}

function Trends({ series }: { series: Record<Range, Point[]> }) {
  const [range, setRange] = useState<Range>('24h');
  const pts = series[range];
  return (
    <section className="panel" aria-labelledby="trend-h">
      <div className="row">
        <h2 id="trend-h">趨勢</h2>
        <div role="group" aria-label="時間範圍" className="seg">
          {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>
      <p className="muted">最近 {RANGE_LABEL[range]}的請求量與錯誤率</p>
      <LineChart title="請求量（次）" pts={pts} pick={(p) => p.requests} color="#1d4ed8" range={range} format={(v) => fmt.format(Math.round(v))} />
      <LineChart title="錯誤率（%）" pts={pts} pick={(p) => p.errorRate} color="#b91c1c" range={range} format={(v) => v.toFixed(2)} />
      <details className="data-details">
        <summary>檢視資料表（{RANGE_LABEL[range]}）</summary>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="趨勢資料表，可捲動">
          <table>
            <caption className="sr-only">最近 {RANGE_LABEL[range]}的請求量與錯誤率</caption>
            <thead><tr><th scope="col">時間</th><th scope="col" className="num">請求量</th><th scope="col" className="num">錯誤率 (%)</th></tr></thead>
            <tbody>
              {pts.map((p) => (
                <tr key={p.t}><th scope="row">{clock(p.t, range)}</th><td className="num">{fmt.format(p.requests)}</td><td className="num">{p.errorRate.toFixed(2)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function LineChart({ title, pts, pick, color, range, format }: { title: string; pts: Point[]; pick: (p: Point) => number; color: string; range: Range; format: (v: number) => string }) {
  const W = 600, H = 180, L = 52, R = 10, T = 10, B = 24;
  const vals = pts.map(pick);
  const max = Math.max(...vals), min = Math.min(...vals);
  const lo = Math.max(0, min - (max - min) * 0.1), hi = max + (max - min) * 0.1 || 1;
  const x = (i: number) => L + (i / Math.max(1, pts.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const path = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ticks = [lo, (lo + hi) / 2, hi];
  const xi = [0, Math.floor((pts.length - 1) / 2), pts.length - 1];
  const summary = `${title}：最低 ${format(min)}，最高 ${format(max)}，最新 ${format(vals[vals.length - 1])}`;
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#d1d5db" />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#4b5563">{format(v)}</text>
          </g>
        ))}
        {xi.map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'} fontSize="11" fill="#4b5563">{clock(pts[i].t, range)}</text>
        ))}
        <path d={path} fill="none" stroke={color} strokeWidth="2" />
      </svg>
    </figure>
  );
}

function ServiceList({ services, now }: { services: Service[]; now: number }) {
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [asc, setAsc] = useState(true);
  const rows = useMemo(() => {
    const f = services.filter((s) => filter === 'all' || s.status === filter);
    return [...f].sort((a, b) => (asc ? 1 : -1) * a.name.localeCompare(b.name));
  }, [services, filter, asc]);
  return (
    <section className="panel" aria-labelledby="svc-h">
      <div className="row">
        <h2 id="svc-h">服務清單</h2>
        <div className="field">
          <label htmlFor="status-filter">狀態篩選</label>
          <select id="status-filter" value={filter} onChange={(e) => setFilter(e.target.value as 'all' | Status)}>
            <option value="all">全部</option>
            <option value="ok">正常</option>
            <option value="degraded">降級</option>
            <option value="down">中斷</option>
          </select>
        </div>
      </div>
      <p className="muted" role="status">顯示 {rows.length} / {services.length} 個服務</p>
      {rows.length === 0 ? (
        <p className="muted">沒有符合此狀態的服務。</p>
      ) : (
        <table className="services">
          <thead>
            <tr>
              <th scope="col" aria-sort={asc ? 'ascending' : 'descending'}>
                <button type="button" className="sort" onClick={() => setAsc(!asc)}>
                  服務名稱 <span aria-hidden="true">{asc ? '↑' : '↓'}</span>
                  <span className="sr-only">，點擊切換為{asc ? '降冪' : '升冪'}排序</span>
                </button>
              </th>
              <th scope="col">狀態</th>
              <th scope="col" className="num">回應時間</th>
              <th scope="col">最近檢查</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <th scope="row" className="name">{s.name}</th>
                <td><span className={`badge ${s.status}`}><span aria-hidden="true">{STATUS_ICON[s.status]}</span> {STATUS_LABEL[s.status]}</span></td>
                <td className="num">{s.latency === null ? '—' : `${s.latency} ms`}</td>
                <td>{ago(s.checkedAt, now)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Alerts({ alerts, now }: { alerts: Alert[]; now: number }) {
  const [acked, setAcked] = useState<Set<string>>(new Set());
  const open = alerts.filter((a) => !acked.has(a.id));
  const done = alerts.filter((a) => acked.has(a.id));
  const item = (a: Alert, isDone: boolean) => (
    <li key={a.id} className="alert">
      <div>
        <p><span className={`sev ${a.severity}`}>{SEV_LABEL[a.severity]}</span> <strong>{a.serviceName}</strong></p>
        <p>{a.message}</p>
        <p className="muted">{ago(a.at, now)}</p>
      </div>
      {!isDone && (
        <button type="button" className="btn" onClick={() => setAcked(new Set(acked).add(a.id))}>
          確認<span className="sr-only">告警：{a.serviceName} {a.message}</span>
        </button>
      )}
    </li>
  );
  return (
    <section className="panel" aria-labelledby="alert-h">
      <h2 id="alert-h">告警</h2>
      <h3>未確認（{open.length}）</h3>
      {open.length ? <ul className="alerts">{open.map((a) => item(a, false))}</ul> : <p className="muted">目前沒有未確認的告警。</p>}
      <h3>已確認（{done.length}）</h3>
      {done.length ? <ul className="alerts">{done.map((a) => item(a, true))}</ul> : <p className="muted">尚無已確認的告警。</p>}
    </section>
  );
}
