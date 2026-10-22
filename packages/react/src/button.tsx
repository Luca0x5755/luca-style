import type { ButtonHTMLAttributes } from 'react';
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {variant?:'primary'|'secondary'; loading?:boolean};
export function Button({ className = '', type = 'button', variant='primary', loading=false, disabled, ...props }: ButtonProps) {
  return <button {...props} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={`luca-button luca-button-${variant} ${className}`.trim()} />;
}
