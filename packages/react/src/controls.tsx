import {Button} from './button.js';
import {useId, type InputHTMLAttributes, type SelectHTMLAttributes, type ReactNode} from 'react';

type FieldDetails = {label:string; error?:string; helper?:string};
export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & FieldDetails;
export function TextField({label,error,helper,id:providedId,className='',...props}:TextFieldProps) {
  const generatedId=useId();
  const id=providedId ?? generatedId;
  const description=error ?? helper;
  const describedBy=[props['aria-describedby'],description ? `${id}-description` : undefined].filter(Boolean).join(' ') || undefined;
  return <div className="luca-field"><label htmlFor={id}>{label}</label><input {...props} className={`luca-input ${className}`.trim()} id={id} aria-invalid={error ? true : props['aria-invalid']} aria-describedby={describedBy}/>{description && <span id={`${id}-description`} className={error ? 'luca-field-error' : 'luca-field-helper'}>{description}</span>}</div>;
}
export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & FieldDetails;
export function Select({label,error,helper,id:providedId,className='',children,...props}:SelectProps) {
  const generatedId=useId();
  const id=providedId ?? generatedId;
  const description=error ?? helper;
  const describedBy=[props['aria-describedby'],description ? `${id}-description` : undefined].filter(Boolean).join(' ') || undefined;
  return <div className="luca-field"><label htmlFor={id}>{label}</label><select {...props} className={`luca-input ${className}`.trim()} id={id} aria-invalid={error ? true : props['aria-invalid']} aria-describedby={describedBy}>{children}</select>{description && <span id={`${id}-description`} className={error ? 'luca-field-error' : 'luca-field-helper'}>{description}</span>}</div>;
}
export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>,'type'> & FieldDetails;
export function Checkbox({label,error,helper,id:providedId,className='',...props}:CheckboxProps) {
  const generatedId=useId();
  const id=providedId ?? generatedId;
  const description=error ?? helper;
  const describedBy=[props['aria-describedby'],description ? `${id}-description` : undefined].filter(Boolean).join(' ') || undefined;
  return <div className="luca-field"><label className="luca-checkbox" htmlFor={id}><input {...props} type="checkbox" id={id} className={className} aria-invalid={error ? true : props['aria-invalid']} aria-describedby={describedBy}/>{label}</label>{description && <span id={`${id}-description`} className={error ? 'luca-field-error' : 'luca-field-helper'}>{description}</span>}</div>;
}
export type StatusTone = 'success' | 'warning' | 'error';
const statusLabels={success:'成功',warning:'警告',error:'錯誤'};
export function StatusMessage({tone,children}: {tone:StatusTone;children:ReactNode}) {
  return <div className={`luca-status luca-status-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{statusLabels[tone]} · {children}</div>;
}
export type ContentStateProps = {state:'loading'|'empty'|'error'; title?:string; description?:string; onRetry?:()=>void};
export function ContentState({state,title,description,onRetry}:ContentStateProps) {
  const titles={loading:'內容載入中',empty:'目前沒有可顯示的內容',error:'內容載入失敗'};
  return <div className="luca-content-state" role={state === 'error' ? 'alert' : 'status'} aria-busy={state === 'loading'}>{state === 'loading' && <span className="luca-loading-animation" aria-hidden="true"/>}<h3>{title ?? titles[state]}</h3><p>{description ?? (state === 'loading' ? '正在準備內容，請稍候。' : state === 'empty' ? '內容準備好後會顯示於此。' : '請重試以重新顯示內容。')}</p>{state === 'error' && onRetry && <Button variant="secondary" onClick={onRetry}>重試</Button>}</div>;
}
