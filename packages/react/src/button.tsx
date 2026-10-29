import {Button as BaseButton} from '@base-ui/react/button';
import type {ButtonHTMLAttributes} from 'react';
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {variant?:'primary'|'secondary'; loading?:boolean};
// 以 Base UI 的 Button 處理互動；仍是原生 <button>，停用時不可聚焦（與 0.1.0 相同，不開 focusableWhenDisabled）。
export function Button({ className = '', type = 'button', variant='primary', loading=false, disabled, ...props }: ButtonProps) {
  return <BaseButton {...props} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={`luca-button luca-button-${variant} ${className}`.trim()} />;
}
