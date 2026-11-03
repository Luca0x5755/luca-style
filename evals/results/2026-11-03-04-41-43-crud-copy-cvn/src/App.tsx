import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button, ContentState, Select, StatusMessage, TextField } from './luca-style';

type Status = 'pending' | 'paid' | 'shipped' | 'cancelled';
type Order = { id: string; customer: string; amount: number; status: Status; createdAt: string };

const STATUS_LABEL: Record<Status, string> = { pending: '待付款', paid: '已付款', shipped: '已出貨', cancelled: '已取消' };
const STATUSES = Object.keys(STATUS_LABEL) as Status[];

const SEED: Order[] = [
  { id: 'A1001', customer: '王小明', amount: 1280, status: 'pending', createdAt: '2026-10-02' },
  { id: 'A1002', customer: '林雅婷', amount: 3450, status: 'paid', createdAt: '2026-10-05' },
  { id: 'A1003', customer: '陳建宏', amount: 560, status: 'shipped', createdAt: '2026-10-07' },
  { id: 'A1004', customer: '張惠玲', amount: 8990, status: 'cancelled', createdAt: '2026-10-11' },
  { id: 'A1005', customer: '李志豪', amount: 2200, status: 'paid', createdAt: '2026-10-15' },
  { id: 'A1006', customer: 'Emily Chen', amount: 15600, status: 'shipped', createdAt: '2026-10-19' },
  { id: 'A1007', customer: '黃淑芬', amount: 720, status: 'pending', createdAt: '2026-10-23' },
  { id: 'A1008', customer: '吳宗翰', amount: 4300, status: 'paid', createdAt: '2026-10-28' },
  { id: 'A1009', customer: 'David Lin', amount: 980, status: 'pending', createdAt: '2026-11-01' },
  { id: 'A1010', customer: '蔡佳穎', amount: 6750, status: 'shipped', createdAt: '2026-11-02' },
];

type ViewState = 'loading' | 'empty' | 'error' | 'success';
function readState(): ViewState {
  const value = new URLSearchParams(window.location.search).get('state');
  return value === 'loading' || value === 'empty' || value === 'error' || value === 'success' ? value : 'success';
}

const money = (n: number) => `NT$ ${n.toLocaleString('en-US')}`;
const today = () => new Date().toISOString().slice(0, 10);

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input, button, [role="combobox"]');
    first?.focus();
    return () => previous?.focus();
  }, []);
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); return; }
    if (event.key !== 'Tab' || !ref.current) return;
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>('input, button:not([disabled]), [role="combobox"]'));
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return (
    <div className="backdrop" onKeyDown={onKeyDown}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function OrderForm({ order, onSave, onCancel }: { order: Order | null; onSave: (v: { customer: string; amount: number; status: Status }) => void; onCancel: () => void }) {
  const [customer, setCustomer] = useState(order?.customer ?? '');
  const [amount, setAmount] = useState(order ? String(order.amount) : '');
  const [status, setStatus] = useState<Status>(order?.status ?? 'pending');
  const [errors, setErrors] = useState<{ customer?: string; amount?: string }>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!customer.trim()) next.customer = '請輸入客戶名稱';
    const n = Number(amount);
    if (amount.trim() === '' || !Number.isFinite(n)) next.amount = '請輸入有效的金額';
    else if (n <= 0) next.amount = '金額必須大於 0';
    setErrors(next);
    if (next.customer || next.amount) return;
    onSave({ customer: customer.trim(), amount: n, status });
  };

  return (
    <Modal title={order ? '編輯訂單' : '新增訂單'} onClose={onCancel}>
      <form className="stack" onSubmit={submit} noValidate>
        <TextField label="客戶" value={customer} required aria-required="true" error={errors.customer} autoComplete="off"
          onChange={e => { setCustomer(e.target.value); if (errors.customer) setErrors({ ...errors, customer: undefined }); }} />
        <TextField label="金額（NT$）" type="number" inputMode="decimal" min="0" step="any" value={amount} required aria-required="true" error={errors.amount}
          onChange={e => { setAmount(e.target.value); if (errors.amount) setErrors({ ...errors, amount: undefined }); }} />
        <Select label="狀態" value={status} onChange={e => setStatus(e.target.value as Status)}>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </Select>
        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onCancel}>取消</Button>
          <Button type="submit">儲存</Button>
        </div>
      </form>
    </Modal>
  );
}

export function App() {
  const view = useMemo(readState, []);
  const [orders, setOrders] = useState<Order[]>(view === 'success' ? SEED : []);
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [editing, setEditing] = useState<Order | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Order | null>(null);
  const [notice, setNotice] = useState('');
  const [retries, setRetries] = useState(0);
  const nextId = useRef(1011);

  const visible = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return orders.filter(o => (filter === 'all' || o.status === filter) && (!q || o.customer.toLowerCase().includes(q)));
  }, [orders, keyword, filter]);

  const save = (v: { customer: string; amount: number; status: Status }) => {
    if (editing && editing !== 'new') {
      const id = editing.id;
      setOrders(list => list.map(o => (o.id === id ? { ...o, ...v } : o)));
      setNotice(`已更新訂單 ${id}`);
    } else {
      const id = `A${nextId.current++}`;
      setOrders(list => [{ id, createdAt: today(), ...v }, ...list]);
      setNotice(`已新增訂單 ${id}`);
    }
    setEditing(null);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const id = deleting.id;
    setOrders(list => list.filter(o => o.id !== id));
    setNotice(`已刪除訂單 ${id}`);
    setDeleting(null);
  };

  const canAdd = view === 'success' || view === 'empty';
  const showEmpty = view === 'empty' || (view === 'success' && orders.length === 0);

  let body: ReactNode;
  if (view === 'loading') {
    body = <section data-eval-state="loading" aria-label="訂單列表"><ContentState state="loading" title="訂單載入中" description="正在取得訂單資料，請稍候。" /></section>;
  } else if (view === 'error') {
    body = (
      <section data-eval-state="error" aria-label="訂單列表" className="stack">
        <ContentState state="error" title="訂單載入失敗" description="無法取得訂單資料，請重試。" retryLabel="重試" onRetry={() => setRetries(n => n + 1)} />
        {retries > 0 && <StatusMessage tone="error">第 {retries} 次重試仍然失敗，請稍後再試。</StatusMessage>}
      </section>
    );
  } else if (showEmpty) {
    body = (
      <section data-eval-state="empty" aria-label="訂單列表" className="stack">
        <ContentState state="empty" title="目前沒有訂單" description="建立第一筆訂單後會顯示在這裡。" />
      </section>
    );
  } else {
    body = (
      <section data-eval-state="success" aria-label="訂單列表" className="stack">
        <div className="toolbar">
          <TextField label="搜尋客戶" type="search" value={keyword} placeholder="輸入客戶名稱" autoComplete="off" onChange={e => setKeyword(e.target.value)} />
          <Select label="狀態篩選" value={filter} onChange={e => setFilter(e.target.value as 'all' | Status)}>
            <option value="all">全部狀態</option>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </Select>
        </div>
        <p className="msg" role="status">共 {visible.length} 筆訂單</p>
        {visible.length === 0 ? (
          <p className="notice">沒有符合條件的訂單，請調整搜尋或篩選。</p>
        ) : (
          <div className="table-card">
            <table className="luca-table">
              <caption>訂單列表</caption>
              <thead>
                <tr>
                  <th scope="col">編號</th><th scope="col">客戶</th><th scope="col" className="num">金額</th>
                  <th scope="col">狀態</th><th scope="col">建立日期</th><th scope="col"><span className="luca-visually-hidden">操作</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(o => (
                  <tr key={o.id}>
                    <td data-label="編號">{o.id}</td>
                    <td data-label="客戶">{o.customer}</td>
                    <td data-label="金額" className="num">{money(o.amount)}</td>
                    <td data-label="狀態"><span className={`badge badge-${o.status}`}>{STATUS_LABEL[o.status]}</span></td>
                    <td data-label="建立日期">{o.createdAt}</td>
                    <td className="cell-actions">
                      <div className="actions">
                        <Button variant="secondary" aria-label={`編輯訂單 ${o.id}（${o.customer}）`} onClick={() => setEditing(o)}>編輯</Button>
                        <Button variant="secondary" aria-label={`刪除訂單 ${o.id}（${o.customer}）`} onClick={() => setDeleting(o)}>刪除</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  return (
    <main className="page">
      <div className="page-head">
        <h1>訂單管理</h1>
        {canAdd && <Button onClick={() => setEditing('new')}>新增訂單</Button>}
      </div>
      {notice && <StatusMessage tone="success">{notice}</StatusMessage>}
      <div className="panel">{body}</div>
      {editing && <OrderForm order={editing === 'new' ? null : editing} onSave={save} onCancel={() => setEditing(null)} />}
      {deleting && (
        <Modal title="確認刪除" onClose={() => setDeleting(null)}>
          <p>確定要刪除訂單 {deleting.id}（{deleting.customer}）嗎？此動作無法復原。</p>
          <div className="dialog-actions">
            <Button variant="secondary" onClick={() => setDeleting(null)}>取消</Button>
            <Button onClick={confirmDelete}>確認刪除</Button>
          </div>
        </Modal>
      )}
    </main>
  );
}
