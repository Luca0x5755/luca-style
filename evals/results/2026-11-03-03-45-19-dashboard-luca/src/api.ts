export type DashState = 'loading' | 'empty' | 'error' | 'success';
export type Range = '1h' | '24h' | '7d';
export type ServiceStatus = 'ok' | 'degraded' | 'down';
export type Severity = 'critical' | 'warning' | 'info';

export type Service = { id: string; name: string; status: ServiceStatus; latency: number | null; checkedAt: string };
export type Alert = { id: string; severity: Severity; serviceId: string; serviceName: string; message: string; at: string };
export type Point = { time: string; requests: number; errorRate: number };
export type Summary = { label: string; value: string; change: number; unit: string };
export type DashboardData = {
  summary: { requests: Summary; errorRate: Summary; latency: Summary; online: Summary };
  series: Record<Range, Point[]>;
  services: Service[];
  alerts: Alert[];
};

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function makeSeries(count: number, stepMs: number, scale: number, now: number): Point[] {
  return Array.from({ length: count }, (_, i) => {
    const t = now - (count - 1 - i) * stepMs;
    const hour = new Date(t).getHours();
    const wave = 1 + 0.45 * Math.sin(((hour - 6) / 24) * Math.PI * 2) + 0.08 * Math.sin(i * 1.7);
    const requests = Math.round(1800 * scale * wave);
    const errorRate = Math.max(0.1, +(0.9 + 0.5 * Math.sin(i * 0.9) + (i % 7 === 0 ? 0.8 : 0)).toFixed(2));
    return { time: new Date(t).toISOString(), requests, errorRate };
  });
}

function build(): DashboardData {
  const now = Date.now();
  const min = 60_000;
  const svc = (id: string, name: string, status: ServiceStatus, latency: number | null, ago: number): Service => ({
    id, name, status, latency, checkedAt: new Date(now - ago * min).toISOString(),
  });
  const services: Service[] = [
    svc('api-gateway', 'API 閘道', 'ok', 84, 1),
    svc('auth', '身分驗證服務', 'ok', 120, 1),
    svc('payment', '付款服務', 'degraded', 640, 2),
    svc('search', '搜尋服務', 'ok', 210, 3),
    svc('notify', '通知服務', 'down', null, 4),
    svc('order', '訂單服務', 'ok', 156, 1),
    svc('report', '報表服務', 'degraded', 980, 5),
    svc('storage', '檔案儲存', 'ok', 95, 2),
    svc('mail', '郵件寄送', 'ok', 310, 6),
  ];
  const alert = (id: string, severity: Severity, serviceId: string, message: string, ago: number): Alert => ({
    id, severity, serviceId, serviceName: services.find(s => s.id === serviceId)!.name, message,
    at: new Date(now - ago * min).toISOString(),
  });
  return {
    summary: {
      requests: { label: '請求量', value: '48,320', change: 6.4, unit: '次' },
      errorRate: { label: '錯誤率', value: '1.2%', change: 0.3, unit: '個百分點' },
      latency: { label: '平均回應時間', value: '218 ms', change: -4.8, unit: '%' },
      online: { label: '線上服務數', value: '7 / 9', change: -1, unit: '個' },
    },
    series: {
      '1h': makeSeries(12, 5 * min, 0.08, now),
      '24h': makeSeries(24, 60 * min, 1, now),
      '7d': makeSeries(28, 6 * 60 * min, 1.1, now),
    },
    services,
    alerts: [
      alert('a1', 'critical', 'notify', '健康檢查連續 5 次逾時，服務無回應', 12),
      alert('a2', 'critical', 'payment', '付款授權失敗率超過 5%', 25),
      alert('a3', 'warning', 'report', '平均回應時間超過 900 ms', 48),
      alert('a4', 'warning', 'mail', '寄送佇列堆積超過 1,000 封', 95),
      alert('a5', 'info', 'storage', '儲存空間使用率達 80%', 180),
    ],
  };
}

export function fetchDashboard(state: DashState): Promise<DashboardData> {
  if (state === 'loading') return new Promise<DashboardData>(() => {}); // 永遠不結束
  if (state === 'error') return delay(700).then(() => { throw new Error('無法連線到監控服務'); });
  if (state === 'empty') {
    return delay(700).then(() => ({
      summary: build().summary, series: { '1h': [], '24h': [], '7d': [] }, services: [], alerts: [],
    }));
  }
  return delay(700).then(build);
}
