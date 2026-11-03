export type Status = 'ok' | 'degraded' | 'down';
export type Severity = 'critical' | 'warning' | 'info';
export type Range = '1h' | '24h' | '7d';

export interface Service {
  id: string;
  name: string;
  status: Status;
  responseMs: number;
  checkedAt: string;
}
export interface Alert {
  id: string;
  severity: Severity;
  service: string;
  description: string;
  at: string;
}
export interface Point {
  label: string;
  requests: number;
  errorRate: number;
}
export interface Summary {
  requests: number;
  requestsPrev: number;
  errorRate: number;
  errorRatePrev: number;
  avgMs: number;
  avgMsPrev: number;
  online: number;
  onlinePrev: number;
  total: number;
}
export interface DashboardData {
  summary: Summary;
  trends: Record<Range, Point[]>;
  services: Service[];
  alerts: Alert[];
}

const NOW = Date.now();
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (minsAgo: number) => new Date(NOW - minsAgo * 60000).toISOString();

function makeSeries(count: number, stepMin: number, fmt: (d: Date) => string, seed: number): Point[] {
  const out: Point[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(NOW - i * stepMin * 60000);
    const k = count - i;
    const wave = Math.sin((k + seed) / 3.2) * 0.25 + Math.cos((k * seed) / 7) * 0.1;
    const requests = Math.round((stepMin / 60) * 52000 * (1 + wave));
    const errorRate = Math.max(0.1, +(1.1 + Math.sin((k + seed) / 2.1) * 0.6 + (k % 7 === 0 ? 0.8 : 0)).toFixed(2));
    out.push({ label: fmt(d), requests, errorRate });
  }
  return out;
}

const services: Service[] = [
  { id: 's1', name: 'api-gateway', status: 'ok', responseMs: 86, checkedAt: iso(1) },
  { id: 's2', name: 'auth-service', status: 'ok', responseMs: 112, checkedAt: iso(1) },
  { id: 's3', name: 'payment-service', status: 'degraded', responseMs: 640, checkedAt: iso(2) },
  { id: 's4', name: 'order-service', status: 'ok', responseMs: 143, checkedAt: iso(2) },
  { id: 's5', name: 'search-service', status: 'degraded', responseMs: 520, checkedAt: iso(3) },
  { id: 's6', name: 'notification-service', status: 'down', responseMs: 0, checkedAt: iso(4) },
  { id: 's7', name: 'user-profile', status: 'ok', responseMs: 98, checkedAt: iso(1) },
  { id: 's8', name: 'inventory-service', status: 'ok', responseMs: 175, checkedAt: iso(5) },
  { id: 's9', name: 'report-worker', status: 'down', responseMs: 0, checkedAt: iso(7) },
  { id: 's10', name: 'cdn-edge', status: 'ok', responseMs: 34, checkedAt: iso(1) },
];

const alerts: Alert[] = [
  { id: 'a1', severity: 'critical', service: 'notification-service', description: '健康檢查連續 5 次失敗，服務無回應', at: iso(18) },
  { id: 'a2', severity: 'critical', service: 'report-worker', description: '背景工作佇列停滯，積壓超過 2,000 筆', at: iso(42) },
  { id: 'a3', severity: 'warning', service: 'payment-service', description: 'P95 回應時間超過 600 ms', at: iso(65) },
  { id: 'a4', severity: 'warning', service: 'search-service', description: '錯誤率 3.2%，高於門檻 2%', at: iso(130) },
  { id: 'a5', severity: 'info', service: 'api-gateway', description: '憑證將於 14 天後到期', at: iso(300) },
];

function build(): DashboardData {
  return {
    summary: {
      requests: 1284500,
      requestsPrev: 1190200,
      errorRate: 1.42,
      errorRatePrev: 1.18,
      avgMs: 168,
      avgMsPrev: 181,
      online: services.filter((s) => s.status !== 'down').length,
      onlinePrev: 9,
      total: services.length,
    },
    trends: {
      '1h': makeSeries(12, 5, (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`, 3),
      '24h': makeSeries(24, 60, (d) => `${pad(d.getHours())}:00`, 5),
      '7d': makeSeries(7, 1440, (d) => `${d.getMonth() + 1}/${d.getDate()}`, 8),
    },
    services,
    alerts,
  };
}

/** 假的非同步 API。loading 永遠不會結束。 */
export function fetchDashboard(state: string): Promise<DashboardData> {
  return new Promise((resolve, reject) => {
    if (state === 'loading') return;
    setTimeout(() => {
      if (state === 'error') return reject(new Error('無法連線到監控 API（503）'));
      if (state === 'empty') {
        const e = build();
        return resolve({
          summary: { ...e.summary, requests: 0, total: 0, online: 0 },
          trends: { '1h': [], '24h': [], '7d': [] },
          services: [],
          alerts: [],
        });
      }
      resolve(build());
    }, 700);
  });
}
