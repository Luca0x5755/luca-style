export type Status = 'ok' | 'degraded' | 'down';
export type Severity = 'critical' | 'warning' | 'info';
export type RangeKey = '1h' | '24h' | '7d';

export type Service = { id: string; name: string; status: Status; latencyMs: number; checkedAt: number };
export type Alert = { id: string; severity: Severity; service: string; description: string; at: number };
export type Point = { t: number; requests: number; errorRate: number };
export type Metric = { key: string; label: string; value: string; change: number; unit: string; goodWhenUp: boolean };
export type Dashboard = {
  metrics: Metric[];
  series: Record<RangeKey, Point[]>;
  services: Service[];
  alerts: Alert[];
};

export type DashboardState = 'loading' | 'empty' | 'error' | 'success';

const MIN = 60_000;
const HOUR = 60 * MIN;

function build(now: number): Dashboard {
  const series = (count: number, step: number, base: number): Point[] =>
    Array.from({ length: count }, (_, i) => {
      const t = now - (count - 1 - i) * step;
      const wave = Math.sin((i / count) * Math.PI * 4) * 0.25 + Math.cos(i * 1.7) * 0.06;
      const requests = Math.round(base * (1 + wave));
      const errorRate = Math.round((0.6 + Math.abs(Math.sin(i * 0.9)) * 0.9 + (i % 7 === 0 ? 0.6 : 0)) * 100) / 100;
      return { t, requests, errorRate };
    });

  const names: [string, Status, number, number][] = [
    ['API 閘道', 'ok', 84, 1],
    ['身分驗證服務', 'ok', 62, 2],
    ['訂單服務', 'degraded', 412, 3],
    ['支付服務', 'ok', 138, 1],
    ['搜尋服務', 'degraded', 526, 4],
    ['通知服務', 'down', 0, 6],
    ['圖片處理服務', 'ok', 233, 2],
    ['報表服務', 'ok', 301, 5],
    ['排程服務', 'ok', 47, 1],
    ['資料同步服務', 'down', 0, 9],
  ];
  const services: Service[] = names.map(([name, status, latencyMs, mins], i) => ({
    id: `svc-${i + 1}`,
    name,
    status,
    latencyMs,
    checkedAt: now - mins * MIN,
  }));

  const alerts: Alert[] = [
    { id: 'a1', severity: 'critical', service: '通知服務', description: '健康檢查連續 5 次失敗，服務無回應', at: now - 14 * MIN },
    { id: 'a2', severity: 'critical', service: '資料同步服務', description: '同步任務逾時，資料延遲超過 30 分鐘', at: now - 42 * MIN },
    { id: 'a3', severity: 'warning', service: '訂單服務', description: '平均回應時間超過 400 毫秒', at: now - 1.5 * HOUR },
    { id: 'a4', severity: 'warning', service: '搜尋服務', description: '錯誤率高於 1.5%，已持續 20 分鐘', at: now - 3 * HOUR },
    { id: 'a5', severity: 'info', service: '報表服務', description: '憑證將於 14 天後到期', at: now - 7 * HOUR },
    { id: 'a6', severity: 'info', service: 'API 閘道', description: '流量較上週同時段增加 30%', at: now - 11 * HOUR },
  ];

  return {
    metrics: [
      { key: 'requests', label: '請求量', value: '1.28M', change: 4.2, unit: '%', goodWhenUp: true },
      { key: 'errors', label: '錯誤率', value: '0.82%', change: -0.1, unit: ' 個百分點', goodWhenUp: false },
      { key: 'latency', label: '平均回應時間', value: '186 ms', change: 6.5, unit: '%', goodWhenUp: false },
      { key: 'online', label: '線上服務數', value: '8 / 10', change: -1, unit: ' 個', goodWhenUp: true },
    ],
    series: {
      '1h': series(12, 5 * MIN, 5200),
      '24h': series(24, HOUR, 62000),
      '7d': series(7, 24 * HOUR, 1_450_000),
    },
    services,
    alerts,
  };
}

/** 假的非同步 API：用 Promise 加延遲模擬。loading 永遠不會結束。 */
export function fetchDashboard(state: DashboardState): Promise<Dashboard | null> {
  return new Promise((resolve, reject) => {
    if (state === 'loading') return;
    setTimeout(() => {
      if (state === 'error') reject(new Error('無法連線到監控服務'));
      else if (state === 'empty') resolve(null);
      else resolve(build(Date.now()));
    }, 700);
  });
}
