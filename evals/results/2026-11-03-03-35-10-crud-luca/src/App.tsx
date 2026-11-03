import { useMemo, useState } from 'react';
import { Button, ContentState, Select, StatusMessage, TextField } from '@luca-style/react';
import { SEED_ORDERS, STATUSES, STATUS_LABEL, type Order, type Status } from './data';
import { Modal } from './Modal';
import { OrderForm, type OrderDraft } from './OrderForm';

type ViewState = 'loading' | 'empty' | 'error' | 'success';

function readState(): ViewState {
  const value = new URLSearchParams(window.location.search).get('state');
  return value === 'loading' || value === 'empty' || value === 'error' ? value : 'success';
}

const money = new Intl.NumberFormat('zh-TW');

export function App() {
  const state = readState();
  const [orders, setOrders] = useState<Order[]>(state === 'empty' ? [] : SEED_ORDERS);
  const [nextNo, setNextNo] = useState(1011);
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [editing, setEditing] = useState<Order | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Order | null>(null);
  const [notice, setNotice] = useState('');
  const [retries, setRetries] = useState(0);

  const visible = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return orders.filter(
      o => (filter === 'all' || o.status === filter) && (!q || o.customer.toLowerCase().includes(q)),
    );
  }, [orders, keyword, filter]);

  function save(draft: OrderDraft) {
    if (editing === 'new') {
      const order: Order = {
        id: `A-${nextNo}`,
        ...draft,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      setNextNo(nextNo + 1);
      setOrders([order, ...orders]);
      setNotice(`已新增訂單 ${order.id}`);
    } else if (editing) {
      const id = editing.id;
      setOrders(orders.map(o => (o.id === id ? { ...o, ...draft } : o)));
      setNotice(`已更新訂單 ${id}`);
    }
    setEditing(null);
  }

  function remove() {
    if (!deleting) return;
    setOrders(orders.filter(o => o.id !== deleting.id));
    setNotice(`已刪除訂單 ${deleting.id}`);
    setDeleting(null);
  }

  const showTools = state === 'success' || state === 'empty';
  const hasOrders = orders.length > 0;

  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">訂單管理</h1>
        {showTools && (
          <Button onClick={() => setEditing('new')}>新增訂單</Button>
        )}
      </header>

      {notice && showTools && (
        <div className="notice" role="status">
          <StatusMessage tone="success">{notice}</StatusMessage>
        </div>
      )}

      {state === 'loading' && (
        <section data-eval-state="loading" aria-label="訂單列表" className="panel">
          <ContentState state="loading" title="載入中" description="正在讀取訂單資料…" />
        </section>
      )}

      {state === 'error' && (
        <section data-eval-state="error" aria-label="訂單列表" className="panel">
          <ContentState
            state="error"
            title="訂單載入失敗"
            description="目前無法取得訂單資料，請稍後再試。"
            retryLabel="重試"
            onRetry={() => setRetries(retries + 1)}
          />
          {retries > 0 && (
            <div role="status" className="notice">
              <StatusMessage tone="error">第 {retries} 次重試仍然失敗，請稍後再試。</StatusMessage>
            </div>
          )}
        </section>
      )}

      {state === 'empty' && !hasOrders && (
        <section data-eval-state="empty" aria-label="訂單列表" className="panel">
          <ContentState state="empty" title="目前沒有訂單" description="建立第一筆訂單後會顯示在這裡。" />
        </section>
      )}

      {showTools && hasOrders && (
        <section data-eval-state="success" aria-label="訂單列表" className="panel">
          <div className="toolbar">
            <TextField
              label="搜尋客戶"
              type="search"
              value={keyword}
              placeholder="輸入客戶名稱"
              autoComplete="off"
              onChange={event => setKeyword(event.target.value)}
            />
            <Select
              label="狀態篩選"
              value={filter}
              onChange={event => setFilter(event.target.value as Status | 'all')}
            >
              <option value="all">全部狀態</option>
              {STATUSES.map(key => (
                <option key={key} value={key}>{STATUS_LABEL[key]}</option>
              ))}
            </Select>
          </div>

          <p className="count" role="status">共 {visible.length} 筆訂單</p>

          {visible.length === 0 ? (
            <p className="no-match">沒有符合條件的訂單，請調整搜尋或篩選。</p>
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
                {visible.map(order => (
                  <tr key={order.id}>
                    <td data-label="編號">{order.id}</td>
                    <th scope="row" data-label="客戶">{order.customer}</th>
                    <td data-label="金額" className="num">NT$ {money.format(order.amount)}</td>
                    <td data-label="狀態">
                      <span className={`badge badge-${order.status}`}>{STATUS_LABEL[order.status]}</span>
                    </td>
                    <td data-label="建立日期">{order.createdAt}</td>
                    <td data-label="操作">
                      <div className="row-actions">
                        <Button
                          variant="secondary"
                          aria-label={`編輯訂單 ${order.id}（${order.customer}）`}
                          onClick={() => setEditing(order)}
                        >
                          編輯
                        </Button>
                        <Button
                          variant="secondary"
                          aria-label={`刪除訂單 ${order.id}（${order.customer}）`}
                          onClick={() => setDeleting(order)}
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
        </section>
      )}

      {editing && (
        <OrderForm order={editing === 'new' ? null : editing} onSave={save} onCancel={() => setEditing(null)} />
      )}

      {deleting && (
        <Modal title="確認刪除" titleId="delete-title" role="alertdialog" onClose={() => setDeleting(null)}>
          <p>
            確定要刪除訂單 {deleting.id}（{deleting.customer}）嗎？此操作無法復原。
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setDeleting(null)}>取消</Button>
            <Button onClick={remove}>確認刪除</Button>
          </div>
        </Modal>
      )}
    </main>
  );
}
