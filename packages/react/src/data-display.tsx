import {NavigationMenu} from '@base-ui/react/navigation-menu';
import {useRender} from '@base-ui/react/use-render';
import type {AnchorHTMLAttributes, ReactElement, ReactNode, Ref} from 'react';
export type NavigationItem={label:string;href:string};
// renderLink 收到的屬性（PR-STYLE-57）：<a> 的屬性加 ref，href 一定有值。專案把它們展開到自己的連結元件上。
export type NavigationLinkProps=AnchorHTMLAttributes<HTMLAnchorElement>&{href:string;ref?:Ref<HTMLAnchorElement>};
export type NavigationProps={items:NavigationItem[];currentPath?:string;brand?:string;brandHref?:string;label?:string;renderLink?:(props:NavigationLinkProps)=>ReactElement};
// Navigation 以 Base UI 的 NavigationMenu 實作（ADR 0006）；只有連結，沒有子選單，所以只用 Root、List、Item、Link（Link 的 active 會帶 aria-current="page"）。
// 品牌連結不屬於選單項目（Link 必須在 List 內），改用 Base UI 的 useRender 渲染，才能同樣交給 renderLink。
// renderLink 只收函式：元素寫法的 props 會蓋過內部的 href，所有項目會連到同一頁。
export function Navigation({items,currentPath,brand='Luca Style /',brandHref='/',label='主要導覽',renderLink}:NavigationProps) {
  const render=renderLink && ((props:object)=>renderLink(props as NavigationLinkProps));
  const brandLink=useRender({render,defaultTagName:'a',props:{className:'luca-brand',href:brandHref,children:brand}});
  return <NavigationMenu.Root className="luca-navigation" aria-label={label}>{brandLink}<NavigationMenu.List className="luca-navigation-list">{items.map(item=><NavigationMenu.Item key={item.href}><NavigationMenu.Link className="luca-navigation-link" href={item.href} active={currentPath===item.href} render={render}>{item.label}</NavigationMenu.Link></NavigationMenu.Item>)}</NavigationMenu.List></NavigationMenu.Root>;
}
export function MetricCard({label,value,detail,eyebrow,highlight=false}:{label:string;value:ReactNode;detail?:ReactNode;eyebrow?:string;highlight?:boolean}) {
  return <article className={`luca-metric${highlight ? ' luca-metric-highlight' : ''}`} aria-label={label}>{eyebrow && <small>{eyebrow}</small>}<h2>{label}</h2><strong>{value}</strong>{detail && <p>{detail}</p>}</article>;
}
export type TableColumn<Row>={key:string;heading:string;render:(row:Row)=>ReactNode};
export function DataTable<Row>({caption,columns,rows,rowKey,children}:{caption:string;columns:TableColumn<Row>[];rows:Row[];rowKey:(row:Row)=>string;children?:ReactNode}) {
  return <div className="luca-table-region" role="region" aria-label={`${caption}，可水平捲動`} tabIndex={0}><table className="luca-table"><caption>{caption}</caption><thead><tr>{columns.map(column=><th key={column.key} scope="col">{column.heading}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={rowKey(row)}>{columns.map(column=><td key={column.key}>{column.render(row)}</td>)}</tr>)}{children && <tr><td colSpan={columns.length}>{children}</td></tr>}</tbody></table></div>;
}
