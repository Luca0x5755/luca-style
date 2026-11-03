import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';

type Status = 'pending' | 'paid' | 'shipped' | 'cancelled';
interface Order {
  id: number;
  customer: string;
  amount: number;
  status: Status;
  createdAt: string;
}

const STATUS_LABEL: Record<Status, string> = {
  pending: '待付款',
  paid: '已付款',
  shipped: '已出貨',
  cancelled: '已取消',
};
const STATUSES = Object.keys(STATUS_LABEL) as Status[];

const SEED: Order[] = [
  { id: 1001, customer: '王小明', amount: 1280, status: 'pending', createdAt: '2026-10-28' },
  { id: 1002, customer: '陳美玲', amount: 3560, status: 'paid', createdAt: '2026-10-27' },
  { id: 1003, customer: '林志豪', amount: 920, status: 'shipped', createdAt: '2026-10-25' },
  { id: 1004, customer: '張雅婷', amount: 15800, status: 'paid', createdAt: '2026-10-24' },
  { id: 1005, customer: '李承恩', amount: 450, status: 'cancelled', createdAt: '2026-10-22' },
  { id: 1006, customer: '黃淑芬', amount: 2200, status: 'shipped', createdAt: '2026-10-20' },
  { id: 1007, customer: '吳俊傑', amount: 7390, status: 'pending', createdAt: '2026-10-18' },
  { id: 1008, customer: '劉怡君', amount: 640, status: 'paid', createdAt: '2026-10-15' },
  { id: 1009, customer: '王小明', amount: 5100, status: 'shipped', createdAt: '2026-10-12' },
  { id: 1010, customer: '鄭宇軒', amount: 1999, status: 'pending', createdAt: '2026-10-09' },
];

type ViewState = 'loading' | 'empty' | 'error' | 'success';
function readState(): ViewState {
  const s = new URLSearchParams(window.location.search).get('state');
  return s === 'loading' || s === 'empty' || s === 'error' ? s : 'success';
}

const fmt = new Intl.NumberFormat('zh-TW');

export default function App() {
  const state = readState();
  const [orders, setOrders] = useState<Order[]>(state === 'empty' ? [] : SEED);
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [editing, setEditing] = useState<Order | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Order | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [notice, setNotice] = useState('');

  const visible = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return orders.filter(
      (o) => (filter === 'all' || o.status === filter) && (!k || o.customer.toLowerCase().includes(k)),
    );
  }, [orders, keyword, filter]);

  const retry = () => {
    setRetrying(true);
    window.setTimeout(() => setRetrying(false), 800);
  };

  const save = (data: { customer: string; amount: number; status: Status }) => {
    if (editing === 'new') {
      const id = Math.max(1000, ...orders.map((o) => o.id)) + 1;
      const createdAt = new Date().toISOString().slice(0, 10);
      setOrders([{ id, createdAt, ...data }, ...orders]);
      setNotice(`已新增訂單 ${id}`);
    } else if (editing) {
      const id = editing.id;
      setOrders(orders.map((o) => (o.id === id ? { ...o, ...data } : o)));
      setNotice(`已更新訂單 ${id}`);
    }
    setEditing(null);
  };

  const remove = () => {
    if (!deleting) return;
    setOrders(orders.filter((o) => o.id !== deleting.id));
    setNotice(`已刪除訂單 ${deleting.id}`);
    setDeleting(null);
  };

  const showList = state === 'success' || (state === 'empty' && orders.length > 0);

  return (
    <div className="page">
      <header className="top">
        <h1>訂單管理</h1>
        {(state === 'success' || state === 'empty') && (
          <button className="btn primary" onClick={() => setEditing('new')}>
            新增訂單
          </button>
        )}
      </header>

      <main>
        <div className="sr-only" role="status" aria-live="polite">
          {notice}
        </div>

        {state === 'loading' && (
          <section data-eval-state="loading" className="panel center" aria-busy="true">
            <div className="spinner" aria-hidden="true" />
            <p role="status">載入中…</p>
          </section>
        )}

        {state === 'error' && (
          <section data-eval-state="error" className="panel center">
            <p role="alert" className="err-title">
              載入訂單失敗
            </p>
            <p>請檢查網路連線後再試一次。</p>
            <button className="btn primary" onClick={retry} disabled={retrying}>
              {retrying ? '重試中…' : '重試'}
            </button>
          </section>
        )}

        {state === 'empty' && !showList && (
          <section data-eval-state="empty" className="panel center">
            <p className="empty-title">目前沒有任何訂單</p>
            <p>按下「新增訂單」建立第一筆。</p>
          </section>
        )}

        {showList && (
          <section data-eval-state="success" className="panel" aria-label="訂單列表">
            <div className="filters">
              <div className="field">
                <label htmlFor="kw">搜尋客戶</label>
                <input
                  id="kw"
                  type="search"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="輸入客戶名稱"
                />
              </div>
              <div className="field">
                <label htmlFor="st">狀態</label>
                <select id="st" value={filter} onChange={(e) => setFilter(e.target.value as 'all' | Status)}>
                  <option value="all">全部</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {visible.length === 0 ? (
              <p className="no-match">沒有符合條件的訂單。</p>
            ) : (
              <table>
                <caption className="sr-only">訂單列表，共 {visible.length} 筆</caption>
                <thead>
                  <tr>
                    <th scope="col">編號</th>
                    <th scope="col">客戶</th>
                    <th scope="col" className="num">
                      金額
                    </th>
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
                      <td data-label="金額" className="num">
                        NT$ {fmt.format(o.amount)}
                      </td>
                      <td data-label="狀態">
                        <span className={`badge ${o.status}`}>{STATUS_LABEL[o.status]}</span>
                      </td>
                      <td data-label="建立日期">{o.createdAt}</td>
                      <td data-label="操作" className="actions">
                        <button className="btn" onClick={() => setEditing(o)} aria-label={`編輯訂單 ${o.id}`}>
                          編輯
                        </button>
                        <button className="btn danger" onClick={() => setDeleting(o)} aria-label={`刪除訂單 ${o.id}`}>
                          刪除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </main>

      {editing && (
        <OrderDialog
          key={editing === 'new' ? 'new' : editing.id}
          order={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}

      {deleting && (
        <Modal title="確認刪除" onClose={() => setDeleting(null)} role="alertdialog">
          <p>確定要刪除訂單 {deleting.id}（{deleting.customer}）嗎？此動作無法復原。</p>
          <div className="dialog-actions">
            <button className="btn" onClick={() => setDeleting(null)}>
              取消
            </button>
            <button className="btn danger-solid" onClick={remove}>
              確認刪除
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
  role = 'dialog',
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  role?: 'dialog' | 'alertdialog';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog ref={ref} role={role} aria-labelledby={titleId} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}

function OrderDialog({
  order,
  onCancel,
  onSave,
}: {
  order: Order | null;
  onCancel: () => void;
  onSave: (d: { customer: string; amount: number; status: Status }) => void;
}) {
  const [customer, setCustomer] = useState(order?.customer ?? '');
  const [amount, setAmount] = useState(order ? String(order.amount) : '');
  const [status, setStatus] = useState<Status>(order?.status ?? 'pending');
  const [errors, setErrors] = useState<{ customer?: string; amount?: string }>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: { customer?: string; amount?: string } = {};
    if (!customer.trim()) errs.customer = '請輸入客戶名稱';
    const n = Number(amount);
    if (amount.trim() === '' || !Number.isFinite(n)) errs.amount = '請輸入有效的金額';
    else if (n <= 0) errs.amount = '金額必須大於 0';
    setErrors(errs);
    if (errs.customer) document.getElementById('f-customer')?.focus();
    else if (errs.amount) document.getElementById('f-amount')?.focus();
    if (!errs.customer && !errs.amount) onSave({ customer: customer.trim(), amount: n, status });
  };

  return (
    <Modal title={order ? `編輯訂單 ${order.id}` : '新增訂單'} onClose={onCancel}>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="f-customer">客戶（必填）</label>
          <input
            id="f-customer"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            aria-required="true"
            aria-invalid={!!errors.customer}
            aria-describedby={errors.customer ? 'e-customer' : undefined}
          />
          {errors.customer && (
            <p id="e-customer" className="error">
              {errors.customer}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="f-amount">金額（必填，須大於 0）</label>
          <input
            id="f-amount"
            type="number"
            inputMode="decimal"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-required="true"
            aria-invalid={!!errors.amount}
            aria-describedby={errors.amount ? 'e-amount' : undefined}
          />
          {errors.amount && (
            <p id="e-amount" className="error">
              {errors.amount}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="f-status">狀態</label>
          <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onCancel}>
            取消
          </button>
          <button type="submit" className="btn primary">
            儲存
          </button>
        </div>
      </form>
    </Modal>
  );
}
