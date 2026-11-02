import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, ContentState, Select, StatusMessage, TextField } from '@luca-style/react';

type Status = 'pending' | 'paid' | 'shipped' | 'cancelled';
type Order = { id: string; customer: string; amount: number; status: Status; createdAt: string };

const STATUS_LABEL: Record<Status, string> = {
  pending: '待付款',
  paid: '已付款',
  shipped: '已出貨',
  cancelled: '已取消',
};
const STATUSES = Object.keys(STATUS_LABEL) as Status[];

const SEED: Order[] = [
  { id: 'A1001', customer: '王小明', amount: 1280, status: 'pending', createdAt: '2026-10-01' },
  { id: 'A1002', customer: '陳美玲', amount: 3560, status: 'paid', createdAt: '2026-10-03' },
  { id: 'A1003', customer: '林志豪', amount: 920, status: 'shipped', createdAt: '2026-10-05' },
  { id: 'A1004', customer: '張雅婷', amount: 7450, status: 'cancelled', createdAt: '2026-10-08' },
  { id: 'A1005', customer: '李大偉', amount: 2100, status: 'paid', createdAt: '2026-10-12' },
  { id: 'A1006', customer: '黃淑芬', amount: 480, status: 'pending', createdAt: '2026-10-15' },
  { id: 'A1007', customer: '吳建宏', amount: 15800, status: 'shipped', createdAt: '2026-10-20' },
  { id: 'A1008', customer: '劉怡君', amount: 2690, status: 'pending', createdAt: '2026-10-24' },
  { id: 'A1009', customer: '蔡宗翰', amount: 5300, status: 'paid', createdAt: '2026-10-28' },
];

type ViewState = 'loading' | 'empty' | 'error' | 'success';
function readState(): ViewState {
  const s = new URLSearchParams(window.location.search).get('state');
  return s === 'loading' || s === 'empty' || s === 'error' ? s : 'success';
}

const fmt = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 });

type Draft = { customer: string; amount: string; status: Status };
type Errors = { customer?: string; amount?: string };

function validate(d: Draft): Errors {
  const e: Errors = {};
  if (!d.customer.trim()) e.customer = '請輸入客戶名稱';
  const n = Number(d.amount);
  if (d.amount.trim() === '' || !Number.isFinite(n)) e.amount = '請輸入金額';
  else if (n <= 0) e.amount = '金額必須大於 0';
  return e;
}

function OrderDialog({ order, onClose, onSave }: { order: Order | null; onClose: () => void; onSave: (d: Draft) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Draft>({
    customer: order?.customer ?? '',
    amount: order ? String(order.amount) : '',
    status: order?.status ?? 'pending',
  });
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate(draft);
    setErrors(e);
    if (Object.keys(e).length === 0) onSave(draft);
  };

  return (
    <dialog ref={ref} className="dialog" aria-labelledby="order-form-title" onClose={onClose} onCancel={onClose}>
      <form onSubmit={submit} noValidate className="dialog-body">
        <h2 id="order-form-title">{order ? `編輯訂單 ${order.id}` : '新增訂單'}</h2>
        <TextField
          label="客戶"
          value={draft.customer}
          required
          error={errors.customer}
          onChange={e => setDraft({ ...draft, customer: e.target.value })}
        />
        <TextField
          label="金額"
          type="number"
          inputMode="decimal"
          step="any"
          value={draft.amount}
          required
          error={errors.amount}
          onChange={e => setDraft({ ...draft, amount: e.target.value })}
        />
        <Select label="狀態" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as Status })}>
          {STATUSES.map(s => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <div className="actions">
          <Button type="button" variant="secondary" onClick={() => ref.current?.close()}>
            取消
          </Button>
          <Button type="submit">儲存</Button>
        </div>
      </form>
    </dialog>
  );
}

function ConfirmDialog({ order, onCancel, onConfirm }: { order: Order; onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="dialog" role="alertdialog" aria-labelledby="del-title" aria-describedby="del-desc" onClose={onCancel} onCancel={onCancel}>
      <div className="dialog-body">
        <h2 id="del-title">刪除訂單</h2>
        <p id="del-desc">
          確定要刪除 {order.id}（{order.customer}）嗎？此操作無法復原。
        </p>
        <div className="actions">
          <Button type="button" variant="secondary" onClick={() => ref.current?.close()}>
            取消
          </Button>
          <Button type="button" onClick={onConfirm}>
            確認刪除
          </Button>
        </div>
      </div>
    </dialog>
  );
}

export function App() {
  const view = readState();
  const [orders, setOrders] = useState<Order[]>(view === 'success' ? SEED : []);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [editing, setEditing] = useState<Order | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Order | null>(null);
  const [notice, setNotice] = useState('');
  const [retryMsg, setRetryMsg] = useState('');
  const nextId = useRef(1010);

  const shown = orders.filter(
    o => (filter === 'all' || o.status === filter) && o.customer.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const save = (d: Draft) => {
    const amount = Number(d.amount);
    if (editing === 'new') {
      const today = new Date().toISOString().slice(0, 10);
      setOrders([{ id: `A${nextId.current++}`, customer: d.customer.trim(), amount, status: d.status, createdAt: today }, ...orders]);
      setNotice('已新增訂單');
    } else if (editing) {
      const id = editing.id;
      setOrders(orders.map(o => (o.id === id ? { ...o, customer: d.customer.trim(), amount, status: d.status } : o)));
      setNotice('已更新訂單');
    }
    setEditing(null);
  };

  const remove = () => {
    if (!deleting) return;
    setOrders(orders.filter(o => o.id !== deleting.id));
    setNotice(`已刪除訂單 ${deleting.id}`);
    setDeleting(null);
  };

  let body;
  if (view === 'loading') {
    body = (
      <section data-eval-state="loading" aria-busy="true">
        <ContentState state="loading" title="載入中" description="正在取得訂單資料…" />
      </section>
    );
  } else if (view === 'error') {
    body = (
      <section data-eval-state="error">
        <ContentState
          state="error"
          title="載入失敗"
          description="無法取得訂單資料，請重試。"
          onRetry={() => setRetryMsg('仍然無法載入，請稍後再試。')}
        />
        {retryMsg && <div role="status"><StatusMessage tone="error">{retryMsg}</StatusMessage></div>}
      </section>
    );
  } else if (orders.length === 0) {
    body = (
      <section data-eval-state="empty">
        <ContentState state="empty" title="沒有任何訂單" description="按「新增訂單」建立第一筆。" />
      </section>
    );
  } else {
    body = (
      <section data-eval-state="success">
        <div className="toolbar">
          <TextField label="搜尋客戶" type="search" value={query} onChange={e => setQuery(e.target.value)} />
          <Select label="狀態篩選" value={filter} onChange={e => setFilter(e.target.value as 'all' | Status)}>
            <option value="all">全部狀態</option>
            {STATUSES.map(s => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        {shown.length === 0 ? (
          <p className="no-match">沒有符合條件的訂單。</p>
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
              {shown.map(o => (
                <tr key={o.id}>
                  <td data-label="編號">{o.id}</td>
                  <td data-label="客戶">{o.customer}</td>
                  <td data-label="金額" className="num">{fmt.format(o.amount)}</td>
                  <td data-label="狀態"><span className="badge">{STATUS_LABEL[o.status]}</span></td>
                  <td data-label="建立日期">{o.createdAt}</td>
                  <td className="row-actions">
                    <Button variant="secondary" aria-label={`編輯 ${o.id} ${o.customer}`} onClick={() => setEditing(o)}>
                      編輯
                    </Button>
                    <Button variant="secondary" aria-label={`刪除 ${o.id} ${o.customer}`} onClick={() => setDeleting(o)}>
                      刪除
                    </Button>
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
    <main className="page">
      <header className="page-head">
        <h1>訂單管理</h1>
        <Button onClick={() => setEditing('new')}>新增訂單</Button>
      </header>
      <div role="status" className="notice">{notice && <StatusMessage tone="success">{notice}</StatusMessage>}</div>
      {body}
      {editing && <OrderDialog order={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={save} />}
      {deleting && <ConfirmDialog order={deleting} onCancel={() => setDeleting(null)} onConfirm={remove} />}
    </main>
  );
}
