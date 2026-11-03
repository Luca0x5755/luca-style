import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, ContentState, DataTable, Select, StatusMessage, TextField } from '@luca-style/react';

type Status = 'pending' | 'paid' | 'shipped' | 'cancelled';
type Order = { id: number; customer: string; amount: number; status: Status; createdAt: string };

const STATUS_LABEL: Record<Status, string> = {
  pending: '待付款',
  paid: '已付款',
  shipped: '已出貨',
  cancelled: '已取消',
};
const STATUSES = Object.keys(STATUS_LABEL) as Status[];

const SEED: Order[] = [
  { id: 1001, customer: '王小明', amount: 1280, status: 'pending', createdAt: '2026-10-02' },
  { id: 1002, customer: '陳雅婷', amount: 3490, status: 'paid', createdAt: '2026-10-05' },
  { id: 1003, customer: '林建宏', amount: 560, status: 'shipped', createdAt: '2026-10-08' },
  { id: 1004, customer: '張惠美', amount: 12800, status: 'cancelled', createdAt: '2026-10-11' },
  { id: 1005, customer: '李志偉', amount: 2250, status: 'paid', createdAt: '2026-10-15' },
  { id: 1006, customer: '黃淑芬', amount: 780, status: 'pending', createdAt: '2026-10-19' },
  { id: 1007, customer: '吳俊傑', amount: 5320, status: 'shipped', createdAt: '2026-10-24' },
  { id: 1008, customer: '劉怡君', amount: 990, status: 'paid', createdAt: '2026-10-28' },
  { id: 1009, customer: '蔡宗翰', amount: 4100, status: 'pending', createdAt: '2026-11-01' },
];

type ViewState = 'loading' | 'empty' | 'error' | 'success';
function readState(): ViewState {
  const value = new URLSearchParams(window.location.search).get('state');
  return value === 'loading' || value === 'empty' || value === 'error' ? value : 'success';
}

const money = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 });

type FormValues = { customer: string; amount: string; status: Status };
type FormErrors = { customer?: string; amount?: string };

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  if (!values.customer.trim()) errors.customer = '請輸入客戶名稱';
  const amount = Number(values.amount);
  if (values.amount.trim() === '' || Number.isNaN(amount)) errors.amount = '請輸入金額';
  else if (amount <= 0) errors.amount = '金額必須大於 0';
  return errors;
}

function OrderForm({ editing, onSubmit, onCancel }: {
  editing: Order | null;
  onSubmit: (values: { customer: string; amount: number; status: Status }) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<FormValues>({
    customer: editing?.customer ?? '',
    amount: editing ? String(editing.amount) : '',
    status: editing?.status ?? 'pending',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit({ customer: values.customer.trim(), amount: Number(values.amount), status: values.status });
  };

  return (
    <section className="panel" aria-labelledby="form-title">
      <h2 id="form-title" ref={headingRef} tabIndex={-1}>{editing ? `編輯訂單 #${editing.id}` : '新增訂單'}</h2>
      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          <TextField
            label="客戶（必填）"
            value={values.customer}
            required
            autoComplete="off"
            error={errors.customer}
            onChange={event => setValues({ ...values, customer: event.target.value })}
          />
          <TextField
            label="金額（需大於 0）"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={values.amount}
            required
            error={errors.amount}
            onChange={event => setValues({ ...values, amount: event.target.value })}
          />
          <Select
            label="狀態"
            value={values.status}
            onChange={event => setValues({ ...values, status: event.target.value as Status })}
          >
            {STATUSES.map(status => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
          </Select>
        </div>
        <div className="form-actions">
          <Button type="submit">{editing ? '儲存變更' : '新增'}</Button>
          <Button type="button" variant="secondary" onClick={onCancel}>取消</Button>
        </div>
      </form>
    </section>
  );
}

function ConfirmDelete({ order, onConfirm, onCancel }: { order: Order | null; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (order && !dialog.open) dialog.showModal();
    if (!order && dialog.open) dialog.close();
  }, [order]);
  return (
    <dialog ref={ref} className="confirm" aria-labelledby="confirm-title" aria-describedby="confirm-desc" onCancel={event => { event.preventDefault(); onCancel(); }}>
      {order && (
        <>
          <h2 id="confirm-title">確認刪除訂單</h2>
          <p id="confirm-desc">確定要刪除訂單 #{order.id}（{order.customer}，{money.format(order.amount)}）嗎？此操作無法復原。</p>
          <div className="form-actions">
            <Button onClick={onConfirm}>確認刪除</Button>
            <Button variant="secondary" onClick={onCancel}>取消</Button>
          </div>
        </>
      )}
    </dialog>
  );
}

export function App() {
  const view = readState();
  const [orders, setOrders] = useState<Order[]>(SEED);
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [form, setForm] = useState<{ editing: Order | null } | null>(null);
  const [toDelete, setToDelete] = useState<Order | null>(null);
  const [message, setMessage] = useState('');
  const [retries, setRetries] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const nextId = useRef(Math.max(...SEED.map(order => order.id)) + 1);

  const retry = () => {
    setRetrying(true);
    window.setTimeout(() => { setRetrying(false); setRetries(count => count + 1); }, 600);
  };

  const save = (values: { customer: string; amount: number; status: Status }) => {
    if (form?.editing) {
      const id = form.editing.id;
      setOrders(list => list.map(order => (order.id === id ? { ...order, ...values } : order)));
      setMessage(`已更新訂單 #${id}`);
    } else {
      const id = nextId.current++;
      const createdAt = new Date().toISOString().slice(0, 10);
      setOrders(list => [{ id, createdAt, ...values }, ...list]);
      setMessage(`已新增訂單 #${id}`);
    }
    setForm(null);
  };

  const remove = () => {
    if (!toDelete) return;
    setOrders(list => list.filter(order => order.id !== toDelete.id));
    setMessage(`已刪除訂單 #${toDelete.id}`);
    setToDelete(null);
  };

  const visible = orders.filter(order =>
    (filter === 'all' || order.status === filter) &&
    order.customer.toLowerCase().includes(keyword.trim().toLowerCase()));

  let body;
  if (view === 'loading') {
    body = (
      <section className="panel" data-eval-state="loading" aria-label="訂單列表">
        <ContentState state="loading" title="載入中" description="正在載入訂單資料…" />
      </section>
    );
  } else if (view === 'empty') {
    body = (
      <section className="panel" data-eval-state="empty" aria-label="訂單列表">
        <ContentState state="empty" title="目前沒有任何訂單" description="有新訂單時會顯示在這裡。" />
      </section>
    );
  } else if (view === 'error') {
    body = (
      <section className="panel" data-eval-state="error" aria-label="訂單列表">
        {retrying ? (
          <ContentState state="loading" title="重試中" description="正在重新載入…" />
        ) : (
          <>
            {retries > 0 && <div className="notice"><StatusMessage tone="error">重試失敗（第 {retries} 次），請稍後再試。</StatusMessage></div>}
            <ContentState state="error" title="訂單載入失敗" description="無法取得訂單資料，請重試。" retryLabel="重試" onRetry={retry} />
          </>
        )}
      </section>
    );
  } else {
    body = (
      <>
        {form && <OrderForm key={form.editing?.id ?? 'new'} editing={form.editing} onSubmit={save} onCancel={() => setForm(null)} />}
        <section className="panel" data-eval-state="success" aria-label="訂單列表">
          {message && <div className="notice" role="status"><StatusMessage tone="success">{message}</StatusMessage></div>}
          <div className="toolbar">
            <TextField
              label="搜尋客戶"
              type="search"
              value={keyword}
              autoComplete="off"
              onChange={event => setKeyword(event.target.value)}
            />
            <Select label="依狀態篩選" value={filter} onChange={event => setFilter(event.target.value as 'all' | Status)}>
              <option value="all">全部狀態</option>
              {STATUSES.map(status => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
            </Select>
          </div>
          {visible.length === 0 ? (
            <p className="muted" role="status">沒有符合條件的訂單。</p>
          ) : (
            <div className="table-scroll" tabIndex={0} role="region" aria-label="訂單表格（可水平捲動）">
              <DataTable
                caption={`訂單列表，共 ${visible.length} 筆`}
                rows={visible}
                rowKey={order => String(order.id)}
                columns={[
                  { key: 'id', heading: '編號', render: order => `#${order.id}` },
                  { key: 'customer', heading: '客戶', render: order => order.customer },
                  { key: 'amount', heading: '金額', render: order => <span className="amount">{money.format(order.amount)}</span> },
                  { key: 'status', heading: '狀態', render: order => <span className="badge" data-status={order.status}>{STATUS_LABEL[order.status]}</span> },
                  { key: 'createdAt', heading: '建立日期', render: order => order.createdAt },
                  {
                    key: 'actions',
                    heading: '操作',
                    render: order => (
                      <span className="row-actions">
                        <Button variant="secondary" aria-label={`編輯訂單 #${order.id}（${order.customer}）`} onClick={() => { setMessage(''); setForm({ editing: order }); }}>編輯</Button>
                        <Button variant="secondary" aria-label={`刪除訂單 #${order.id}（${order.customer}）`} onClick={() => setToDelete(order)}>刪除</Button>
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </section>
        <ConfirmDelete order={toDelete} onConfirm={remove} onCancel={() => setToDelete(null)} />
      </>
    );
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>訂單管理</h1>
        {view === 'success' && !form && <Button onClick={() => { setMessage(''); setForm({ editing: null }); }}>新增訂單</Button>}
      </header>
      {body}
    </main>
  );
}
