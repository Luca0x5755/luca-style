// 模擬專案路由器的連結元件：以 forwardRef 接 ref（React 18 的 ref 不是一般 prop），點擊時改用 pushState，不整頁重載。
import {forwardRef, type AnchorHTMLAttributes} from 'react';

export const RouterLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(function RouterLink({onClick, ...props}, ref) {
  return <a ref={ref} {...props} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    event.preventDefault();
    history.pushState(null, '', props.href);
    dispatchEvent(new PopStateEvent('popstate'));
  }}/>;
});
