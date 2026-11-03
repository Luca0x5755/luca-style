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
  { id: 1005, customer: '李建國', amount: 450, status: 'cancelled', createdAt: '2026-10-22' },
  { id: 1006, customer: '黃淑芬', amount: 2399, status: 'shipped', createdAt: '2026-10-20' },
  { id: 1007, customer: '吳宗翰', amount: 6700, status: 'pending', createdAt: '2026-10-18' },
  { id: 1008, customer: '劉佳穎', amount: 840, status: 'paid', createdAt: '2026-10-15' },
  { id: 1009, customer: '王小明', amount: 4200, status: 'shipped', createdAt: '2026-10-12' },
  { id: 1010, customer: '蔡依霖', amount: 1999, status: 'pending', createdAt: '2026-10-09' },
];

type ViewState = 'loading' | 'empty' | 'error' | 'success';
function readState(): ViewState {
  const s = new URLSearchParams(window.location.search).get('state');
  return s === 'loading' || s === 'empty' || s === 'error' || s === 'success' ? s : 'success';
}

const fmt = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 });
const today = () => new Date().toISOString().slice(0, 10);

export function App() {
  const viewState = readState();
  const [orders, setOrders] = useState<Order[]>(viewState === 'empty' ? [] : SEED);
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [editing, setEditing] = useState<Order | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Order | null>(null);
  const [retrying, setRetrying] = useState(false);
  const nextId = useRef(2000);

  const visible = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return orders.filter(
      (o) => (filter === 'all' || o.status === filter) && (!k || o.customer.toLowerCase().includes(k)),
    );
  }, [orders, keyword, filter]);

  useEffect(() => {
    if (!retrying) return;
    const t = setTimeout(() => setRetrying(false), 800);
    return () => clearTimeout(t);
  }, [retrying]);

  const canEdit = viewState === 'success' || viewState === 'empty';

  function save(data: Omit<Order, 'id' | 'createdAt'>) {
    if (editing && editing !== 'new') {
      const id = editing.id;
      setOrders((os) => os.map((o) => (o.id === id ? { ...o, ...data } : o)));
    } else {
      setOrders((os) => [{ id: nextId.current++, createdAt: today(), ...data }, ...os]);
    }
    setEditing(null);
  }

  let body;
  if (viewState === 'loading') {
    body = (
      <section data-eval-state="loading" className="panel" aria-busy="true">
        <p role="status" className="muted">載入中…</p>
        <div className="skeletons" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" />
          ))}
        </div>
      </section>
    );
  } else if (viewState === 'error') {
    body = (
      <section data-eval-state="error" className="panel center">
        <h2>載入失敗</h2>
        <p role="alert">無法取得訂單資料，請稍後再試。</p>
        <button type="button" className="btn primary" onClick={() => setRetrying(true)} disabled={retrying}>
          {retrying ? '重試中…' : '重試'}
        </button>
      </section>
    );
  } else if (orders.length === 0) {
    body = (
      <section data-eval-state="empty" className="panel center">
        <h2>目前沒有訂單</h2>
        <p className="muted">按下「新增訂單」建立第一筆訂單。</p>
      </section>
    );
  } else {
    body = (
      <section data-eval-state="success" className="panel">
        <div className="toolbar">
          <div className="field">
            <label htmlFor="q">搜尋客戶</label>
            <input id="q" type="search" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="輸入客戶名稱" />
          </div>
          <div className="field">
            <label htmlFor="f">狀態篩選</label>
            <select id="f" value={filter} onChange={(e) => setFilter(e.target.value as 'all' | Status)}>
              <option value="all">全部狀態</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="muted" role="status">共 {visible.length} 筆訂單</p>
        {visible.length === 0 ? (
          <p className="center muted">沒有符合條件的訂單。</p>
        ) : (
          <table>
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
                  <td data-label="編號">#{o.id}</td>
                  <td data-label="客戶">{o.customer}</td>
                  <td data-label="金額" className="num">{fmt.format(o.amount)}</td>
                  <td data-label="狀態"><span className={`badge ${o.status}`}>{STATUS_LABEL[o.status]}</span></td>
                  <td data-label="建立日期">{o.createdAt}</td>
                  <td data-label="操作" className="actions">
                    <button type="button" className="btn" onClick={() => setEditing(o)} aria-label={`編輯訂單 ${o.id}`}>編輯</button>
                    <button type="button" className="btn danger" onClick={() => setDeleting(o)} aria-label={`刪除訂單 ${o.id}`}>刪除</button>
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
    <main>
      <header className="header">
        <h1>訂單管理</h1>
        <button type="button" className="btn primary" disabled={!canEdit} onClick={() => setEditing('new')}>
          新增訂單
        </button>
      </header>
      {body}
      {editing && <OrderForm key={editing === 'new' ? 'new' : editing.id} order={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onSave={save} />}
      {deleting && (
        <ConfirmDialog
          order={deleting}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const id = deleting.id;
            setOrders((os) => os.filter((o) => o.id !== id));
            setDeleting(null);
          }}
        />
      )}
    </main>
  );
}

function useModal(onCancel: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  return { ref, onCancel: (e: React.SyntheticEvent) => { e.preventDefault(); onCancel(); } };
}

function OrderForm({ order, onCancel, onSave }: { order: Order | null; onCancel: () => void; onSave: (d: Omit<Order, 'id' | 'createdAt'>) => void }) {
  const modal = useModal(onCancel);
  const uid = useId();
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
    if (errs.customer || errs.amount) {
      const first = errs.customer ? `${uid}-c` : `${uid}-a`;
      document.getElementById(first)?.focus();
      return;
    }
    onSave({ customer: customer.trim(), amount: n, status });
  }

  return (
    <dialog ref={modal.ref} onCancel={modal.onCancel} aria-labelledby={`${uid}-t`}>
      <form onSubmit={submit} noValidate>
        <h2 id={`${uid}-t`}>{order ? `編輯訂單 #${order.id}` : '新增訂單'}</h2>
        <div className="field">
          <label htmlFor={`${uid}-c`}>客戶（必填）</label>
          <input id={`${uid}-c`} value={customer} onChange={(e) => setCustomer(e.target.value)} aria-required="true" aria-invalid={!!errors.customer} aria-describedby={errors.customer ? `${uid}-ce` : undefined} />
          {errors.customer && <p id={`${uid}-ce`} className="error">{errors.customer}</p>}
        </div>
        <div className="field">
          <label htmlFor={`${uid}-a`}>金額（必填）</label>
          <input id={`${uid}-a`} type="number" inputMode="decimal" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} aria-required="true" aria-invalid={!!errors.amount} aria-describedby={errors.amount ? `${uid}-ae` : undefined} />
          {errors.amount && <p id={`${uid}-ae`} className="error">{errors.amount}</p>}
        </div>
        <div className="field">
          <label htmlFor={`${uid}-s`}>狀態</label>
          <select id={`${uid}-s`} value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onCancel}>取消</button>
          <button type="submit" className="btn primary">儲存</button>
        </div>
      </form>
    </dialog>
  );
}

function ConfirmDialog({ order, onCancel, onConfirm }: { order: Order; onCancel: () => void; onConfirm: () => void }) {
  const modal = useModal(onCancel);
  const uid = useId();
  return (
    <dialog ref={modal.ref} onCancel={modal.onCancel} role="alertdialog" aria-labelledby={`${uid}-t`} aria-describedby={`${uid}-d`}>
      <h2 id={`${uid}-t`}>確認刪除</h2>
      <p id={`${uid}-d`}>確定要刪除訂單 #{order.id}（{order.customer}）嗎？此操作無法復原。</p>
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onCancel} autoFocus>取消</button>
        <button type="button" className="btn danger-solid" onClick={onConfirm}>確認刪除</button>
      </div>
    </dialog>
  );
}
