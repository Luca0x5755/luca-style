import { useState, type FormEvent } from 'react';
import { Button, Select, TextField } from '@luca-style/react';
import { STATUSES, STATUS_LABEL, type Order, type Status } from './data';
import { Modal } from './Modal';

export type OrderDraft = { customer: string; amount: number; status: Status };

type Props = {
  order: Order | null;
  onSave: (draft: OrderDraft) => void;
  onCancel: () => void;
};

export function OrderForm({ order, onSave, onCancel }: Props) {
  const [customer, setCustomer] = useState(order?.customer ?? '');
  const [amount, setAmount] = useState(order ? String(order.amount) : '');
  const [status, setStatus] = useState<Status>(order?.status ?? 'pending');
  const [errors, setErrors] = useState<{ customer?: string; amount?: string }>({});

  function submit(event: FormEvent) {
    event.preventDefault();
    const next: { customer?: string; amount?: string } = {};
    const name = customer.trim();
    const value = Number(amount);
    if (!name) next.customer = '請輸入客戶名稱';
    if (amount.trim() === '' || !Number.isFinite(value)) next.amount = '請輸入有效的金額';
    else if (value <= 0) next.amount = '金額必須大於 0';
    setErrors(next);
    if (next.customer || next.amount) return;
    onSave({ customer: name, amount: value, status });
  }

  return (
    <Modal title={order ? `編輯訂單 ${order.id}` : '新增訂單'} titleId="order-form-title" onClose={onCancel}>
      <form onSubmit={submit} noValidate className="form">
        <TextField
          label="客戶"
          required
          value={customer}
          error={errors.customer}
          aria-invalid={errors.customer ? true : undefined}
          onChange={event => setCustomer(event.target.value)}
          autoComplete="off"
        />
        <TextField
          label="金額（NT$）"
          required
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={amount}
          error={errors.amount}
          aria-invalid={errors.amount ? true : undefined}
          onChange={event => setAmount(event.target.value)}
        />
        <Select label="狀態" value={status} onChange={event => setStatus(event.target.value as Status)}>
          {STATUSES.map(key => (
            <option key={key} value={key}>{STATUS_LABEL[key]}</option>
          ))}
        </Select>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onCancel}>取消</Button>
          <Button type="submit">儲存</Button>
        </div>
      </form>
    </Modal>
  );
}
