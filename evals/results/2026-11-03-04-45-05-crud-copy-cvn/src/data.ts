export type Status = 'pending' | 'paid' | 'shipped' | 'cancelled';

export type Order = {
  id: string;
  customer: string;
  amount: number;
  status: Status;
  createdAt: string;
};

export const STATUS_LABELS: Record<Status, string> = {
  pending: '待付款',
  paid: '已付款',
  shipped: '已出貨',
  cancelled: '已取消',
};

export const STATUSES = Object.keys(STATUS_LABELS) as Status[];

export const seedOrders: Order[] = [
  { id: 'A1001', customer: '王小明', amount: 1280, status: 'pending', createdAt: '2026-10-28' },
  { id: 'A1002', customer: '陳怡君', amount: 3490, status: 'paid', createdAt: '2026-10-27' },
  { id: 'A1003', customer: '林建宏', amount: 560, status: 'shipped', createdAt: '2026-10-25' },
  { id: 'A1004', customer: '張雅婷', amount: 7820, status: 'shipped', createdAt: '2026-10-24' },
  { id: 'A1005', customer: '李志豪', amount: 920, status: 'cancelled', createdAt: '2026-10-22' },
  { id: 'A1006', customer: '黃淑芬', amount: 2150, status: 'paid', createdAt: '2026-10-20' },
  { id: 'A1007', customer: '吳宗翰', amount: 4300, status: 'pending', createdAt: '2026-10-18' },
  { id: 'A1008', customer: '劉佳穎', amount: 1675, status: 'paid', createdAt: '2026-10-15' },
  { id: 'A1009', customer: '蔡明哲', amount: 5990, status: 'shipped', createdAt: '2026-10-12' },
  { id: 'A1010', customer: '王小明', amount: 330, status: 'cancelled', createdAt: '2026-10-09' },
];
