import {NavigationMenu} from '@base-ui/react/navigation-menu';
import type {ReactNode} from 'react';
export type NavigationItem={label:string;href:string};
// Navigation 以 Base UI 的 NavigationMenu 實作（ADR 0006）；只有連結，沒有子選單，所以只用 Root、List、Item、Link（Link 的 active 會帶 aria-current="page"）；品牌連結不屬於選單項目（Link 必須在 List 內），維持原生 <a>。
export function Navigation({items,currentPath,brand='Luca Style /',brandHref='/',label='主要導覽'}:{items:NavigationItem[];currentPath?:string;brand?:string;brandHref?:string;label?:string}) {
  return <NavigationMenu.Root className="luca-navigation" aria-label={label}><a className="luca-brand" href={brandHref}>{brand}</a><NavigationMenu.List className="luca-navigation-list">{items.map(item=><NavigationMenu.Item key={item.href}><NavigationMenu.Link href={item.href} active={currentPath===item.href}>{item.label}</NavigationMenu.Link></NavigationMenu.Item>)}</NavigationMenu.List></NavigationMenu.Root>;
}
export function MetricCard({label,value,detail,eyebrow,highlight=false}:{label:string;value:ReactNode;detail?:ReactNode;eyebrow?:string;highlight?:boolean}) {
  return <article className={`luca-metric${highlight ? ' luca-metric-highlight' : ''}`} aria-label={label}>{eyebrow && <small>{eyebrow}</small>}<h2>{label}</h2><strong>{value}</strong>{detail && <p>{detail}</p>}</article>;
}
export type TableColumn<Row>={key:string;heading:string;render:(row:Row)=>ReactNode};
export function DataTable<Row>({caption,columns,rows,rowKey,children}:{caption:string;columns:TableColumn<Row>[];rows:Row[];rowKey:(row:Row)=>string;children?:ReactNode}) {
  return <div className="luca-table-region" role="region" aria-label={`${caption}，可水平捲動`} tabIndex={0}><table className="luca-table"><caption>{caption}</caption><thead><tr>{columns.map(column=><th key={column.key} scope="col">{column.heading}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={rowKey(row)}>{columns.map(column=><td key={column.key}>{column.render(row)}</td>)}</tr>)}{children && <tr><td colSpan={columns.length}>{children}</td></tr>}</tbody></table></div>;
}
