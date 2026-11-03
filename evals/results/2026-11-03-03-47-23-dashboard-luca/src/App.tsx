import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, ContentState, DataTable, MetricCard, Select } from '@luca-style/react';
import {
  fetchDashboard, type Alert, type Dashboard, type DashboardState, type RangeKey, type Service,
  type ServiceStatus, type Severity, type TrendPoint,
} from './data';

const STATUS_LABEL: Record<ServiceStatus, string> = { ok: '正常', degraded: '降級', down: '中斷' };
const STATUS_ICON: Record<ServiceStatus, string> = { ok: '✓', degraded: '▲', down: '✕' };
const SEVERITY_LABEL: Record<Severity, string> = { critical: '嚴重', warning: '警告', info: '資訊' };
const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
const RANGES: { key: RangeKey; label: string }[] = [
  { key: '1h', label: '1 小時' }, { key: '24h', label: '24 小時' }, { key: '7d', label: '7 天' },
];

const dateTime = new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const num = new Intl.NumberFormat('zh-TW');

function readState(): DashboardState {
  const value = new URLSearchParams(window.location.search).get('state');
  return value === 'loading' || value === 'empty' || value === 'error' ? value : 'success';
}

function relative(from: number, now: number) {
  const minutes = Math.max(0, Math.round((now - from) / 60_000));
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} 小時前` : `${Math.round(hours / 24)} 天前`;
}

function delta(current: number, previous: number, unit: string, digits = 1) {
  const pct = ((current - previous) / previous) * 100;
  const dir = pct >= 0 ? '▲ 上升' : '▼ 下降';
  return `${dir} ${Math.abs(pct).toFixed(digits)}%，${unit}`;
}

function Chart({ title, label, points, pick, unit, className, format }: {
  title: string; label: string; points: TrendPoint[]; pick: (p: TrendPoint) => number; unit: string; className: string;
  format: (v: number) => string;
}) {
  const values = points.map(pick);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 600, h = 200, pad = 12;
  const path = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const first = dateTime.format(points[0].at);
  const last = dateTime.format(points[points.length - 1].at);
  const summary = `${title}，${label}，${first} 至 ${last}，最低 ${format(min)}${unit}，最高 ${format(max)}${unit}。完整數字見下方資料表。`;
  return (
    <figure className="chart" style={{ margin: 0 }}>
      <h3>{title}</h3>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={summary}>
        {[0.25, 0.5, 0.75].map(f => <line key={f} className="grid-line" x1="0" x2={w} y1={h * f} y2={h * f} strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
        <path d={path} className={className} fill="none" strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="meta">最低 {format(min)}{unit} · 最高 {format(max)}{unit} · {first} 至 {last}</figcaption>
    </figure>
  );
}

function TrendPanel({ data }: { data: Dashboard }) {
  const [range, setRange] = useState<RangeKey>('24h');
  const points = data.trends[range];
  const label = RANGES.find(r => r.key === range)!.label;
  return (
    <section className="panel" aria-labelledby="trend-h">
      <h2 id="trend-h">請求量與錯誤率趨勢</h2>
      <div className="toolbar">
        <fieldset className="range-group">
          <legend>時間範圍</legend>
          <div className="range-buttons">
            {RANGES.map(r => (
              <Button key={r.key} variant={r.key === range ? 'primary' : 'secondary'} aria-pressed={r.key === range} onClick={() => setRange(r.key)}>{r.label}</Button>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="charts">
        <Chart title="請求量" label={`最近 ${label}`} points={points} pick={p => p.requests} unit=" 次" className="line-req" format={v => num.format(v)} />
        <Chart title="錯誤率" label={`最近 ${label}`} points={points} pick={p => p.errorRate} unit="%" className="line-err" format={v => v.toFixed(2)} />
      </div>
      <details className="data">
        <summary>檢視趨勢資料表（最近 {label}）</summary>
        <div className="scroll tall" role="region" aria-label={`最近 ${label} 趨勢資料表，可捲動`} tabIndex={0}>
          <DataTable
            caption={`最近 ${label}的請求量與錯誤率`}
            rows={points}
            rowKey={p => String(p.at)}
            columns={[
              { key: 'at', heading: '時間', render: p => dateTime.format(p.at) },
              { key: 'req', heading: '請求量', render: p => num.format(p.requests) },
              { key: 'err', heading: '錯誤率', render: p => `${p.errorRate.toFixed(2)}%` },
            ]}
          />
        </div>
      </details>
    </section>
  );
}

function ServicesPanel({ services, now }: { services: Service[]; now: number }) {
  const [filter, setFilter] = useState<'all' | ServiceStatus>('all');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const rows = useMemo(() => {
    const list = services.filter(s => filter === 'all' || s.status === filter);
    list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant') * (order === 'asc' ? 1 : -1));
    return list;
  }, [services, filter, order]);
  return (
    <section className="panel" aria-labelledby="svc-h">
      <h2 id="svc-h">服務清單</h2>
      <div className="toolbar">
        <Select label="依狀態篩選" value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
          <option value="all">全部狀態</option>
          <option value="ok">正常</option>
          <option value="degraded">降級</option>
          <option value="down">中斷</option>
        </Select>
        <Select label="服務名稱排序" value={order} onChange={e => setOrder(e.target.value as typeof order)}>
          <option value="asc">名稱 由小到大</option>
          <option value="desc">名稱 由大到小</option>
        </Select>
      </div>
      <p className="sub-note" role="status">顯示 {rows.length} / {services.length} 個服務</p>
      {rows.length === 0 ? <p>沒有符合此狀態的服務。</p> : (
        <div className="scroll" role="region" aria-label="服務清單表格，可捲動" tabIndex={0}>
          <DataTable
            caption="服務狀態"
            rows={rows}
            rowKey={s => s.id}
            columns={[
              { key: 'name', heading: '服務名稱', render: s => s.name },
              { key: 'status', heading: '狀態', render: s => <span className={`badge ${s.status}`}><span aria-hidden="true">{STATUS_ICON[s.status]}</span>{STATUS_LABEL[s.status]}</span> },
              { key: 'ms', heading: '回應時間', render: s => (s.responseMs === null ? '無回應' : `${s.responseMs} ms`) },
              { key: 'chk', heading: '最近檢查', render: s => relative(s.checkedAt, now) },
            ]}
          />
        </div>
      )}
    </section>
  );
}

function AlertItem({ alert, onAck, now }: { alert: Alert; onAck?: (id: string) => void; now: number }) {
  return (
    <li className="alert-item">
      <div>
        <div className="alert-head">
          <span className={`badge ${alert.severity}`}>{SEVERITY_LABEL[alert.severity]}</span>
          <strong>{alert.service}</strong>
        </div>
        <p>{alert.message}</p>
        <p className="when">發生於 {dateTime.format(alert.occurredAt)}（{relative(alert.occurredAt, now)}）</p>
      </div>
      {onAck && <Button variant="secondary" aria-label={`標記為已確認：${alert.service} ${alert.message}`} onClick={() => onAck(alert.id)}>標記為已確認</Button>}
    </li>
  );
}

function AlertsPanel({ alerts, now }: { alerts: Alert[]; now: number }) {
  const [acked, setAcked] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const active = alerts.filter(a => !acked.includes(a.id)).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.occurredAt - a.occurredAt);
  const done = alerts.filter(a => acked.includes(a.id));
  const ack = (id: string) => {
    const a = alerts.find(x => x.id === id)!;
    setAcked(list => [...list, id]);
    setNotice(`已確認：${a.service} ${a.message}`);
  };
  return (
    <section className="panel" aria-labelledby="alert-h">
      <h2 id="alert-h">告警</h2>
      <p className="visually-hidden" role="status">{notice}</p>
      <h3>目前告警（{active.length}）</h3>
      {active.length === 0 ? <p className="sub-note">目前沒有未確認的告警。</p> : (
        <ul className="alert-list">{active.map(a => <AlertItem key={a.id} alert={a} onAck={ack} now={now} />)}</ul>
      )}
      <h3 style={{ marginTop: 'var(--space-6)' }}>已確認（{done.length}）</h3>
      {done.length === 0 ? <p className="sub-note">尚未確認任何告警。</p> : (
        <ul className="alert-list">{done.map(a => <AlertItem key={a.id} alert={a} now={now} />)}</ul>
      )}
    </section>
  );
}

function Success({ data }: { data: Dashboard }) {
  const s = data.summary;
  return (
    <section data-eval-state="success" className="dash" aria-label="服務監控資料">
      <ul className="metrics" aria-label="摘要指標">
        <li><MetricCard label="請求量（24 小時）" value={num.format(s.requests)} detail={delta(s.requests, s.prevRequests, '相較前 24 小時')} /></li>
        <li><MetricCard label="錯誤率" value={`${s.errorRate.toFixed(2)}%`} detail={delta(s.errorRate, s.prevErrorRate, '相較前 24 小時')} /></li>
        <li><MetricCard label="平均回應時間" value={`${s.avgMs} ms`} detail={delta(s.avgMs, s.prevAvgMs, '相較前 24 小時')} /></li>
        <li><MetricCard label="線上服務數" value={`${s.online} / ${s.total}`} detail={`${s.online >= s.prevOnline ? '▲ 上升' : '▼ 下降'} ${Math.abs(s.online - s.prevOnline)} 個，相較前 24 小時`} /></li>
      </ul>
      <TrendPanel data={data} />
      <ServicesPanel services={data.services} now={data.fetchedAt} />
      <AlertsPanel alerts={data.alerts} now={data.fetchedAt} />
    </section>
  );
}

export function App() {
  const state = readState();
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'empty' | 'error' | 'success'>('loading');
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    fetchDashboard(state).then(
      result => { if (!cancelled) { setData(result); setPhase(result ? 'success' : 'empty'); } },
      () => { if (!cancelled) setPhase('error'); },
    );
    return () => { cancelled = true; };
  }, [state, attempt]);

  const retry = useCallback(() => setAttempt(n => n + 1), []);

  let body;
  if (phase === 'success' && data) body = <Success data={data} />;
  else if (phase === 'empty') {
    body = (
      <section data-eval-state="empty" className="panel empty-box" aria-labelledby="empty-h">
        <h2 id="empty-h">還沒有受監控的服務</h2>
        <p>新增第一個服務後，這裡會顯示請求量、錯誤率、服務狀態與告警。</p>
        <ol>
          <li>輸入服務名稱與健康檢查網址</li>
          <li>選擇檢查頻率</li>
          <li>儲存後約一分鐘內出現第一筆資料</li>
        </ol>
        <Button onClick={() => window.alert('此為示範頁面，尚未提供新增服務表單。')}>新增第一個服務</Button>
      </section>
    );
  } else if (phase === 'error') {
    body = (
      <section data-eval-state="error" className="panel" role="alert">
        <ContentState state="error" title="無法載入監控資料" description="連線到監控 API 失敗，目前顯示的資料不完整。請檢查網路後再試一次。" retryLabel="重試" onRetry={retry} />
      </section>
    );
  } else {
    body = (
      <section data-eval-state="loading" className="panel" aria-busy="true">
        <ContentState state="loading" title="正在載入監控資料" description="請稍候…" />
      </section>
    );
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>服務監控</h1>
        <p>即時掌握服務狀態、流量趨勢與告警。</p>
      </header>
      {body}
    </main>
  );
}
