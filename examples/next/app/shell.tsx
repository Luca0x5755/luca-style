'use client';
// renderLink 是函式，只能在 client 元件裡傳，所以頁面內容放在 'use client' 檔。頁面放全部公開元件，hydration 檢查才涵蓋每一個。
import Link from 'next/link';
import {Button, Checkbox, ContentState, DataTable, MetricCard, Navigation, Select, StatusMessage, TextField} from '@luca-style/react';

const items = [{label: '首頁', href: '/'}, {label: '其他頁', href: '/other'}];
const rows = [{name: '甲', amount: '1,200'}, {name: '乙', amount: '860'}];

export function Shell({path}: {path: string}) {
  return <>
    <Navigation items={items} currentPath={path} renderLink={props => <Link {...props}/>}/>
    <main>
      <h1>{path === '/' ? '首頁' : '其他頁'}</h1>
      <Button render={<Link href={path === '/' ? '/other' : '/'}/>}>切換頁面</Button>
      <Button variant="secondary">一般按鈕</Button>
      <TextField label="名稱" helper="說明文字"/>
      <Select label="水果" defaultValue="apple"><option value="apple">蘋果</option><option value="pear">梨子</option></Select>
      <Checkbox label="同意條款"/>
      <Checkbox label="隱藏標籤的勾選" hideLabel/>
      <StatusMessage tone="success">已儲存</StatusMessage>
      <ContentState state="error" onRetry={() => {}}/>
      <MetricCard label="營收" value="1,200"/>
      <DataTable caption="訂單" columns={[{key: 'name', heading: '名稱', render: row => row.name}, {key: 'amount', heading: '金額', render: row => row.amount}]} rows={rows} rowKey={row => row.name}/>
    </main>
  </>;
}
