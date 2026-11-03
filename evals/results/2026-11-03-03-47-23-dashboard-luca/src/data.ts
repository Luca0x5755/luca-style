export type DashboardState = 'loading' | 'empty' | 'error' | 'success';
export type ServiceStatus = 'ok' | 'degraded' | 'down';
export type Severity = 'critical' | 'warning' | 'info';
export type RangeKey = '1h' | '24h' | '7d';

export type Service = { id: string; name: string; status: ServiceStatus; responseMs: number | null; checkedAt: number };
export type Alert = { id: string; severity: Severity; service: string; message: string; occurredAt: number };
export type TrendPoint = { at: number; requests: number; errorRate: number };
export type Summary = {
  requests: number; prevRequests: number;
  errorRate: number; prevErrorRate: number;
  avgMs: number; prevAvgMs: number;
  online: number; prevOnline: number; total: number;
};
export type Dashboard = {
  summary: Summary;
  trends: Record<RangeKey, TrendPoint[]>;
  services: Service[];
  alerts: Alert[];
  fetchedAt: number;
};

const MIN = 60_000;
const HOUR = 60 * MIN;

function buildTrend(now: number, count: number, step: number, base: number, seed: number): TrendPoint[] {
  return Array.from({ length: count }, (_, i) => {
    const at = now - (count - 1 - i) * step;
    const hour = new Date(at).getHours();
    const daily = 1 + 0.35 * Math.sin(((hour - 9) / 24) * Math.PI * 2);
    const noise = 1 + 0.08 * Math.sin(i * 1.7 + seed);
    const requests = Math.round(base * daily * noise);
    const spike = i === count - 4 ? 1.9 : 1;
    const errorRate = Math.round((0.6 + 0.25 * Math.sin(i * 0.9 + seed) + 0.3 * daily) * spike * 100) / 100;
    return { at, requests, errorRate };
  });
}

function build(): Dashboard {
  const now = Date.now();
  const services: Service[] = [
    { id: 'gateway', name: 'API 閘道', status: 'ok', responseMs: 86, checkedAt: now - 1 * MIN },
    { id: 'auth', name: '驗證服務', status: 'ok', responseMs: 112, checkedAt: now - 1 * MIN },
    { id: 'orders', name: '訂單服務', status: 'degraded', responseMs: 640, checkedAt: now - 2 * MIN },
    { id: 'payments', name: '支付服務', status: 'down', responseMs: null, checkedAt: now - 3 * MIN },
    { id: 'search', name: '搜尋服務', status: 'ok', responseMs: 143, checkedAt: now - 2 * MIN },
    { id: 'notify', name: '通知服務', status: 'degraded', responseMs: 478, checkedAt: now - 4 * MIN },
    { id: 'reports', name: '報表服務', status: 'ok', responseMs: 220, checkedAt: now - 5 * MIN },
    { id: 'storage', name: '檔案儲存', status: 'ok', responseMs: 97, checkedAt: now - 1 * MIN },
    { id: 'jobs', name: '排程服務', status: 'ok', responseMs: 64, checkedAt: now - 6 * MIN },
  ];
  const alerts: Alert[] = [
    { id: 'a1', severity: 'critical', service: '支付服務', message: '健康檢查連續 3 次失敗，服務無回應', occurredAt: now - 12 * MIN },
    { id: 'a2', severity: 'critical', service: '訂單服務', message: '錯誤率超過 5%，已持續 10 分鐘', occurredAt: now - 25 * MIN },
    { id: 'a3', severity: 'warning', service: '通知服務', message: '平均回應時間高於 400 毫秒', occurredAt: now - 48 * MIN },
    { id: 'a4', severity: 'warning', service: '檔案儲存', message: '儲存空間使用率達 85%', occurredAt: now - 2 * HOUR },
    { id: 'a5', severity: 'info', service: '驗證服務', message: '憑證將於 14 天後到期', occurredAt: now - 5 * HOUR },
    { id: 'a6', severity: 'info', service: '排程服務', message: '夜間批次作業完成時間比平常晚 20 分鐘', occurredAt: now - 9 * HOUR },
  ];
  return {
    summary: {
      requests: 1_284_300, prevRequests: 1_146_900,
      errorRate: 1.42, prevErrorRate: 1.18,
      avgMs: 187, prevAvgMs: 203,
      online: 8, prevOnline: 9, total: services.length,
    },
    trends: {
      '1h': buildTrend(now, 12, 5 * MIN, 2400, 1),
      '24h': buildTrend(now, 24, HOUR, 52000, 2),
      '7d': buildTrend(now, 28, 6 * HOUR, 310000, 3),
    },
    services,
    alerts,
    fetchedAt: now,
  };
}

/** 假的非同步 API：依 state 決定行為，不接後端。 */
export function fetchDashboard(state: DashboardState): Promise<Dashboard | null> {
  return new Promise((resolve, reject) => {
    if (state === 'loading') return; // 永遠不結束
    setTimeout(() => {
      if (state === 'error') reject(new Error('無法連線到監控 API'));
      else if (state === 'empty') resolve(null);
      else resolve(build());
    }, 700);
  });
}
