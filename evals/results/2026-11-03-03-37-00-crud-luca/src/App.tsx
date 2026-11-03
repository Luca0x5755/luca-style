import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Button, ContentState, Select, StatusMessage, TextField } from '@luca-style/react';

type Status = 'pending' | 'paid' | 'shipped' | 'cancelled';
type Order = { id: string; customer: string; amount: number; status: Status; createdAt: string };
type ViewState = 'loading' | 'empty' | 'error' | 'success';

const STATUS_LABEL: Record<Status, string> = {
  pending: '待付款',
  paid: '已付款',
  shipped: '已出貨',
  cancelled: '已取消',
};
const STATUS_ICON: Record<Status, string> = { pending: '◔', paid: '✓', shipped: '➜', cancelled: '✕' };
const STATUSES = Object.keys(STATUS_LABEL) as Status[];

const SEED: Order[] = [
  { id: 'A1001', customer: '王小明', amount: 1280, status: 'pending', createdAt: '2026-10-28' },
  { id: 'A1002', customer: '林美玲', amount: 3560, status: 'paid', createdAt: '2026-10-29' },
  { id: 'A1003', customer: '陳大文', amount: 899, status: 'shipped', createdAt: '2026-10-30' },
  { id: 'A1004', customer: '張雅婷', amount: 12450, status: 'paid', createdAt: '2026-10-30' },
  { id: 'A1005', customer: '李志豪', amount: 540, status: 'cancelled', createdAt: '2026-10-31' },
  { id: 'A1006', customer: '黃淑芬', amount: 2200, status: 'pending', createdAt: '2026-11-01' },
  { id: 'A1007', customer: '吳建宏', amount: 7800, status: 'shipped', createdAt: '2026-11-01' },
  { id: 'A1008', customer: '劉佳穎', amount: 1999, status: 'paid', createdAt: '2026-11-02' },
  { id: 'A1009', customer: '王小明', amount: 320, status: 'cancelled', createdAt: '2026-11-02' },
  { id: 'A1010', customer: '蔡宗翰', amount: 4650, status: 'pending', createdAt: '2026-11-03' },
];

function readState(): ViewState {
  const value = new URLSearchParams(window.location.search).get('state');
  return value === 'loading' || value === 'empty' || value === 'error' ? value : 'success';
}

const fmt = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 });

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

function OrderForm({
  editing,
  onSave,
  onCancel,
}: {
  editing: Order | null;
  onSave: (values: { customer: string; amount: number; status: Status }) => void;
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
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    onSave({ customer: values.customer.trim(), amount: Number(values.amount), status: values.status });
  };

  return (
    <section className="panel" aria-labelledby="form-title">
      <h2 id="form-title" ref={headingRef} tabIndex={-1} className="panel-title">
        {editing ? `編輯訂單 ${editing.id}` : '新增訂單'}
      </h2>
      <form onSubmit={submit} noValidate className="form">
        <TextField
          label="客戶（必填）"
          value={values.customer}
          error={errors.customer}
          required
          onChange={e => setValues({ ...values, customer: e.target.value })}
        />
        <TextField
          label="金額（需大於 0）"
          type="number"
          inputMode="decimal"
          step="any"
          value={values.amount}
          error={errors.amount}
          required
          onChange={e => setValues({ ...values, amount: e.target.value })}
        />
        <Select
          label="狀態"
          value={values.status}
          onChange={e => setValues({ ...values, status: e.target.value as Status })}
        >
          {STATUSES.map(s => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <div className="actions">
          <Button type="submit">儲存</Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            取消
          </Button>
        </div>
      </form>
    </section>
  );
}

function ConfirmDelete({ order, onConfirm, onCancel }: { order: Order; onConfirm: () => void; onCancel: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialogRef.current?.querySelector('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="overlay">
      <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="del-title" aria-describedby="del-desc" className="dialog">
        <h2 id="del-title" className="panel-title">
          確認刪除
        </h2>
        <p id="del-desc">
          確定要刪除訂單 {order.id}（{order.customer}，{fmt.format(order.amount)}）嗎？此操作無法復原。
        </p>
        <div className="actions">
          <Button variant="secondary" onClick={onCancel}>
            取消
          </Button>
          <Button onClick={onConfirm}>確認刪除</Button>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const [view, setView] = useState<ViewState>(readState);
  const [orders, setOrders] = useState<Order[]>(SEED);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');
  const [formMode, setFormMode] = useState<'closed' | 'new' | Order>('closed');
  const [pendingDelete, setPendingDelete] = useState<Order | null>(null);
  const [notice, setNotice] = useState('');
  const nextId = useRef(1011);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onPop = () => setView(readState());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const retry = () => {
    window.history.replaceState(null, '', '/?state=success');
    setView('success');
  };

  const visible = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return orders.filter(
      o => (statusFilter === 'all' || o.status === statusFilter) && (!q || o.customer.toLowerCase().includes(q)),
    );
  }, [orders, keyword, statusFilter]);

  const closeForm = () => {
    setFormMode('closed');
    triggerRef.current?.focus();
  };

  const save = (v: { customer: string; amount: number; status: Status }) => {
    if (formMode === 'new') {
      const today = new Date().toISOString().slice(0, 10);
      setOrders(prev => [{ id: `A${nextId.current++}`, createdAt: today, ...v }, ...prev]);
      setNotice(`已新增訂單（${v.customer}）`);
    } else if (formMode !== 'closed') {
      const id = formMode.id;
      setOrders(prev => prev.map(o => (o.id === id ? { ...o, ...v } : o)));
      setNotice(`已更新訂單 ${id}`);
    }
    setFormMode('closed');
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setOrders(prev => prev.filter(o => o.id !== target.id));
    setNotice(`已刪除訂單 ${target.id}`);
    setPendingDelete(null);
  };

  const cancelDelete = () => {
    setPendingDelete(null);
    triggerRef.current?.focus();
  };

  return (
    <div className="page">
      <header className="header">
        <h1 className="page-title">訂單管理</h1>
        {view === 'success' && formMode === 'closed' && (
          <Button
            onClick={e => {
              triggerRef.current = e.currentTarget;
              setNotice('');
              setFormMode('new');
            }}
          >
            新增訂單
          </Button>
        )}
      </header>

      <main>
        <div aria-live="polite" className="notice-wrap">
          {notice && <StatusMessage tone="success">{notice}</StatusMessage>}
        </div>

        {view === 'loading' && (
          <section data-eval-state="loading" aria-label="訂單列表" className="panel">
            <ContentState state="loading" title="載入中" description="正在讀取訂單資料…" />
          </section>
        )}

        {view === 'empty' && (
          <section data-eval-state="empty" aria-label="訂單列表" className="panel">
            <ContentState state="empty" title="目前沒有訂單" description="有新訂單時會顯示在這裡。" />
          </section>
        )}

        {view === 'error' && (
          <section data-eval-state="error" aria-label="訂單列表" className="panel">
            <ContentState
              state="error"
              title="訂單載入失敗"
              description="無法取得訂單資料，請稍後再試。"
              retryLabel="重試"
              onRetry={retry}
            />
          </section>
        )}

        {view === 'success' && (
          <section data-eval-state="success" aria-label="訂單列表">
            {formMode !== 'closed' && (
              <OrderForm editing={formMode === 'new' ? null : formMode} onSave={save} onCancel={closeForm} />
            )}

            <div className="panel">
              <div className="toolbar" role="search">
                <TextField
                  label="搜尋客戶"
                  type="search"
                  value={keyword}
                  placeholder="輸入客戶名稱"
                  onChange={e => setKeyword(e.target.value)}
                />
                <Select
                  label="依狀態篩選"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as 'all' | Status)}
                >
                  <option value="all">全部狀態</option>
                  {STATUSES.map(s => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
              </div>

              {visible.length === 0 ? (
                <p className="no-match">沒有符合條件的訂單。</p>
              ) : (
                <table className="orders">
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
                    {visible.map(o => (
                      <tr key={o.id}>
                        <td data-label="編號">{o.id}</td>
                        <td data-label="客戶">{o.customer}</td>
                        <td data-label="金額" className="num">
                          {fmt.format(o.amount)}
                        </td>
                        <td data-label="狀態">
                          <span className={`badge badge-${o.status}`}>
                            <span aria-hidden="true">{STATUS_ICON[o.status]}</span> {STATUS_LABEL[o.status]}
                          </span>
                        </td>
                        <td data-label="建立日期">{o.createdAt}</td>
                        <td data-label="操作">
                          <div className="row-actions">
                            <Button
                              variant="secondary"
                              aria-label={`編輯訂單 ${o.id}`}
                              onClick={e => {
                                triggerRef.current = e.currentTarget;
                                setNotice('');
                                setFormMode(o);
                              }}
                            >
                              編輯
                            </Button>
                            <Button
                              variant="secondary"
                              aria-label={`刪除訂單 ${o.id}`}
                              onClick={e => {
                                triggerRef.current = e.currentTarget;
                                setNotice('');
                                setPendingDelete(o);
                              }}
                            >
                              刪除
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}
      </main>

      {pendingDelete && <ConfirmDelete order={pendingDelete} onConfirm={confirmDelete} onCancel={cancelDelete} />}
    </div>
  );
}
