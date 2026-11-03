import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Button, ContentState, Select, TextField } from '@luca-style/react';

type Status = '待付款' | '已付款' | '已出貨' | '已取消';
const STATUSES: Status[] = ['待付款', '已付款', '已出貨', '已取消'];

type Order = { id: string; customer: string; amount: number; status: Status; createdAt: string };

const SEED: Order[] = [
  { id: 'A1001', customer: '王小明', amount: 1280, status: '待付款', createdAt: '2026-10-01' },
  { id: 'A1002', customer: '陳雅婷', amount: 3450, status: '已付款', createdAt: '2026-10-03' },
  { id: 'A1003', customer: '林志豪', amount: 560, status: '已出貨', createdAt: '2026-10-05' },
  { id: 'A1004', customer: '黃淑芬', amount: 7800, status: '已取消', createdAt: '2026-10-08' },
  { id: 'A1005', customer: '張家豪', amount: 2190, status: '已付款', createdAt: '2026-10-12' },
  { id: 'A1006', customer: '李美玲', amount: 980, status: '待付款', createdAt: '2026-10-15' },
  { id: 'A1007', customer: '吳宗翰', amount: 15600, status: '已出貨', createdAt: '2026-10-20' },
  { id: 'A1008', customer: '王小明', amount: 420, status: '已付款', createdAt: '2026-10-24' },
  { id: 'A1009', customer: '趙怡君', amount: 2750, status: '待付款', createdAt: '2026-10-28' },
  { id: 'A1010', customer: '周俊傑', amount: 6400, status: '已出貨', createdAt: '2026-11-01' },
];

type ViewState = 'loading' | 'empty' | 'error' | 'success';
function readState(): ViewState {
  const s = new URLSearchParams(window.location.search).get('state');
  return s === 'loading' || s === 'empty' || s === 'error' || s === 'success' ? s : 'success';
}

const fmt = new Intl.NumberFormat('zh-TW');
const ALL = 'all';

export function App() {
  const [view, setView] = useState<ViewState>(readState);
  const [orders, setOrders] = useState<Order[]>(() => (readState() === 'empty' ? [] : SEED));
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<string>(ALL);
  const [editing, setEditing] = useState<Order | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Order | null>(null);
  const [nextId, setNextId] = useState(1011);

  const visible = useMemo(
    () =>
      orders.filter(
        (o) => (filter === ALL || o.status === filter) && o.customer.toLowerCase().includes(keyword.trim().toLowerCase()),
      ),
    [orders, keyword, filter],
  );

  const retry = () => {
    // 重試：導回成功狀態並載入假資料
    const url = new URL(window.location.href);
    url.searchParams.set('state', 'success');
    window.history.replaceState(null, '', url);
    setOrders(SEED);
    setView('success');
  };

  const save = (data: { customer: string; amount: number; status: Status }) => {
    if (editing === 'new') {
      const today = new Date().toISOString().slice(0, 10);
      setOrders((os) => [{ id: `A${nextId}`, createdAt: today, ...data }, ...os]);
      setNextId((n) => n + 1);
    } else if (editing) {
      const id = editing.id;
      setOrders((os) => os.map((o) => (o.id === id ? { ...o, ...data } : o)));
    }
    setEditing(null);
  };

  const confirmDelete = () => {
    if (deleting) setOrders((os) => os.filter((o) => o.id !== deleting.id));
    setDeleting(null);
  };

  return (
    <main className="page">
      <header className="page-header">
        <h1>訂單管理</h1>
        {view === 'success' && (
          <Button variant="primary" onClick={() => setEditing('new')}>
            新增訂單
          </Button>
        )}
      </header>

      {editing && (
        <OrderForm
          key={editing === 'new' ? 'new' : editing.id}
          order={editing === 'new' ? null : editing}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}

      {view === 'loading' && (
        <section data-eval-state="loading" className="panel state-box" aria-label="訂單列表">
          <ContentState state="loading" title="載入中" description="正在取得訂單資料" />
        </section>
      )}

      {view === 'empty' && (
        <section data-eval-state="empty" className="panel state-box" aria-label="訂單列表">
          <ContentState state="empty" title="目前沒有訂單" description="新的訂單會顯示在這裡" />
        </section>
      )}

      {view === 'error' && (
        <section data-eval-state="error" className="panel state-box" aria-label="訂單列表">
          <ContentState state="error" title="載入失敗" description="無法取得訂單資料，請再試一次" retryLabel="重試" onRetry={retry} />
        </section>
      )}

      {view === 'success' && (
        <section data-eval-state="success" className="panel" aria-label="訂單列表">
          <div className="toolbar" role="search">
            <TextField label="搜尋客戶" type="search" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="輸入客戶名稱" />
            <Select label="狀態篩選" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value={ALL}>全部狀態</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>

          <p role="status" style={{ color: 'var(--muted)' }}>
            共 {visible.length} 筆訂單
          </p>

          {visible.length === 0 ? (
            <p>沒有符合條件的訂單。</p>
          ) : (
            <table className="orders">
              <caption className="sr-only">訂單列表</caption>
              <thead>
                <tr>
                  <th scope="col">編號</th>
                  <th scope="col">客戶</th>
                  <th scope="col" className="num">金額</th>
                  <th scope="col">狀態</th>
                  <th scope="col">建立日期</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((o) => (
                  <tr key={o.id}>
                    <td data-label="編號">{o.id}</td>
                    <td data-label="客戶">{o.customer}</td>
                    <td data-label="金額" className="num">NT$ {fmt.format(o.amount)}</td>
                    <td data-label="狀態"><span className="badge">{o.status}</span></td>
                    <td data-label="建立日期">{o.createdAt}</td>
                    <td data-label="操作">
                      <div className="row-actions">
                        <Button variant="secondary" aria-label={`編輯訂單 ${o.id}`} onClick={() => setEditing(o)}>
                          編輯
                        </Button>
                        <Button variant="secondary" aria-label={`刪除訂單 ${o.id}`} onClick={() => setDeleting(o)}>
                          刪除
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <ConfirmDialog order={deleting} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />
    </main>
  );
}

function OrderForm({
  order,
  onSave,
  onCancel,
}: {
  order: Order | null;
  onSave: (d: { customer: string; amount: number; status: Status }) => void;
  onCancel: () => void;
}) {
  const [customer, setCustomer] = useState(order?.customer ?? '');
  const [amount, setAmount] = useState(order ? String(order.amount) : '');
  const [status, setStatus] = useState<Status>(order?.status ?? '待付款');
  const [errors, setErrors] = useState<{ customer?: string; amount?: string }>({});
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ref.current?.querySelector('input')?.focus();
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!customer.trim()) next.customer = '請輸入客戶名稱';
    const n = Number(amount);
    if (amount.trim() === '' || !Number.isFinite(n)) next.amount = '請輸入金額';
    else if (n <= 0) next.amount = '金額必須大於 0';
    setErrors(next);
    if (next.customer || next.amount) return;
    onSave({ customer: customer.trim(), amount: n, status });
  };

  return (
    <section ref={ref} className="panel" aria-label={order ? '編輯訂單' : '新增訂單'}>
      <h2>{order ? `編輯訂單 ${order.id}` : '新增訂單'}</h2>
      <form className="form" onSubmit={submit} noValidate>
        <TextField label="客戶" value={customer} required error={errors.customer} onChange={(e) => setCustomer(e.target.value)} />
        <TextField label="金額" type="number" inputMode="decimal" value={amount} required error={errors.amount} onChange={(e) => setAmount(e.target.value)} />
        <Select label="狀態" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <div className="form-actions">
          <Button type="submit" variant="primary">儲存</Button>
          <Button type="button" variant="secondary" onClick={onCancel}>取消</Button>
        </div>
      </form>
    </section>
  );
}

function ConfirmDialog({ order, onConfirm, onCancel }: { order: Order | null; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (order && !d.open) d.showModal();
    if (!order && d.open) d.close();
  }, [order]);

  return (
    <dialog ref={ref} aria-labelledby="del-title" onCancel={(e) => { e.preventDefault(); onCancel(); }}>
      {order && (
        <>
          <h2 id="del-title">確認刪除</h2>
          <p>確定要刪除訂單 {order.id}（{order.customer}）嗎？此動作無法復原。</p>
          <div className="row-actions">
            <Button variant="primary" onClick={onConfirm}>確認刪除</Button>
            <Button variant="secondary" onClick={onCancel} autoFocus>取消</Button>
          </div>
        </>
      )}
    </dialog>
  );
}
