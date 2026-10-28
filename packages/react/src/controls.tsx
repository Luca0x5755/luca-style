import {Select as BaseSelect} from '@base-ui/react/select';
import {Checkbox as BaseCheckbox} from '@base-ui/react/checkbox';
import {Input as BaseInput} from '@base-ui/react/input';
import {Button} from './button.js';
import {usePortalContainer} from './theme.js';
import {Children, Fragment, isValidElement, useId, type ChangeEvent, type HTMLAttributes, type InputHTMLAttributes, type OptionHTMLAttributes, type SelectHTMLAttributes, type ReactNode} from 'react';

type FieldDetails = {label:string; error?:string; helper?:string};
export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & FieldDetails;
export function TextField({label,error,helper,id:providedId,className='',...props}:TextFieldProps) {
  const generatedId=useId();
  const id=providedId ?? generatedId;
  const description=error ?? helper;
  const describedBy=[props['aria-describedby'],description ? `${id}-description` : undefined].filter(Boolean).join(' ') || undefined;
  return <div className="luca-field"><label htmlFor={id}>{label}</label><BaseInput {...props} className={`luca-input ${className}`.trim()} id={id} aria-invalid={error ? true : props['aria-invalid']} aria-describedby={describedBy}/>{description && <span id={`${id}-description`} className={error ? 'luca-field-error' : 'luca-field-helper'}>{description}</span>}</div>;
}
// Select 以 Base UI 的 Select 實作（ADR 0006），公開 props 沿用 0.1.0 原生 select 的寫法：
// 選項仍以 <option> 子元素描述，onChange 仍收到 event.target.value。多選與列高沒有對應的自訂選單行為，故移除（升級說明有列）。
type SelectValue = string | number;
export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'multiple' | 'size' | 'value' | 'defaultValue' | 'onChange'> & FieldDetails & {
  value?:SelectValue;
  defaultValue?:SelectValue;
  // 只帶 target／currentTarget 的 value、name 與 id，不是瀏覽器原生的 change 事件。
  onChange?:(event:ChangeEvent<HTMLSelectElement>) => void;
};
type SelectOption = {value:string; label:string; disabled:boolean};
// 文字內容攤平成字串；<option> 沒有 value 時與原生相同，以文字當值。
const textOf = (node:ReactNode):string => Children.toArray(node).map(child => typeof child === 'string' || typeof child === 'number' ? String(child) : isValidElement<{children?:ReactNode}>(child) ? textOf(child.props.children) : '').join('');
// Fragment 內的 <option> 也讀（Children.toArray 不會攤平 Fragment）；<optgroup> 與其他元素略過（升級說明有列）。
function readOptions(children:ReactNode):SelectOption[] {
  return Children.toArray(children).flatMap((child):SelectOption[] => {
    if (isValidElement<{children?:ReactNode}>(child) && child.type === Fragment) return readOptions(child.props.children);
    if (!isValidElement<OptionHTMLAttributes<HTMLOptionElement>>(child) || child.type !== 'option') return [];
    const label = child.props.label ?? textOf(child.props.children);
    return [{value:child.props.value === undefined ? label : String(child.props.value), label, disabled:Boolean(child.props.disabled)}];
  });
}
export function Select({label,error,helper,id:providedId,className='',children,value,defaultValue,onChange,name,disabled,required,form,autoComplete,...props}:SelectProps) {
  const generatedId=useId();
  const id=providedId ?? generatedId;
  const description=error ?? helper;
  const describedBy=[props['aria-describedby'],description ? `${id}-description` : undefined].filter(Boolean).join(' ') || undefined;
  const container=usePortalContainer();
  const options=readOptions(children);
  // 原生 select 未給值時選第一個可選項，這裡照做，欄位才不會空白。
  const initial=defaultValue === undefined ? options.find(option => !option.disabled)?.value ?? null : String(defaultValue);
  const change=(next:string|null) => {
    const target={value:next ?? '', name:name ?? '', id};
    onChange?.({target, currentTarget:target, type:'change'} as unknown as ChangeEvent<HTMLSelectElement>);
  };
  return <div className="luca-field"><label htmlFor={id}>{label}</label>
    <BaseSelect.Root id={id} items={options} value={value === undefined ? undefined : String(value)} defaultValue={value === undefined ? initial : undefined} onValueChange={change} name={name} disabled={disabled} required={required} form={form} autoComplete={autoComplete}>
      {/* 其餘屬性（aria-*、data-*、焦點事件等）交給欄位按鈕；事件的 currentTarget 因此是 button。 */}
      <BaseSelect.Trigger {...props as HTMLAttributes<HTMLButtonElement>} id={id} className={`luca-input luca-select-trigger ${className}`.trim()} aria-invalid={error ? true : props['aria-invalid']} aria-describedby={describedBy}>
        <BaseSelect.Value className="luca-select-value"/>
        <BaseSelect.Icon className="luca-select-icon"><svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><path d="M4.5 6.75 9 11.25l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal container={container ?? undefined}>
        {/* 選單與欄位同寬、貼齊欄位下緣 4px（§5.5.2）；不採 Base UI 預設的「選中項對齊欄位」位置。 */}
        <BaseSelect.Positioner className="luca-select-positioner" side="bottom" align="start" sideOffset={4} alignItemWithTrigger={false}>
          <BaseSelect.Popup className="luca-select-popup">
            {options.map((option,index) => <BaseSelect.Item key={index} value={option.value} label={option.label} disabled={option.disabled} className="luca-select-option">
              <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>{option.disabled && '（不可選）'}
            </BaseSelect.Item>)}
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
    {description && <span id={`${id}-description`} className={error ? 'luca-field-error' : 'luca-field-helper'}>{description}</span>}</div>;
}
// Checkbox 以 Base UI 的 Checkbox 實作（ADR 0006）：可見的方框是 role="checkbox" 的節點，旁邊另有隱藏的 <input> 負責表單送出。
// 公開 props 沿用 0.1.0 原生 input 的寫法，onChange 仍收到 event.target.checked；與原生事件的差異見升級說明。
export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>,'type'> & FieldDetails;
export function Checkbox({label,error,helper,id:providedId,className='',checked,defaultChecked,disabled,required,readOnly,name,form,value,onChange,...props}:CheckboxProps) {
  const generatedId=useId();
  const id=providedId ?? generatedId;
  const description=error ?? helper;
  const describedBy=[props['aria-describedby'],description ? `${id}-description` : undefined].filter(Boolean).join(' ') || undefined;
  const change=(next:boolean) => {
    const target={checked:next, value:value === undefined ? 'on' : String(value), name:name ?? '', id};
    onChange?.({target, currentTarget:target, type:'change'} as unknown as ChangeEvent<HTMLInputElement>);
  };
  return <div className="luca-field"><label className="luca-checkbox" htmlFor={id}>
    {/* 其餘屬性（aria-*、data-*、焦點事件等）交給方框節點；事件的 currentTarget 因此是該節點而不是 input。 */}
    <BaseCheckbox.Root {...props as HTMLAttributes<HTMLSpanElement>} id={id} className={`luca-checkbox-box ${className}`.trim()} checked={checked} defaultChecked={defaultChecked} disabled={disabled} required={required} readOnly={readOnly} name={name} form={form} value={value === undefined ? undefined : String(value)} onCheckedChange={change} aria-invalid={error ? true : props['aria-invalid']} aria-describedby={describedBy}>
      <BaseCheckbox.Indicator className="luca-checkbox-indicator"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></BaseCheckbox.Indicator>
    </BaseCheckbox.Root>{label}</label>{description && <span id={`${id}-description`} className={error ? 'luca-field-error' : 'luca-field-helper'}>{description}</span>}</div>;
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
