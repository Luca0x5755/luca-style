import { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { fetchDashboard } from './api';
import type { Alert, DashboardData, Point, Range, Service, Status } from './api';

const STATUS_LABEL: Record<Status, string> = { ok: '正常', degraded: '降級', down: '中斷' };
const STATUS_ICON: Record<Status, string> = { ok: '●', degraded: '▲', down: '■' };
const SEV_LABEL = { critical: '嚴重', warning: '警告', info: '提示' } as const;
const RANGE_LABEL: Record<Range, string> = { '1h': '1 小時', '24h': '24 小時', '7d': '7 天' };

const fmtNum = (n: number) => n.toLocaleString('en-US');
const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'data'; data: DashboardData };

function useDashboard(state: string) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const run = useCallback(() => {
    let cancelled = false;
    setLoad({ kind: 'loading' });
    fetchDashboard(state).then(
      (data) => !cancelled && setLoad({ kind: 'data', data }),
      (e: Error) => !cancelled && setLoad({ kind: 'error', message: e.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [state]);
  const [tick, setTick] = useState(0);
  useEffect(() => run(), [run, tick]);
  return { load, retry: () => setTick((t) => t + 1) };
}

function Delta({ cur, prev, goodWhenUp, unit = '' }: { cur: number; prev: number; goodWhenUp: boolean; unit?: string }) {
  const diff = cur - prev;
  const up = diff >= 0;
  const pct = prev === 0 ? 0 : (Math.abs(diff) / prev) * 100;
  const good = up === goodWhenUp;
  return (
    <p className={`delta ${good ? 'good' : 'bad'}`}>
      <span aria-hidden="true">{up ? '▲' : '▼'}</span> {up ? '上升' : '下降'} {pct.toFixed(1)}%{unit}
      <span className="muted"> 較上一段時間</span>
    </p>
  );
}

function SummaryRow({ data }: { data: DashboardData }) {
  const s = data.summary;
  return (
    <section aria-labelledby="h-summary">
      <h2 id="h-summary" className="sr-only">摘要</h2>
      <ul className="cards">
        <li className="card">
          <h3>請求量</h3>
          <p className="value">{fmtNum(s.requests)}</p>
          <Delta cur={s.requests} prev={s.requestsPrev} goodWhenUp />
        </li>
        <li className="card">
          <h3>錯誤率</h3>
          <p className="value">{s.errorRate.toFixed(2)}%</p>
          <Delta cur={s.errorRate} prev={s.errorRatePrev} goodWhenUp={false} />
        </li>
        <li className="card">
          <h3>平均回應時間</h3>
          <p className="value">{s.avgMs} ms</p>
          <Delta cur={s.avgMs} prev={s.avgMsPrev} goodWhenUp={false} />
        </li>
        <li className="card">
          <h3>線上服務數</h3>
          <p className="value">
            {s.online} / {s.total}
          </p>
          <Delta cur={s.online} prev={s.onlinePrev} goodWhenUp />
        </li>
      </ul>
    </section>
  );
}

function LineChart({ points, field, title, color, format }: { points: Point[]; field: 'requests' | 'errorRate'; title: string; color: string; format: (n: number) => string }) {
  const W = 640, H = 200, L = 56, R = 12, T = 12, B = 28;
  const vals = points.map((p) => p[field]);
  const max = Math.max(...vals) * 1.1;
  const min = Math.min(0, ...vals);
  const x = (i: number) => L + (points.length === 1 ? 0 : (i * (W - L - R)) / (points.length - 1));
  const y = (v: number) => T + (1 - (v - min) / (max - min || 1)) * (H - T - B);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[field]).toFixed(1)}`).join(' ');
  const ticks = [0, 0.5, 1].map((t) => min + t * (max - min));
  const step = Math.ceil(points.length / 6);
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}折線圖，詳細數值請見下方資料表`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#d5dbe3" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="12" fill="#4a5568">{format(t)}</text>
          </g>
        ))}
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p[field])} r="3" fill={color} />
            {i % step === 0 && (
              <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="12" fill="#4a5568">{p.label}</text>
            )}
          </g>
        ))}
      </svg>
    </figure>
  );
}

function Trends({ data }: { data: DashboardData }) {
  const [range, setRange] = useState<Range>('24h');
  const points = data.trends[range];
  return (
    <section aria-labelledby="h-trend" className="panel">
      <div className="panel-head">
        <h2 id="h-trend">流量趨勢（{RANGE_LABEL[range]}）</h2>
        <div role="group" aria-label="時間範圍" className="seg">
          {(['1h', '24h', '7d'] as Range[]).map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>
      <div className="charts">
        <LineChart points={points} field="requests" title="請求量" color="#1d4ed8" format={(n) => fmtNum(Math.round(n))} />
        <LineChart points={points} field="errorRate" title="錯誤率 (%)" color="#b42318" format={(n) => n.toFixed(1)} />
      </div>
      <details className="data-details">
        <summary>檢視資料表</summary>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">{RANGE_LABEL[range]}請求量與錯誤率</caption>
            <thead>
              <tr>
                <th scope="col">時間</th>
                <th scope="col" className="num">請求量</th>
                <th scope="col" className="num">錯誤率</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={i}>
                  <th scope="row">{p.label}</th>
                  <td className="num">{fmtNum(p.requests)}</td>
                  <td className="num">{p.errorRate.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function ServiceList({ services }: { services: Service[] }) {
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [asc, setAsc] = useState(true);
  const rows = useMemo(() => {
    const f = services.filter((s) => filter === 'all' || s.status === filter);
    return [...f].sort((a, b) => (asc ? 1 : -1) * a.name.localeCompare(b.name));
  }, [services, filter, asc]);
  return (
    <section aria-labelledby="h-services" className="panel">
      <div className="panel-head">
        <h2 id="h-services">服務清單</h2>
        <div className="field">
          <label htmlFor="status-filter">依狀態篩選</label>
          <select id="status-filter" value={filter} onChange={(e) => setFilter(e.target.value as 'all' | Status)}>
            <option value="all">全部</option>
            <option value="ok">正常</option>
            <option value="degraded">降級</option>
            <option value="down">中斷</option>
          </select>
        </div>
      </div>
      <p className="muted" role="status">顯示 {rows.length} / {services.length} 個服務</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col" aria-sort={asc ? 'ascending' : 'descending'}>
                <button type="button" className="sort" onClick={() => setAsc(!asc)}>
                  服務名稱 <span aria-hidden="true">{asc ? '▲' : '▼'}</span>
                  <span className="sr-only">，點擊切換排序方向</span>
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
                <td>
                  <span className={`badge ${s.status}`}>
                    <span aria-hidden="true">{STATUS_ICON[s.status]}</span> {STATUS_LABEL[s.status]}
                  </span>
                </td>
                <td className="num">{s.status === 'down' ? '—' : `${s.responseMs} ms`}</td>
                <td>{fmtTime(s.checkedAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4}>沒有符合條件的服務。</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AlertItem({ a, onAck }: { a: Alert; onAck?: (id: string) => void }) {
  return (
    <li className="alert">
      <div>
        <span className={`sev ${a.severity}`}>{SEV_LABEL[a.severity]}</span>{' '}
        <strong>{a.service}</strong>
        <p>{a.description}</p>
        <p className="muted">發生時間：{fmtTime(a.at)}</p>
      </div>
      {onAck && (
        <button type="button" className="btn" onClick={() => onAck(a.id)} aria-label={`確認告警：${a.service} ${a.description}`}>
          標記為已確認
        </button>
      )}
    </li>
  );
}

function Alerts({ alerts }: { alerts: Alert[] }) {
  const [acked, setAcked] = useState<string[]>([]);
  const active = alerts.filter((a) => !acked.includes(a.id));
  const done = alerts.filter((a) => acked.includes(a.id));
  return (
    <section aria-labelledby="h-alerts" className="panel">
      <h2 id="h-alerts">告警</h2>
      <h3>進行中（{active.length}）</h3>
      {active.length === 0 ? (
        <p className="muted" role="status">目前沒有未確認的告警。</p>
      ) : (
        <ul className="alerts">
          {active.map((a) => (
            <AlertItem key={a.id} a={a} onAck={(id) => setAcked((x) => [...x, id])} />
          ))}
        </ul>
      )}
      <h3>已確認（{done.length}）</h3>
      {done.length === 0 ? (
        <p className="muted">尚無已確認的告警。</p>
      ) : (
        <ul className="alerts acked">
          {done.map((a) => (
            <AlertItem key={a.id} a={a} />
          ))}
        </ul>
      )}
    </section>
  );
}

function App() {
  const state = new URLSearchParams(location.search).get('state') ?? 'success';
  const { load, retry } = useDashboard(state);
  let body;
  if (load.kind === 'loading') {
    body = (
      <section data-eval-state="loading" aria-busy="true" className="state-box">
        <p role="status" className="loading-text"><span className="spinner" aria-hidden="true" />資料載入中…</p>
        <div className="skeleton-cards" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" />)}
        </div>
        <div className="skeleton tall" aria-hidden="true" />
      </section>
    );
  } else if (load.kind === 'error') {
    body = (
      <section data-eval-state="error" className="state-box">
        <h2>無法載入監控資料</h2>
        <p role="alert">{load.message}。請檢查網路連線後再試一次。</p>
        <button type="button" className="btn primary" onClick={retry}>重試</button>
      </section>
    );
  } else if (load.data.services.length === 0) {
    body = (
      <section data-eval-state="empty" className="state-box">
        <h2>還沒有任何受監控的服務</h2>
        <p>新增第一個服務，開始追蹤請求量、錯誤率與回應時間。</p>
        <button type="button" className="btn primary" onClick={() => alert('新增服務流程（示意）')}>新增第一個服務</button>
      </section>
    );
  } else {
    body = (
      <section data-eval-state="success" className="stack">
        <SummaryRow data={load.data} />
        <Trends data={load.data} />
        <ServiceList services={load.data.services} />
        <Alerts alerts={load.data.alerts} />
      </section>
    );
  }
  return (
    <>
      <header className="top"><h1>服務監控</h1></header>
      <main>{body}</main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
