export type Status = 'ok' | 'degraded' | 'down';
export type Severity = 'critical' | 'warning' | 'info';
export type Range = '1h' | '24h' | '7d';

export interface Service { id: string; name: string; status: Status; latency: number | null; checkedAt: number }
export interface Alert { id: string; severity: Severity; serviceName: string; message: string; at: number }
export interface Point { t: number; requests: number; errorRate: number }
export interface Summary { requests: number; requestsPrev: number; errorRate: number; errorRatePrev: number; latency: number; latencyPrev: number; online: number; onlinePrev: number; total: number }
export interface DashboardData { summary: Summary; series: Record<Range, Point[]>; services: Service[]; alerts: Alert[] }

const MIN = 60_000;

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function makeSeries(now: number, count: number, step: number, seed: number): Point[] {
  const r = rand(seed);
  const pts: Point[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const t = now - i * step;
    const hour = new Date(t).getHours() + new Date(t).getMinutes() / 60;
    const wave = 1 + 0.45 * Math.sin(((hour - 9) / 24) * Math.PI * 2);
    const scale = step / (60 * MIN);
    const requests = Math.round((12000 * wave + r() * 2000) * Math.max(scale, 0.05) * (step >= 4 * 60 * MIN ? 1 : 1));
    const errorRate = Math.round((0.6 + r() * 1.2 + (r() > 0.93 ? 1.5 : 0)) * 100) / 100;
    pts.push({ t, requests, errorRate });
  }
  return pts;
}

export function fetchDashboard(state: string): Promise<DashboardData> {
  return new Promise((resolve, reject) => {
    if (state === 'loading') return; // 永遠不結束
    setTimeout(() => {
      if (state === 'error') return reject(new Error('無法連線到監控 API（503）'));
      const now = Date.now();
      if (state === 'empty') {
        const zero: Point[] = [];
        return resolve({
          summary: { requests: 0, requestsPrev: 0, errorRate: 0, errorRatePrev: 0, latency: 0, latencyPrev: 0, online: 0, onlinePrev: 0, total: 0 },
          series: { '1h': zero, '24h': zero, '7d': zero }, services: [], alerts: [],
        });
      }
      const names: [string, Status, number | null][] = [
        ['api-gateway', 'ok', 86], ['auth-service', 'ok', 54], ['payment-service', 'degraded', 612],
        ['order-service', 'ok', 142], ['search-service', 'degraded', 480], ['notification-service', 'down', null],
        ['inventory-service', 'ok', 97], ['report-worker', 'ok', 233], ['media-cdn', 'ok', 38],
      ];
      const services: Service[] = names.map(([name, status, latency], i) => ({
        id: name, name, status, latency, checkedAt: now - (i * 37 + 20) * 1000,
      }));
      const alerts: Alert[] = [
        { id: 'a1', severity: 'critical', serviceName: 'notification-service', message: '健康檢查連續 5 次失敗，服務無回應', at: now - 14 * MIN },
        { id: 'a2', severity: 'critical', serviceName: 'payment-service', message: '5xx 錯誤率超過 5%', at: now - 42 * MIN },
        { id: 'a3', severity: 'warning', serviceName: 'search-service', message: 'P95 回應時間超過 400 ms', at: now - 95 * MIN },
        { id: 'a4', severity: 'warning', serviceName: 'order-service', message: '資料庫連線池使用率達 85%', at: now - 3 * 60 * MIN },
        { id: 'a5', severity: 'info', serviceName: 'report-worker', message: '排程工作執行時間較平常長', at: now - 5 * 60 * MIN },
        { id: 'a6', severity: 'info', serviceName: 'media-cdn', message: '快取命中率下降至 91%', at: now - 8 * 60 * MIN },
      ];
      const series = {
        '1h': makeSeries(now, 60, MIN, 11),
        '24h': makeSeries(now, 24, 60 * MIN, 22),
        '7d': makeSeries(now, 42, 4 * 60 * MIN, 33),
      };
      resolve({
        summary: { requests: 284_300, requestsPrev: 262_900, errorRate: 1.8, errorRatePrev: 1.4, latency: 182, latencyPrev: 196, online: 7, onlinePrev: 8, total: 9 },
        series, services, alerts,
      });
    }, 900);
  });
}
