import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

type Status = '待付款' | '已付款' | '已出貨' | '已取消';
interface Order {
  id: string;
  customer: string;
  amount: number;
  status: Status;
  createdAt: string;
}
const STATUSES: Status[] = ['待付款', '已付款', '已出貨', '已取消'];
const BADGE: Record<Status, string> = { 待付款: 'pending', 已付款: 'paid', 已出貨: 'shipped', 已取消: 'cancelled' };

const SEED: Order[] = [
  { id: 'A1001', customer: '王小明', amount: 1280, status: '待付款', createdAt: '2026-10-01' },
  { id: 'A1002', customer: '陳美玲', amount: 3560, status: '已付款', createdAt: '2026-10-03' },
  { id: 'A1003', customer: '林志豪', amount: 920, status: '已出貨', createdAt: '2026-10-05' },
  { id: 'A1004', customer: '張雅婷', amount: 4800, status: '已取消', createdAt: '2026-10-08' },
  { id: 'A1005', customer: '李大衛', amount: 2150, status: '已付款', createdAt: '2026-10-12' },
  { id: 'A1006', customer: '黃淑芬', amount: 760, status: '待付款', createdAt: '2026-10-15' },
  { id: 'A1007', customer: '吳宗翰', amount: 15999, status: '已出貨', createdAt: '2026-10-21' },
  { id: 'A1008', customer: '劉佳穎', amount: 3320, status: '已付款', createdAt: '2026-10-27' },
  { id: 'A1009', customer: '王小美', amount: 640, status: '待付款', createdAt: '2026-10-30' },
];

type ViewState = 'loading' | 'empty' | 'error' | 'success';
function readState(): ViewState {
  const s = new URLSearchParams(window.location.search).get('state');
  return s === 'loading' || s === 'empty' || s === 'error' || s === 'success' ? s : 'success';
}

const fmt = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 });

export default function App() {
  const state = readState();
  const [orders, setOrders] = useState<Order[]>(state === 'empty' ? [] : SEED);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [editing, setEditing] = useState<Order | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Order | null>(null);
  const [retryMsg, setRetryMsg] = useState('');
  const nextId = useRef(1010);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter(
      (o) => (filter === 'all' || o.status === filter) && (!q || o.customer.toLowerCase().includes(q)),
    );
  }, [orders, query, filter]);

  function save(data: { customer: string; amount: number; status: Status }) {
    if (editing === 'new') {
      const o: Order = {
        id: 'A' + nextId.current++,
        ...data,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      setOrders((p) => [o, ...p]);
    } else if (editing) {
      const id = editing.id;
      setOrders((p) => p.map((o) => (o.id === id ? { ...o, ...data } : o)));
    }
    setEditing(null);
  }

  const showList = state === 'success' || state === 'empty';
  const isEmpty = orders.length === 0;

  return (
    <main className="page">
      <header className="head">
        <h1>訂單管理</h1>
        {showList && (
          <button className="btn primary" onClick={() => setEditing('new')}>
            新增訂單
          </button>
        )}
      </header>

      {showList && !isEmpty && (
        <div className="toolbar" role="search">
          <div className="field">
            <label htmlFor="q">搜尋客戶</label>
            <input id="q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="輸入客戶名稱" />
          </div>
          <div className="field">
            <label htmlFor="st">狀態</label>
            <select id="st" value={filter} onChange={(e) => setFilter(e.target.value as 'all' | Status)}>
              <option value="all">全部狀態</option>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {state === 'loading' && (
        <section data-eval-state="loading" className="panel" aria-busy="true" aria-label="訂單列表">
          <p role="status" className="muted">載入中…</p>
          <div className="skeletons" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" />
            ))}
          </div>
        </section>
      )}

      {state === 'error' && (
        <section data-eval-state="error" className="panel center" aria-label="訂單列表">
          <h2>載入失敗</h2>
          <p className="muted">無法取得訂單資料，請稍後再試。</p>
          <button
            className="btn primary"
            onClick={() => setRetryMsg('重試後仍然失敗，請稍後再試。（' + new Date().toLocaleTimeString('zh-TW') + '）')}
          >
            重試
          </button>
          <p role="status" className="muted">{retryMsg}</p>
        </section>
      )}

      {showList && isEmpty && (
        <section data-eval-state="empty" className="panel center" aria-label="訂單列表">
          <h2>目前沒有訂單</h2>
          <p className="muted">按「新增訂單」建立第一筆訂單。</p>
        </section>
      )}

      {showList && !isEmpty && (
        <section data-eval-state="success" className="panel" aria-label="訂單列表">
          <p role="status" className="muted count">共 {filtered.length} 筆</p>
          {filtered.length === 0 ? (
            <p className="center muted">沒有符合條件的訂單。</p>
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
                {filtered.map((o) => (
                  <tr key={o.id}>
                    <td data-label="編號">{o.id}</td>
                    <td data-label="客戶">{o.customer}</td>
                    <td data-label="金額" className="num">{fmt.format(o.amount)}</td>
                    <td data-label="狀態"><span className={'badge ' + BADGE[o.status]}>{o.status}</span></td>
                    <td data-label="建立日期">{o.createdAt}</td>
                    <td data-label="操作" className="actions">
                      <button className="btn" onClick={() => setEditing(o)} aria-label={`編輯 ${o.id} ${o.customer}`}>編輯</button>
                      <button className="btn danger" onClick={() => setDeleting(o)} aria-label={`刪除 ${o.id} ${o.customer}`}>刪除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {editing && (
        <Modal title={editing === 'new' ? '新增訂單' : '編輯訂單'} onClose={() => setEditing(null)}>
          <OrderForm initial={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onSave={save} />
        </Modal>
      )}
      {deleting && (
        <Modal title="確認刪除" onClose={() => setDeleting(null)}>
          <p>確定要刪除訂單 {deleting.id}（{deleting.customer}）嗎？此操作無法復原。</p>
          <div className="form-actions">
            <button className="btn" onClick={() => setDeleting(null)}>取消</button>
            <button
              className="btn danger-solid"
              onClick={() => {
                const id = deleting.id;
                setOrders((p) => p.filter((o) => o.id !== id));
                setDeleting(null);
              }}
            >
              確認刪除
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const tid = useId();
  useEffect(() => {
    const d = ref.current!;
    const opener = document.activeElement as HTMLElement | null;
    if (!d.open) d.showModal();
    return () => {
      d.close();
      opener?.focus?.();
    };
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={tid} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <h2 id={tid}>{title}</h2>
      {children}
    </dialog>
  );
}

function OrderForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Order | null;
  onSave: (d: { customer: string; amount: number; status: Status }) => void;
  onCancel: () => void;
}) {
  const [customer, setCustomer] = useState(initial?.customer ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [status, setStatus] = useState<Status>(initial?.status ?? '待付款');
  const [errors, setErrors] = useState<{ customer?: string; amount?: string }>({});
  const cRef = useRef<HTMLInputElement>(null);
  const aRef = useRef<HTMLInputElement>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    const n = Number(amount);
    if (!customer.trim()) errs.customer = '請填寫客戶';
    if (amount.trim() === '' || !Number.isFinite(n)) errs.amount = '請輸入有效的金額';
    else if (n <= 0) errs.amount = '金額必須大於 0';
    setErrors(errs);
    if (errs.customer) return cRef.current?.focus();
    if (errs.amount) return aRef.current?.focus();
    onSave({ customer: customer.trim(), amount: n, status });
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="f-customer">客戶（必填）</label>
        <input
          id="f-customer" ref={cRef} value={customer} onChange={(e) => setCustomer(e.target.value)}
          required aria-required="true" aria-invalid={!!errors.customer}
          aria-describedby={errors.customer ? 'e-customer' : undefined} autoComplete="off"
        />
        {errors.customer && <p id="e-customer" className="error">{errors.customer}</p>}
      </div>
      <div className="field">
        <label htmlFor="f-amount">金額（必填，需大於 0）</label>
        <input
          id="f-amount" ref={aRef} type="number" inputMode="decimal" step="any" value={amount}
          onChange={(e) => setAmount(e.target.value)} required aria-required="true"
          aria-invalid={!!errors.amount} aria-describedby={errors.amount ? 'e-amount' : undefined}
        />
        {errors.amount && <p id="e-amount" className="error">{errors.amount}</p>}
      </div>
      <div className="field">
        <label htmlFor="f-status">狀態</label>
        <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel}>取消</button>
        <button type="submit" className="btn primary">儲存</button>
      </div>
    </form>
  );
}
