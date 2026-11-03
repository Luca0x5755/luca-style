import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Status = 'pending' | 'paid' | 'shipped' | 'cancelled';
interface Order {
  id: string;
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
  { id: 'A1001', customer: '王小明', amount: 1280, status: 'pending', createdAt: '2026-10-28' },
  { id: 'A1002', customer: '陳美玲', amount: 3560, status: 'paid', createdAt: '2026-10-27' },
  { id: 'A1003', customer: '林志豪', amount: 880, status: 'shipped', createdAt: '2026-10-25' },
  { id: 'A1004', customer: '張雅婷', amount: 12500, status: 'cancelled', createdAt: '2026-10-24' },
  { id: 'A1005', customer: '李大偉', amount: 420, status: 'paid', createdAt: '2026-10-22' },
  { id: 'A1006', customer: '黃淑芬', amount: 7990, status: 'shipped', createdAt: '2026-10-20' },
  { id: 'A1007', customer: '吳建宏', amount: 2300, status: 'pending', createdAt: '2026-10-18' },
  { id: 'A1008', customer: '周怡君', amount: 15800, status: 'paid', createdAt: '2026-10-15' },
  { id: 'A1009', customer: '王小明', amount: 640, status: 'shipped', createdAt: '2026-10-12' },
  { id: 'A1010', customer: '蔡宗翰', amount: 5200, status: 'pending', createdAt: '2026-10-09' },
];

type ViewState = 'loading' | 'empty' | 'error' | 'success';
function readState(): ViewState {
  const s = new URLSearchParams(window.location.search).get('state');
  return s === 'loading' || s === 'empty' || s === 'error' ? s : 'success';
}

const fmt = new Intl.NumberFormat('zh-TW');
const money = (n: number) => `NT$ ${fmt.format(n)}`;

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={onClose} onCancel={onClose}>
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}

function OrderForm({ order, onSave, onCancel }: { order: Order | null; onSave: (v: { customer: string; amount: number; status: Status }) => void; onCancel: () => void }) {
  const [customer, setCustomer] = useState(order?.customer ?? '');
  const [amount, setAmount] = useState(order ? String(order.amount) : '');
  const [status, setStatus] = useState<Status>(order?.status ?? 'pending');
  const [errors, setErrors] = useState<{ customer?: string; amount?: string }>({});

  function submit(e: FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!customer.trim()) errs.customer = '請輸入客戶名稱';
    const n = Number(amount);
    if (amount.trim() === '' || !Number.isFinite(n)) errs.amount = '請輸入有效的金額';
    else if (n <= 0) errs.amount = '金額必須大於 0';
    setErrors(errs);
    if (errs.customer || errs.amount) return;
    onSave({ customer: customer.trim(), amount: n, status });
  }

  return (
    <Modal title={order ? `編輯訂單 ${order.id}` : '新增訂單'} onClose={onCancel}>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="f-customer">客戶（必填）</label>
          <input
            id="f-customer"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            aria-invalid={!!errors.customer}
            aria-describedby={errors.customer ? 'f-customer-err' : undefined}
            autoComplete="off"
          />
          {errors.customer && <p className="err" id="f-customer-err">{errors.customer}</p>}
        </div>
        <div className="field">
          <label htmlFor="f-amount">金額（需大於 0）</label>
          <input
            id="f-amount"
            type="number"
            inputMode="decimal"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={!!errors.amount}
            aria-describedby={errors.amount ? 'f-amount-err' : undefined}
          />
          {errors.amount && <p className="err" id="f-amount-err">{errors.amount}</p>}
        </div>
        <div className="field">
          <label htmlFor="f-status">狀態</label>
          <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={onCancel}>取消</button>
          <button type="submit" className="btn primary">儲存</button>
        </div>
      </form>
    </Modal>
  );
}

function App() {
  const state = useMemo(readState, []);
  const [orders, setOrders] = useState<Order[]>(state === 'success' ? SEED : []);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [editing, setEditing] = useState<Order | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Order | null>(null);
  const [retries, setRetries] = useState(0);
  const [seq, setSeq] = useState(1011);

  const shown = orders.filter(
    (o) => (filter === 'all' || o.status === filter) && o.customer.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function save(v: { customer: string; amount: number; status: Status }) {
    if (editing === 'new') {
      const d = new Date();
      const createdAt = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setOrders((os) => [{ id: `A${seq}`, createdAt, ...v }, ...os]);
      setSeq(seq + 1);
    } else if (editing) {
      const id = editing.id;
      setOrders((os) => os.map((o) => (o.id === id ? { ...o, ...v } : o)));
    }
    setEditing(null);
  }

  let content: ReactNode;
  if (state === 'loading') {
    content = (
      <section data-eval-state="loading" className="panel" role="status" aria-live="polite" aria-busy="true">
        <p className="muted">載入中…</p>
        <div className="skeleton" aria-hidden="true" />
        <div className="skeleton" aria-hidden="true" />
        <div className="skeleton" aria-hidden="true" />
      </section>
    );
  } else if (state === 'error') {
    content = (
      <section data-eval-state="error" className="panel center">
        <h2>載入失敗</h2>
        <p role="alert">無法取得訂單資料，請稍後再試。{retries > 0 && `（已重試 ${retries} 次，仍然失敗）`}</p>
        <button type="button" className="btn primary" onClick={() => setRetries(retries + 1)}>重試</button>
      </section>
    );
  } else if (orders.length === 0) {
    content = (
      <section data-eval-state="empty" className="panel center">
        <h2>目前沒有訂單</h2>
        <p className="muted">建立第一筆訂單開始管理。</p>
        <button type="button" className="btn primary" onClick={() => setEditing('new')}>新增訂單</button>
      </section>
    );
  } else {
    content = (
      <section data-eval-state="success" className="panel" aria-label="訂單列表">
        <div className="toolbar">
          <div className="field">
            <label htmlFor="q">搜尋客戶</label>
            <input id="q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="輸入客戶名稱" />
          </div>
          <div className="field">
            <label htmlFor="st">狀態篩選</label>
            <select id="st" value={filter} onChange={(e) => setFilter(e.target.value as 'all' | Status)}>
              <option value="all">全部狀態</option>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
        </div>
        <p className="muted" aria-live="polite">共 {shown.length} 筆訂單</p>
        {shown.length === 0 ? (
          <p className="center muted pad">沒有符合條件的訂單。</p>
        ) : (
          <table>
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
              {shown.map((o) => (
                <tr key={o.id}>
                  <td data-label="編號">{o.id}</td>
                  <td data-label="客戶">{o.customer}</td>
                  <td data-label="金額" className="num">{money(o.amount)}</td>
                  <td data-label="狀態"><span className={`badge ${o.status}`}>{STATUS_LABEL[o.status]}</span></td>
                  <td data-label="建立日期">{o.createdAt}</td>
                  <td data-label="操作" className="row-actions">
                    <button type="button" className="btn small" onClick={() => setEditing(o)} aria-label={`編輯訂單 ${o.id}`}>編輯</button>
                    <button type="button" className="btn small danger" onClick={() => setDeleting(o)} aria-label={`刪除訂單 ${o.id}`}>刪除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    );
  }

  return (
    <>
      <header className="top">
        <h1>訂單管理</h1>
        {(state === 'success' || state === 'empty') && orders.length > 0 && (
          <button type="button" className="btn primary" onClick={() => setEditing('new')}>新增訂單</button>
        )}
      </header>
      <main>{content}</main>

      {editing && (
        <OrderForm order={editing === 'new' ? null : editing} onSave={save} onCancel={() => setEditing(null)} />
      )}
      {deleting && (
        <Modal title="確認刪除" onClose={() => setDeleting(null)}>
          <p>確定要刪除訂單 {deleting.id}（{deleting.customer}）嗎？此動作無法復原。</p>
          <div className="actions">
            <button type="button" className="btn" onClick={() => setDeleting(null)}>取消</button>
            <button
              type="button"
              className="btn danger-solid"
              onClick={() => {
                const id = deleting.id;
                setOrders((os) => os.filter((o) => o.id !== id));
                setDeleting(null);
              }}
            >
              確認刪除
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
