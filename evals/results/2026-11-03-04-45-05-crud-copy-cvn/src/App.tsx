import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Button, ContentState, Select, StatusMessage, TextField } from './luca-style/index';
import { STATUSES, STATUS_LABELS, seedOrders, type Order, type Status } from './data';

type ViewState = 'loading' | 'empty' | 'error' | 'success';

const readState = (): ViewState => {
  const value = new URLSearchParams(window.location.search).get('state');
  return value === 'loading' || value === 'empty' || value === 'error' || value === 'success' ? value : 'success';
};

const money = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 });

type FormErrors = { customer?: string; amount?: string };

function OrderDialog({ order, onSave, onClose }: { order: Order | null; onSave: (v: { customer: string; amount: number; status: Status }) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [customer, setCustomer] = useState(order?.customer ?? '');
  const [amount, setAmount] = useState(order ? String(order.amount) : '');
  const [status, setStatus] = useState<Status>(order?.status ?? 'pending');
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: FormErrors = {};
    const value = Number(amount);
    if (!customer.trim()) next.customer = '請輸入客戶名稱';
    if (amount.trim() === '' || !Number.isFinite(value)) next.amount = '請輸入金額';
    else if (value <= 0) next.amount = '金額必須大於 0';
    setErrors(next);
    if (next.customer || next.amount) return;
    onSave({ customer: customer.trim(), amount: value, status });
  };

  return (
    <dialog ref={ref} className="app-dialog" aria-labelledby="order-dialog-title" onClose={onClose} onCancel={onClose}>
      <form onSubmit={submit} noValidate className="app-form">
        <h2 id="order-dialog-title">{order ? `編輯訂單 ${order.id}` : '新增訂單'}</h2>
        <TextField label="客戶" value={customer} onChange={e => setCustomer(e.target.value)} error={errors.customer} required autoComplete="off" />
        <TextField label="金額" type="number" inputMode="decimal" step="any" value={amount} onChange={e => setAmount(e.target.value)} error={errors.amount} required />
        <Select label="狀態" value={status} onChange={e => setStatus(e.target.value as Status)}>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </Select>
        <div className="app-actions">
          <Button variant="secondary" type="button" onClick={onClose}>取消</Button>
          <Button type="submit">儲存</Button>
        </div>
      </form>
    </dialog>
  );
}

function ConfirmDialog({ order, onConfirm, onClose }: { order: Order; onConfirm: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog ref={ref} className="app-dialog" role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-desc" onClose={onClose} onCancel={onClose}>
      <div className="app-form">
        <h2 id="confirm-title">確認刪除</h2>
        <p id="confirm-desc">確定要刪除訂單 {order.id}（{order.customer}）嗎？此操作無法復原。</p>
        <div className="app-actions">
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={onConfirm}>確認刪除</Button>
        </div>
      </div>
    </dialog>
  );
}

export function App() {
  const [view, setView] = useState<ViewState>(readState);
  const [orders, setOrders] = useState<Order[]>(() => (readState() === 'success' ? seedOrders : []));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [editing, setEditing] = useState<Order | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Order | null>(null);
  const [notice, setNotice] = useState('');
  const nextId = useRef(1011);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter(o => (filter === 'all' || o.status === filter) && (!q || o.customer.toLowerCase().includes(q)));
  }, [orders, query, filter]);

  const retry = () => {
    window.history.replaceState(null, '', window.location.pathname + '?state=success');
    setOrders(seedOrders);
    setView('success');
  };

  const save = (v: { customer: string; amount: number; status: Status }) => {
    if (editing === 'new') {
      const id = `A${nextId.current++}`;
      setOrders(list => [{ id, ...v, createdAt: new Date().toISOString().slice(0, 10) }, ...list]);
      setNotice(`已新增訂單 ${id}`);
    } else if (editing) {
      const id = editing.id;
      setOrders(list => list.map(o => (o.id === id ? { ...o, ...v } : o)));
      setNotice(`已更新訂單 ${id}`);
    }
    setEditing(null);
  };

  const remove = () => {
    if (!deleting) return;
    const id = deleting.id;
    setOrders(list => list.filter(o => o.id !== id));
    setNotice(`已刪除訂單 ${id}`);
    setDeleting(null);
  };

  const effective: ViewState = view === 'empty' && orders.length > 0 ? 'success' : view === 'success' && orders.length === 0 ? 'empty' : view;

  let body;
  if (effective === 'loading') {
    body = <section data-eval-state="loading" aria-label="訂單列表"><ContentState state="loading" title="訂單載入中" description="正在取得訂單資料，請稍候。" /></section>;
  } else if (effective === 'error') {
    body = <section data-eval-state="error" aria-label="訂單列表"><ContentState state="error" title="訂單載入失敗" description="無法取得訂單資料，請重試。" retryLabel="重試" onRetry={retry} /></section>;
  } else if (effective === 'empty') {
    body = (
      <section data-eval-state="empty" aria-label="訂單列表">
        <ContentState state="empty" title="目前沒有訂單" description="新增第一筆訂單後會顯示於此。" />
        <p><Button onClick={() => setEditing('new')}>新增訂單</Button></p>
      </section>
    );
  } else {
    body = (
      <section data-eval-state="success" aria-label="訂單列表">
        <div className="app-toolbar">
          <TextField label="搜尋客戶" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="輸入客戶名稱" autoComplete="off" />
          <Select label="狀態篩選" value={filter} onChange={e => setFilter(e.target.value as 'all' | Status)}>
            <option value="all">全部狀態</option>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </Select>
          <Button onClick={() => setEditing('new')}>新增訂單</Button>
        </div>
        <p className="app-count" role="status">共 {visible.length} 筆訂單</p>
        {visible.length === 0 ? (
          <p className="app-none">沒有符合條件的訂單。</p>
        ) : (
          <table className="app-table">
            <caption className="app-sr">訂單列表</caption>
            <thead>
              <tr><th scope="col">編號</th><th scope="col">客戶</th><th scope="col" className="app-num">金額</th><th scope="col">狀態</th><th scope="col">建立日期</th><th scope="col">操作</th></tr>
            </thead>
            <tbody>
              {visible.map(o => (
                <tr key={o.id}>
                  <td data-label="編號">{o.id}</td>
                  <td data-label="客戶">{o.customer}</td>
                  <td data-label="金額" className="app-num">{money.format(o.amount)}</td>
                  <td data-label="狀態"><span className={`app-badge app-badge-${o.status}`}>{STATUS_LABELS[o.status]}</span></td>
                  <td data-label="建立日期">{o.createdAt}</td>
                  <td data-label="操作">
                    <div className="app-row-actions">
                      <Button variant="secondary" onClick={() => setEditing(o)} aria-label={`編輯訂單 ${o.id}`}>編輯</Button>
                      <Button variant="secondary" onClick={() => setDeleting(o)} aria-label={`刪除訂單 ${o.id}`}>刪除</Button>
                    </div>
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
    <main className="app-main">
      <h1>訂單管理</h1>
      {notice && <StatusMessage tone="success">{notice}</StatusMessage>}
      {body}
      {editing && <OrderDialog order={editing === 'new' ? null : editing} onSave={save} onClose={() => setEditing(null)} />}
      {deleting && <ConfirmDialog order={deleting} onConfirm={remove} onClose={() => setDeleting(null)} />}
    </main>
  );
}
