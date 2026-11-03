import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button, ContentState, Select, StatusMessage, TextField } from './luca-style/index';

type Status = 'pending' | 'paid' | 'shipped' | 'cancelled';
type Order = { id: string; customer: string; amount: number; status: Status; createdAt: string };
type ViewState = 'loading' | 'empty' | 'error' | 'success';

const STATUS_LABEL: Record<Status, string> = { pending: '待付款', paid: '已付款', shipped: '已出貨', cancelled: '已取消' };
const STATUSES = Object.keys(STATUS_LABEL) as Status[];

const SEED: Order[] = [
  { id: 'A1001', customer: '王小明', amount: 1280, status: 'pending', createdAt: '2026-10-01' },
  { id: 'A1002', customer: '林美玲', amount: 3560, status: 'paid', createdAt: '2026-10-03' },
  { id: 'A1003', customer: '陳大文', amount: 890, status: 'shipped', createdAt: '2026-10-05' },
  { id: 'A1004', customer: '張雅婷', amount: 12400, status: 'cancelled', createdAt: '2026-10-08' },
  { id: 'A1005', customer: '李志豪', amount: 2150, status: 'paid', createdAt: '2026-10-12' },
  { id: 'A1006', customer: '黃淑芬', amount: 760, status: 'pending', createdAt: '2026-10-15' },
  { id: 'A1007', customer: '吳宗翰', amount: 5300, status: 'shipped', createdAt: '2026-10-20' },
  { id: 'A1008', customer: '劉佳穎', amount: 4480, status: 'paid', createdAt: '2026-10-24' },
  { id: 'A1009', customer: '王小明', amount: 990, status: 'shipped', createdAt: '2026-10-28' },
  { id: 'A1010', customer: '蔡依林', amount: 7800, status: 'pending', createdAt: '2026-11-01' },
];

const money = (n: number) => `NT$ ${n.toLocaleString('zh-TW')}`;

function readState(): ViewState {
  const s = new URLSearchParams(window.location.search).get('state');
  return s === 'loading' || s === 'empty' || s === 'error' ? s : 'success';
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} className="modal" aria-labelledby="modal-title" onClose={onClose} onCancel={onClose}>
      <h2 id="modal-title">{title}</h2>
      {children}
    </dialog>
  );
}

type Draft = { customer: string; amount: string; status: Status };
type Errors = { customer?: string; amount?: string };

function OrderForm({ initial, onSubmit, onCancel }: { initial: Draft; onSubmit: (d: Draft) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!draft.customer.trim()) next.customer = '請輸入客戶名稱';
    const amount = Number(draft.amount);
    if (draft.amount.trim() === '' || !Number.isFinite(amount)) next.amount = '請輸入有效的金額';
    else if (amount <= 0) next.amount = '金額必須大於 0';
    setErrors(next);
    if (Object.keys(next).length === 0) onSubmit({ ...draft, customer: draft.customer.trim() });
  };
  return (
    <form onSubmit={submit} noValidate className="form">
      <TextField label="客戶（必填）" value={draft.customer} error={errors.customer} required autoComplete="off"
        onChange={e => setDraft({ ...draft, customer: e.target.value })} />
      <TextField label="金額（須大於 0）" type="number" inputMode="decimal" step="any" value={draft.amount} error={errors.amount} required
        onChange={e => setDraft({ ...draft, amount: e.target.value })} />
      <Select label="狀態" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as Status })}>
        {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </Select>
      <div className="actions">
        <Button variant="secondary" type="button" onClick={onCancel}>取消</Button>
        <Button type="submit">儲存</Button>
      </div>
    </form>
  );
}

export function App() {
  const [view, setView] = useState<ViewState>(readState);
  const [orders, setOrders] = useState<Order[]>(() => (readState() === 'empty' ? [] : SEED));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [editing, setEditing] = useState<Order | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Order | null>(null);
  const [notice, setNotice] = useState('');
  const [retrying, setRetrying] = useState(false);
  const nextId = useRef(1011);

  useEffect(() => {
    const onPop = () => setView(readState());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const retry = () => {
    setRetrying(true);
    window.setTimeout(() => {
      window.history.replaceState(null, '', '/?state=success');
      setOrders(o => (o.length ? o : SEED));
      setView('success');
      setRetrying(false);
    }, 600);
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter(o => (filter === 'all' || o.status === filter) && (!q || o.customer.toLowerCase().includes(q)));
  }, [orders, query, filter]);

  const save = (d: Draft) => {
    const amount = Number(d.amount);
    if (editing === 'new') {
      const id = `A${nextId.current++}`;
      setOrders(o => [{ id, customer: d.customer, amount, status: d.status, createdAt: new Date().toISOString().slice(0, 10) }, ...o]);
      setNotice(`已新增訂單 ${id}`);
    } else if (editing) {
      const id = editing.id;
      setOrders(o => o.map(x => (x.id === id ? { ...x, customer: d.customer, amount, status: d.status } : x)));
      setNotice(`已更新訂單 ${id}`);
    }
    setEditing(null);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const id = deleting.id;
    setOrders(o => o.filter(x => x.id !== id));
    setNotice(`已刪除訂單 ${id}`);
    setDeleting(null);
  };

  // empty 參數下新增訂單後，仍要能看到新資料
  const effective: ViewState = view === 'empty' && orders.length > 0 ? 'success' : view;

  let body: ReactNode;
  if (effective === 'loading') {
    body = <section data-eval-state="loading" aria-label="訂單列表"><ContentState state="loading" title="訂單載入中" description="正在取得訂單資料，請稍候。" /></section>;
  } else if (effective === 'error') {
    body = (
      <section data-eval-state="error" aria-label="訂單列表">
        <ContentState state="error" title="訂單載入失敗" description={retrying ? '正在重新載入…' : '無法取得訂單資料，請重試。'} retryLabel="重試" onRetry={retrying ? undefined : retry} />
      </section>
    );
  } else if (effective === 'empty') {
    body = (
      <section data-eval-state="empty" aria-label="訂單列表">
        <ContentState state="empty" title="目前沒有任何訂單" description="按「新增訂單」建立第一筆訂單。" />
      </section>
    );
  } else {
    body = (
      <section data-eval-state="success" aria-label="訂單列表">
        <div className="toolbar">
          <TextField label="搜尋客戶" type="search" value={query} placeholder="輸入客戶名稱" autoComplete="off" onChange={e => setQuery(e.target.value)} />
          <Select label="狀態篩選" value={filter} onChange={e => setFilter(e.target.value as 'all' | Status)}>
            <option value="all">全部狀態</option>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </Select>
        </div>
        <p className="count" role="status">共 {shown.length} 筆訂單</p>
        {shown.length === 0 ? (
          <ContentState state="empty" title="找不到符合條件的訂單" description="請調整搜尋關鍵字或狀態篩選。" />
        ) : (
          <div className="table-wrap">
            <table className="orders">
              <caption className="luca-visually-hidden">訂單列表</caption>
              <thead>
                <tr>
                  <th scope="col">編號</th><th scope="col">客戶</th><th scope="col" className="num">金額</th>
                  <th scope="col">狀態</th><th scope="col">建立日期</th><th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(o => (
                  <tr key={o.id}>
                    <td data-label="編號">{o.id}</td>
                    <td data-label="客戶">{o.customer}</td>
                    <td data-label="金額" className="num">{money(o.amount)}</td>
                    <td data-label="狀態"><span className={`badge badge-${o.status}`}>{STATUS_LABEL[o.status]}</span></td>
                    <td data-label="建立日期">{o.createdAt}</td>
                    <td data-label="操作" className="row-actions">
                      <Button variant="secondary" aria-label={`編輯訂單 ${o.id}（${o.customer}）`} onClick={() => setEditing(o)}>編輯</Button>
                      <Button variant="secondary" aria-label={`刪除訂單 ${o.id}（${o.customer}）`} onClick={() => setDeleting(o)}>刪除</Button>
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

  const canAdd = effective === 'success' || effective === 'empty';

  return (
    <main className="page">
      <header className="page-head">
        <h1>訂單管理</h1>
        {canAdd && <Button onClick={() => setEditing('new')}>新增訂單</Button>}
      </header>
      {notice && <div className="notice"><StatusMessage tone="success">{notice}</StatusMessage></div>}
      {body}
      {editing && (
        <Modal title={editing === 'new' ? '新增訂單' : `編輯訂單 ${editing.id}`} onClose={() => setEditing(null)}>
          <OrderForm
            initial={editing === 'new' ? { customer: '', amount: '', status: 'pending' } : { customer: editing.customer, amount: String(editing.amount), status: editing.status }}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
      {deleting && (
        <Modal title="確認刪除" onClose={() => setDeleting(null)}>
          <p>確定要刪除訂單 {deleting.id}（{deleting.customer}，{money(deleting.amount)}）嗎？此動作無法復原。</p>
          <div className="actions">
            <Button variant="secondary" onClick={() => setDeleting(null)}>取消</Button>
            <Button onClick={confirmDelete}>確認刪除</Button>
          </div>
        </Modal>
      )}
    </main>
  );
}
