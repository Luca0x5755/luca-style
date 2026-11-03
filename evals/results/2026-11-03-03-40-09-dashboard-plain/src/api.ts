export type Status = 'ok' | 'degraded' | 'down';
export interface Service { id: string; name: string; status: Status; latency: number | null; checkedAt: string }
export interface Alert { id: string; severity: 'critical' | 'warning' | 'info'; service: string; message: string; at: string }
export interface Point { label: string; requests: number; errorRate: number }
export type Range = '1h' | '24h' | '7d';
export interface Summary { requests: number; errorRate: number; latency: number; online: number; total: number; prev: { requests: number; errorRate: number; latency: number; online: number } }
export interface Dashboard { summary: Summary; trends: Record<Range, Point[]>; services: Service[]; alerts: Alert[] }

const NOW = Date.now();
const iso = (minAgo: number) => new Date(NOW - minAgo * 60000).toISOString();

function series(n: number, stepMin: number, fmt: (d: Date) => string, base: number, seed: number): Point[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(NOW - (n - 1 - i) * stepMin * 60000);
    const wave = Math.sin((i + seed) / 3.2) * 0.25 + Math.cos((i * seed) / 7) * 0.1;
    const requests = Math.round(base * (1 + wave));
    const errorRate = Math.round((0.8 + Math.abs(Math.sin((i + seed) / 2.1)) * 1.6 + (i % 11 === 0 ? 1.2 : 0)) * 10) / 10;
    return { label: fmt(d), requests, errorRate };
  });
}
const hm = (d: Date) => d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
const md = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

const serviceRows: [string, Status, number | null, number][] = [
  ['api-gateway', 'ok', 42, 1], ['auth-service', 'ok', 58, 2], ['payment-service', 'degraded', 410, 3],
  ['order-service', 'ok', 96, 1], ['search-service', 'degraded', 320, 4], ['notification-service', 'down', null, 12],
  ['inventory-service', 'ok', 71, 2], ['report-service', 'ok', 180, 5], ['image-cdn', 'ok', 24, 1],
];
const services: Service[] = serviceRows.map(([name, status, latency, m], i) => ({ id: 's' + i, name, status, latency, checkedAt: iso(m) }));

const alerts: Alert[] = [
  { id: 'a1', severity: 'critical', service: 'notification-service', message: '服務無回應，健康檢查連續失敗 5 次', at: iso(12) },
  { id: 'a2', severity: 'critical', service: 'payment-service', message: '5xx 錯誤率超過 3%', at: iso(35) },
  { id: 'a3', severity: 'warning', service: 'search-service', message: 'P95 回應時間高於 300 ms', at: iso(70) },
  { id: 'a4', severity: 'warning', service: 'report-service', message: '佇列積壓超過 500 筆', at: iso(190) },
  { id: 'a5', severity: 'info', service: 'api-gateway', message: '憑證將於 14 天後到期', at: iso(600) },
  { id: 'a6', severity: 'info', service: 'inventory-service', message: '磁碟使用率達 75%', at: iso(1300) },
];

const data: Dashboard = {
  summary: { requests: 1284500, errorRate: 1.9, latency: 134, online: 8, total: 9,
    prev: { requests: 1196200, errorRate: 1.6, latency: 148, online: 9 } },
  trends: {
    '1h': series(12, 5, hm, 5200, 3),
    '24h': series(24, 60, hm, 52000, 5),
    '7d': series(7, 1440, md, 1250000, 2),
  },
  services, alerts,
};

export type Mode = 'loading' | 'empty' | 'error' | 'success';
export function getMode(): Mode {
  const s = new URLSearchParams(window.location.search).get('state');
  return s === 'loading' || s === 'empty' || s === 'error' ? s : 'success';
}

export function fetchDashboard(): Promise<Dashboard | null> {
  const mode = getMode();
  return new Promise((resolve, reject) => {
    if (mode === 'loading') return; // 永遠不結束
    setTimeout(() => {
      if (mode === 'error') reject(new Error('無法連線到監控 API（503）'));
      else if (mode === 'empty') resolve(null);
      else resolve(data);
    }, 700);
  });
}
