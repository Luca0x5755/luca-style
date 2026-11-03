export type Status = 'pending' | 'paid' | 'shipped' | 'cancelled';

export type Order = {
  id: string;
  customer: string;
  amount: number;
  status: Status;
  createdAt: string;
};

export const STATUS_LABEL: Record<Status, string> = {
  pending: '待付款',
  paid: '已付款',
  shipped: '已出貨',
  cancelled: '已取消',
};

export const STATUSES = Object.keys(STATUS_LABEL) as Status[];

export const SEED_ORDERS: Order[] = [
  { id: 'A-1001', customer: '王小明', amount: 1280, status: 'pending', createdAt: '2026-10-02' },
  { id: 'A-1002', customer: '林美玲', amount: 4560, status: 'paid', createdAt: '2026-10-05' },
  { id: 'A-1003', customer: '陳志豪', amount: 899, status: 'shipped', createdAt: '2026-10-08' },
  { id: 'A-1004', customer: '張雅婷', amount: 2350, status: 'cancelled', createdAt: '2026-10-11' },
  { id: 'A-1005', customer: '李大偉', amount: 7800, status: 'paid', createdAt: '2026-10-14' },
  { id: 'A-1006', customer: '黃淑芬', amount: 320, status: 'pending', createdAt: '2026-10-18' },
  { id: 'A-1007', customer: '吳建宏', amount: 15999, status: 'shipped', createdAt: '2026-10-22' },
  { id: 'A-1008', customer: '劉怡君', amount: 640, status: 'pending', createdAt: '2026-10-27' },
  { id: 'A-1009', customer: '王小明', amount: 3200, status: 'paid', createdAt: '2026-11-01' },
  { id: 'A-1010', customer: '蔡宗翰', amount: 1750, status: 'shipped', createdAt: '2026-11-02' },
];
