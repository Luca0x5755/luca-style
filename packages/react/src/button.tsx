import {Button as BaseButton} from '@base-ui/react/button';
import {useRender} from '@base-ui/react/use-render';
import type {AnchorHTMLAttributes, ButtonHTMLAttributes, ReactElement, Ref} from 'react';
type ButtonVariant = 'primary'|'secondary';
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {variant?:ButtonVariant; loading?:boolean};
// 連結寫法交給 render 的元素收到的屬性：<a> 的屬性加 ref。
export type ButtonLinkRenderProps = AnchorHTMLAttributes<HTMLAnchorElement> & {ref?:Ref<HTMLAnchorElement>};
// 渲染成連結（PR-STYLE-58）：render 傳 <a> 或專案的連結元件。連結沒有停用、載入與按鈕 type，所以型別上不接受。
export type ButtonLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'type'> & {
  variant?:ButtonVariant;
  render:ReactElement | ((props:ButtonLinkRenderProps) => ReactElement);
  disabled?:never; loading?:never; type?:never;
};
const classNameOf = (variant:ButtonVariant, className:string) => `luca-button luca-button-${variant} ${className}`.trim();
// 連結不經過 Base UI Button：Base UI 文件說 <a> 不該放進 Button 的 render，它會加上按鈕的 type 與鍵盤行為。改用 Base UI 的 useRender 渲染，保留連結語意。
function LinkButton({className = '', variant = 'primary', render, ...props}:ButtonLinkProps) {
  return useRender({render:render as useRender.RenderProp, defaultTagName:'a', props:{...props, className:classNameOf(variant, className)}});
}
// ButtonProps 的多載放最後：ComponentProps<typeof Button> 只取最後一個多載，既有寫法拿到的仍是 ButtonProps。
export function Button(props:ButtonLinkProps):ReactElement;
export function Button(props:ButtonProps):ReactElement;
export function Button(props:ButtonProps | ButtonLinkProps) {
  if ('render' in props && props.render) return <LinkButton {...props as ButtonLinkProps}/>;
  const {className = '', type = 'button', variant = 'primary', loading = false, disabled, ...rest} = props as ButtonProps;
  // 以 Base UI 的 Button 處理互動；仍是原生 <button>，停用時不可聚焦（與 0.1.0 相同，不開 focusableWhenDisabled）。
  return <BaseButton {...rest} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={classNameOf(variant, className)}/>;
}
