import '@luca-style/tokens/css';
import '@luca-style/react/fonts.css';
import '@luca-style/react/css';
import './styles.css';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, ContentState, DataTable, MetricCard, Select, StatusMessage, TextField, ThemeProvider } from '@luca-style/react';
import { fetchDashboard, type Alert, type Dashboard, type DashboardState, type Metric, type Point, type RangeKey, type Service, type Severity, type Status } from './data';

const STATUS_LABEL: Record<Status, string> = { ok: '✓ 正常', degraded: '! 降級', down: '✕ 中斷' };
const SEVERITY_LABEL: Record<Severity, string> = { critical: '▲ 嚴重', warning: '! 警告', info: 'i 資訊' };
const RANGE_LABEL: Record<RangeKey, string> = { '1h': '1 小時', '24h': '24 小時', '7d': '7 天' };

function readState(): DashboardState {
  const s = new URLSearchParams(window.location.search).get('state');
  return s === 'loading' || s === 'empty' || s === 'error' ? s : 'success';
}

const timeFmt = new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
const dateTimeFmt = new Intl.DateTimeFormat('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const dayFmt = new Intl.DateTimeFormat('zh-TW', { month: '2-digit', day: '2-digit' });

function fmtTick(t: number, range: RangeKey) {
  return range === '7d' ? dayFmt.format(t) : timeFmt.format(t);
}

type Req = { status: 'loading' } | { status: 'error' } | { status: 'empty' } | { status: 'success'; data: Dashboard };

function useDashboard(state: DashboardState) {
  const [req, setReq] = useState<Req>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setReq({ status: 'loading' });
    fetchDashboard(state).then(
      data => live && setReq(data ? { status: 'success', data } : { status: 'empty' }),
      () => live && setReq({ status: 'error' }),
    );
    return () => { live = false; };
  }, [state, attempt]);
  return { req, retry: () => setAttempt(n => n + 1) };
}

function MetricRow({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="metrics">
      {metrics.map(m => {
        const dir = m.change > 0 ? '上升' : '下降';
        const arrow = m.change > 0 ? '▲' : '▼';
        const good = m.goodWhenUp ? m.change > 0 : m.change < 0;
        return (
          <MetricCard
            key={m.key}
            label={m.label}
            value={m.value}
            detail={<span className="delta">{arrow} {dir} {Math.abs(m.change)}{m.unit}，{good ? '表現較佳' : '需留意'}（相較上一段時間）</span>}
          />
        );
      })}
    </div>
  );
}

function LineChart({ title, points, pick, format, range, unit }: {
  title: string; points: Point[]; pick: (p: Point) => number; format: (v: number) => string; range: RangeKey; unit: string;
}) {
  const vals = points.map(pick);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const span = max - min || 1;
  const W = 100, H = 100;
  const coords = vals.map((v, i) => `${(i / Math.max(points.length - 1, 1)) * W},${H - 6 - ((v - min) / span) * (H - 12)}`).join(' ');
  return (
    <figure className="chart" style={{ margin: 0 }}>
      <figcaption><h3>{title}</h3><p className="muted">最高 {format(max)}、最低 {format(min)}、目前 {format(vals[vals.length - 1])}{unit}</p></figcaption>
      <div className="chart-body">
        <div className="y-axis" aria-hidden="true"><span>{format(max)}</span><span>{format(min)}</span></div>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${title}走勢圖，詳細數值見下方資料表`}>
          <polyline points={coords} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="x-axis" aria-hidden="true"><span>{fmtTick(points[0].t, range)}</span><span>{fmtTick(points[points.length - 1].t, range)}</span></div>
      </div>
    </figure>
  );
}

function TrendPanel({ series }: { series: Dashboard['series'] }) {
  const [range, setRange] = useState<RangeKey>('24h');
  const points = series[range];
  return (
    <section className="panel" aria-labelledby="trend-h">
      <div className="toolbar">
        <div>
          <h2 id="trend-h">趨勢</h2>
          <p className="muted">最近 {RANGE_LABEL[range]}的請求量與錯誤率</p>
        </div>
        <div className="btn-group" role="group" aria-label="時間範圍">
          {(Object.keys(RANGE_LABEL) as RangeKey[]).map(k => (
            <Button key={k} variant={k === range ? 'primary' : 'secondary'} aria-pressed={k === range} onClick={() => setRange(k)}>
              {RANGE_LABEL[k]}
            </Button>
          ))}
        </div>
      </div>
      <div className="charts">
        <LineChart title="請求量" points={points} pick={p => p.requests} format={v => v.toLocaleString('en-US')} range={range} unit=" 次" />
        <LineChart title="錯誤率" points={points} pick={p => p.errorRate} format={v => `${v.toFixed(2)}%`} range={range} unit="" />
      </div>
      <details>
        <summary>檢視圖表資料表</summary>
        <div className="scroll tall" tabIndex={0} role="region" aria-label="趨勢資料表（可捲動）">
          <DataTable
            caption={`最近 ${RANGE_LABEL[range]}的請求量與錯誤率`}
            rows={points}
            rowKey={p => String(p.t)}
            columns={[
              { key: 't', heading: '時間', render: p => (range === '7d' ? dayFmt : dateTimeFmt).format(p.t) },
              { key: 'r', heading: '請求量', render: p => p.requests.toLocaleString('en-US') },
              { key: 'e', heading: '錯誤率', render: p => `${p.errorRate.toFixed(2)}%` },
            ]}
          />
        </div>
      </details>
    </section>
  );
}

function ServicePanel({ services }: { services: Service[] }) {
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const rows = useMemo(() => {
    const list = services.filter(s => filter === 'all' || s.status === filter);
    return list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant') * (order === 'asc' ? 1 : -1));
  }, [services, filter, order]);
  return (
    <section className="panel" aria-labelledby="svc-h">
      <div>
        <h2 id="svc-h">服務清單</h2>
        <p className="muted" role="status">顯示 {rows.length} / {services.length} 個服務</p>
      </div>
      <div className="filters">
        <Select label="依狀態篩選" value={filter} onChange={e => setFilter(e.target.value as 'all' | Status)}>
          <option value="all">全部</option>
          <option value="ok">正常</option>
          <option value="degraded">降級</option>
          <option value="down">中斷</option>
        </Select>
        <Select label="依服務名稱排序" value={order} onChange={e => setOrder(e.target.value as 'asc' | 'desc')}>
          <option value="asc">由 A 到 Z（升冪）</option>
          <option value="desc">由 Z 到 A（降冪）</option>
        </Select>
      </div>
      <div className="scroll" tabIndex={0} role="region" aria-label="服務清單表格（可捲動）">
        <DataTable
          caption="服務狀態"
          rows={rows}
          rowKey={s => s.id}
          columns={[
            { key: 'name', heading: '服務名稱', render: s => s.name },
            { key: 'status', heading: '狀態', render: s => <span className={`badge ${s.status}`}>{STATUS_LABEL[s.status]}</span> },
            { key: 'lat', heading: '回應時間', render: s => (s.status === 'down' ? '—（無回應）' : `${s.latencyMs} ms`) },
            { key: 'chk', heading: '最近檢查時間', render: s => dateTimeFmt.format(s.checkedAt) },
          ]}
        />
      </div>
      {rows.length === 0 && <StatusMessage tone="warning" label="提示">沒有符合此狀態的服務。</StatusMessage>}
    </section>
  );
}

function AlertItem({ alert, onAck }: { alert: Alert; onAck?: (id: string) => void }) {
  return (
    <li className={`alert ${alert.severity}`}>
      <div className="meta">
        <span className="sev">{SEVERITY_LABEL[alert.severity]}</span>
        <strong>{alert.service}</strong>
        <time dateTime={new Date(alert.at).toISOString()}>{dateTimeFmt.format(alert.at)}</time>
      </div>
      <p>{alert.description}</p>
      {onAck && (
        <Button variant="secondary" onClick={() => onAck(alert.id)} aria-label={`將「${alert.service}：${alert.description}」標記為已確認`}>
          標記為已確認
        </Button>
      )}
    </li>
  );
}

function AlertPanel({ alerts }: { alerts: Alert[] }) {
  const [acked, setAcked] = useState<string[]>([]);
  const open = alerts.filter(a => !acked.includes(a.id));
  const done = alerts.filter(a => acked.includes(a.id));
  return (
    <section className="panel" aria-labelledby="alert-h">
      <h2 id="alert-h">告警</h2>
      <div className="alerts">
        <div className="stack">
          <h3>未確認（{open.length}）</h3>
          {open.length === 0 ? <StatusMessage tone="success" label="完成">所有告警都已確認。</StatusMessage> : (
            <ul aria-label="未確認告警">{open.map(a => <AlertItem key={a.id} alert={a} onAck={id => setAcked(x => [...x, id])} />)}</ul>
          )}
        </div>
        <div className="stack">
          <h3>已確認（{done.length}）</h3>
          {done.length === 0 ? <p className="muted">尚未確認任何告警。</p> : <ul aria-label="已確認告警">{done.map(a => <AlertItem key={a.id} alert={a} />)}</ul>}
        </div>
      </div>
    </section>
  );
}

function EmptyView() {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [done, setDone] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) { setDone(name.trim()); setAdding(false); setName(''); }
  };
  return (
    <div className="panel center">
      <ContentState state="empty" title="還沒有受監控的服務" description="新增第一個服務，開始追蹤請求量、錯誤率與回應時間。" />
      {done && <StatusMessage tone="success" label="已送出">「{done}」已加入監控設定（示範，不會實際建立）。</StatusMessage>}
      {adding ? (
        <form className="add-form" onSubmit={submit}>
          <TextField label="服務名稱" helper="例如：訂單服務" value={name} onChange={e => setName(e.target.value)} required autoComplete="off" />
          <div className="btn-group">
            <Button type="submit">新增服務</Button>
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>取消</Button>
          </div>
        </form>
      ) : (
        <Button onClick={() => setAdding(true)}>新增第一個服務</Button>
      )}
    </div>
  );
}

function App() {
  const state = useMemo(readState, []);
  const { req, retry } = useDashboard(state);
  return (
    <main className="page">
      <header>
        <h1>服務監控</h1>
        <p className="muted">掌握服務健康度、流量趨勢與目前的告警。</p>
      </header>
      {req.status === 'loading' && (
        <section data-eval-state="loading" aria-label="服務監控資料">
          <ContentState state="loading" title="載入中" description="正在取得監控資料…" />
        </section>
      )}
      {req.status === 'empty' && (
        <section data-eval-state="empty" aria-label="服務監控資料">
          <EmptyView />
        </section>
      )}
      {req.status === 'error' && (
        <section data-eval-state="error" aria-label="服務監控資料">
          <div className="panel">
            <ContentState state="error" title="無法載入監控資料" description="連線到監控 API 時失敗，目前顯示的不是最新資料。請稍後重試。" retryLabel="重新載入" onRetry={retry} />
          </div>
        </section>
      )}
      {req.status === 'success' && (
        <section data-eval-state="success" aria-label="服務監控資料" className="stack">
          <MetricRow metrics={req.data.metrics} />
          <TrendPanel series={req.data.series} />
          <ServicePanel services={req.data.services} />
          <AlertPanel alerts={req.data.alerts} />
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <ThemeProvider suite="professional" target="document">
    <App />
  </ThemeProvider>,
);
