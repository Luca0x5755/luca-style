import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, ContentState, DataTable, MetricCard, Select, StatusMessage, TextField } from '@luca-style/react';
import { fetchDashboard, type Alert, type DashboardData, type DashState, type Point, type Range, type Service, type ServiceStatus, type Severity } from './api';

function readState(): DashState {
  const s = new URLSearchParams(window.location.search).get('state');
  return s === 'loading' || s === 'empty' || s === 'error' ? s : 'success';
}

const rangeLabel: Record<Range, string> = { '1h': '最近 1 小時', '24h': '最近 24 小時', '7d': '最近 7 天' };
const statusText: Record<ServiceStatus, string> = { ok: '● 正常', degraded: '▲ 降級', down: '■ 中斷' };
const sevText: Record<Severity, string> = { critical: '嚴重', warning: '警告', info: '資訊' };
const sevIcon: Record<Severity, string> = { critical: '■', warning: '▲', info: '●' };
const sevOrder: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

const fmtTime = (iso: string, withDate = false) =>
  new Date(iso).toLocaleString('zh-TW', withDate
    ? { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }
    : { hour: '2-digit', minute: '2-digit', hour12: false });

function Trend({ points, field, title, unit, id }: { points: Point[]; field: 'requests' | 'errorRate'; title: string; unit: string; id: string }) {
  const values = points.map(p => p[field]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const coords = values.map((v, i) => `${(i / (values.length - 1)) * 100},${90 - ((v - min) / span) * 80}`).join(' ');
  const summary = `${title}：最低 ${min.toLocaleString()}${unit}，最高 ${max.toLocaleString()}${unit}，最新 ${values[values.length - 1].toLocaleString()}${unit}`;
  return (
    <figure className="chart" aria-labelledby={id}>
      <figcaption id={id}>{summary}</figcaption>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={summary}>
        <line x1="0" y1="90" x2="100" y2="90" className="axis" vectorEffect="non-scaling-stroke" />
        <polyline points={coords} className={field === 'requests' ? 'line-a' : 'line-b'} vectorEffect="non-scaling-stroke" />
      </svg>
    </figure>
  );
}

function TrendSection({ series }: { series: Record<Range, Point[]> }) {
  const [range, setRange] = useState<Range>('24h');
  const points = series[range];
  const long = range === '7d';
  return (
    <section className="panel" aria-labelledby="trend-h">
      <div className="panel-head">
        <h2 id="trend-h">流量趨勢</h2>
        <Select label="時間範圍" value={range} onChange={e => setRange(e.target.value as Range)}>
          <option value="1h">1 小時</option>
          <option value="24h">24 小時</option>
          <option value="7d">7 天</option>
        </Select>
      </div>
      <p className="muted">{rangeLabel[range]}，共 {points.length} 個資料點</p>
      <Trend points={points} field="requests" title="請求量" unit=" 次" id="c1" />
      <Trend points={points} field="errorRate" title="錯誤率" unit="%" id="c2" />
      <details className="data-details">
        <summary>檢視圖表資料表</summary>
        <div className="scroll" role="region" aria-label="趨勢資料表，可捲動" tabIndex={0}>
          <DataTable<Point>
            caption={`${rangeLabel[range]}請求量與錯誤率`}
            rows={points}
            rowKey={p => p.time}
            columns={[
              { key: 't', heading: '時間', render: p => fmtTime(p.time, long || range === '24h') },
              { key: 'r', heading: '請求量', render: p => p.requests.toLocaleString() },
              { key: 'e', heading: '錯誤率', render: p => `${p.errorRate}%` },
            ]}
          />
        </div>
      </details>
    </section>
  );
}

function ServicesSection({ services }: { services: Service[] }) {
  const [filter, setFilter] = useState<'all' | ServiceStatus>('all');
  const [sort, setSort] = useState<'asc' | 'desc'>('asc');
  const rows = useMemo(() => {
    const list = services.filter(s => filter === 'all' || s.status === filter);
    list.sort((a, b) => a.name.localeCompare(b.name, 'zh-TW') * (sort === 'asc' ? 1 : -1));
    return list;
  }, [services, filter, sort]);
  return (
    <section className="panel" aria-labelledby="svc-h">
      <h2 id="svc-h">服務清單</h2>
      <div className="controls">
        <Select label="狀態篩選" value={filter} onChange={e => setFilter(e.target.value as 'all' | ServiceStatus)}>
          <option value="all">全部</option>
          <option value="ok">正常</option>
          <option value="degraded">降級</option>
          <option value="down">中斷</option>
        </Select>
        <Select label="依服務名稱排序" value={sort} onChange={e => setSort(e.target.value as 'asc' | 'desc')}>
          <option value="asc">名稱 由小到大</option>
          <option value="desc">名稱 由大到小</option>
        </Select>
      </div>
      <p className="muted" role="status">顯示 {rows.length} / {services.length} 個服務</p>
      {rows.length === 0 ? (
        <p>沒有符合條件的服務，請調整狀態篩選。</p>
      ) : (
        <div className="scroll" role="region" aria-label="服務清單，可捲動" tabIndex={0}>
          <DataTable<Service>
            caption="服務狀態"
            rows={rows}
            rowKey={s => s.id}
            columns={[
              { key: 'n', heading: '服務名稱', render: s => s.name },
              { key: 's', heading: '狀態', render: s => <span className={`st st-${s.status}`}>{statusText[s.status]}</span> },
              { key: 'l', heading: '回應時間', render: s => (s.latency === null ? '無回應' : `${s.latency} ms`) },
              { key: 'c', heading: '最近檢查', render: s => <time dateTime={s.checkedAt}>{fmtTime(s.checkedAt)}</time> },
            ]}
          />
        </div>
      )}
    </section>
  );
}

function AlertsSection({ alerts }: { alerts: Alert[] }) {
  const [acked, setAcked] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const active = alerts.filter(a => !acked.includes(a.id)).sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
  const done = alerts.filter(a => acked.includes(a.id));
  const item = (a: Alert, isDone: boolean) => (
    <li key={a.id} className={`alert sev-${a.severity}`}>
      <div className="alert-body">
        <p className="alert-title"><span className="sev">{sevIcon[a.severity]} {sevText[a.severity]}</span> · {a.serviceName}</p>
        <p>{a.message}</p>
        <p className="muted"><time dateTime={a.at}>{fmtTime(a.at, true)}</time> 發生</p>
      </div>
      {isDone ? <span className="muted">已確認</span> : (
        <Button variant="secondary" aria-label={`確認告警：${a.serviceName}，${a.message}`}
          onClick={() => { setAcked(x => [...x, a.id]); setNote(`已確認 ${a.serviceName} 的告警`); }}>
          標記為已確認
        </Button>
      )}
    </li>
  );
  return (
    <section className="panel" aria-labelledby="alert-h">
      <h2 id="alert-h">告警</h2>
      <p className="visually-hidden" role="status">{note}</p>
      <h3>待處理（{active.length}）</h3>
      {active.length === 0 ? <p>目前沒有待處理的告警。</p> : <ul className="alerts">{active.map(a => item(a, false))}</ul>}
      <h3>已確認（{done.length}）</h3>
      {done.length === 0 ? <p className="muted">尚未確認任何告警。</p> : <ul className="alerts">{done.map(a => item(a, true))}</ul>}
    </section>
  );
}

function Delta({ s }: { s: { change: number; unit: string } }) {
  const dir = s.change > 0 ? '▲ 上升' : s.change < 0 ? '▼ 下降' : '– 持平';
  return <>{dir} {Math.abs(s.change)} {s.unit}，相較上一段時間</>;
}

function EmptyView() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [done, setDone] = useState(false);
  return (
    <section data-eval-state="empty" className="panel empty" aria-labelledby="empty-h">
      <h2 id="empty-h">還沒有受監控的服務</h2>
      <p>新增第一個服務後，這裡會顯示請求量、錯誤率、回應時間與告警。</p>
      {!open && <Button onClick={() => setOpen(true)}>新增第一個服務</Button>}
      {open && !done && (
        <form className="add-form" onSubmit={e => { e.preventDefault(); setDone(true); }}>
          <TextField label="服務名稱" required value={name} onChange={e => setName(e.target.value)} helper="例如：訂單服務" />
          <TextField label="健康檢查網址" type="url" required value={url} onChange={e => setUrl(e.target.value)} helper="例如：https://example.com/health" />
          <div className="row">
            <Button type="submit">儲存並開始監控</Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>取消</Button>
          </div>
        </form>
      )}
      {done && <StatusMessage tone="success">已加入「{name}」。此為展示頁面，資料不會實際儲存。</StatusMessage>}
    </section>
  );
}

export default function App() {
  const param = useMemo(readState, []);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [data, setData] = useState<DashboardData | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetchDashboard(param).then(
      d => { if (!cancelled) { setData(d); setStatus('ready'); } },
      () => { if (!cancelled) setStatus('error'); },
    );
    return () => { cancelled = true; };
  }, [param, attempt]);

  const retry = useCallback(() => setAttempt(n => n + 1), []);

  let body;
  if (status === 'loading') {
    body = (
      <section data-eval-state="loading" className="panel" aria-busy="true">
        <ContentState state="loading" title="正在載入監控資料" description="請稍候…" />
      </section>
    );
  } else if (status === 'error' || !data) {
    body = (
      <section data-eval-state="error" className="panel">
        <ContentState state="error" title="無法取得監控資料" description="監控服務目前沒有回應，資料未更新。請檢查網路後再試一次。" retryLabel="重新載入" onRetry={retry} />
      </section>
    );
  } else if (data.services.length === 0) {
    body = <EmptyView />;
  } else {
    const { summary } = data;
    body = (
      <div data-eval-state="success" className="stack">
        <section aria-label="摘要" className="metrics">
          {[summary.requests, summary.errorRate, summary.latency, summary.online].map(s => (
            <MetricCard key={s.label} label={s.label} value={s.value} detail={<Delta s={s} />} />
          ))}
        </section>
        <div className="grid">
          <TrendSection series={data.series} />
          <AlertsSection alerts={data.alerts} />
        </div>
        <ServicesSection services={data.services} />
      </div>
    );
  }

  return (
    <main className="page">
      <header>
        <h1>服務監控</h1>
        <p className="muted">掌握服務健康、流量與告警</p>
      </header>
      {body}
    </main>
  );
}
