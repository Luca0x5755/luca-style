import type {ReactNode} from 'react';
export type NavigationItem={label:string;href:string};
export function Navigation({items,currentPath,brand='Luca Style /',brandHref='/',label='主要導覽'}:{items:NavigationItem[];currentPath?:string;brand?:string;brandHref?:string;label?:string}) {
  return <nav className="luca-navigation" aria-label={label}><a className="luca-brand" href={brandHref}>{brand}</a><div>{items.map(item=><a key={item.href} href={item.href} aria-current={currentPath===item.href ? 'page' : undefined}>{item.label}</a>)}</div></nav>;
}
export function MetricCard({label,value,detail,eyebrow,highlight=false}:{label:string;value:ReactNode;detail?:ReactNode;eyebrow?:string;highlight?:boolean}) {
  return <article className={`luca-metric${highlight ? ' luca-metric-highlight' : ''}`} aria-label={label}>{eyebrow && <small>{eyebrow}</small>}<h2>{label}</h2><strong>{value}</strong>{detail && <p>{detail}</p>}</article>;
}
export type TableColumn<Row>={key:string;heading:string;render:(row:Row)=>ReactNode};
export function DataTable<Row>({caption,columns,rows,rowKey,children}:{caption:string;columns:TableColumn<Row>[];rows:Row[];rowKey:(row:Row)=>string;children?:ReactNode}) {
  return <div className="luca-table-region" role="region" aria-label={`${caption}，可水平捲動`} tabIndex={0}><table className="luca-table"><caption>{caption}</caption><thead><tr>{columns.map(column=><th key={column.key} scope="col">{column.heading}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={rowKey(row)}>{columns.map(column=><td key={column.key}>{column.render(row)}</td>)}</tr>)}{children && <tr><td colSpan={columns.length}>{children}</td></tr>}</tbody></table></div>;
}
