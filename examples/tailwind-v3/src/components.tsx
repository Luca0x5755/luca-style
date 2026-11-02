import {Button, Checkbox, ContentState, DataTable, MetricCard, Navigation, Select, StatusMessage, TextField, ThemeProvider} from '@luca-style/react';

// 公開元件與狀態各渲染一次；基準頁與 Tailwind 頁共用，逐元素比對計算樣式。
// CheckboxProps 沒有宣告 indeterminate，執行期會傳到 Base UI，所以用展開避開型別檢查。
const indeterminate = {indeterminate:true};
const rows = [{id:'a',name:'第一列',value:'123'},{id:'b',name:'第二列',value:'456'}];
const columns = [{key:'name',heading:'名稱',render:(row:typeof rows[number])=>row.name},{key:'value',heading:'數值',render:(row:typeof rows[number])=>row.value}];

export function LucaComponents() {
  return <ThemeProvider suite="vibrant" persist={false}>
    <Navigation label="主要導覽" currentPath="/" items={[{label:'首頁',href:'/'},{label:'其他',href:'/other'}]}/>
    <main id="luca-components">
      <Button id="hover-primary">主要操作</Button>
      <Button id="hover-secondary" variant="secondary">次要操作</Button>
      <Button disabled>停用</Button>
      <Button loading>載入中</Button>
      <TextField label="欄位" helper="說明文字" defaultValue="內容"/>
      <TextField label="錯誤欄位" error="錯誤訊息" defaultValue="內容"/>
      <TextField label="停用欄位" disabled defaultValue="內容"/>
      <Select id="open-select" label="選單" helper="說明文字" defaultValue="a"><option value="a">選項一</option><option value="b">選項二</option></Select>
      <Select label="錯誤選單" error="錯誤訊息" defaultValue="a"><option value="a">選項一</option></Select>
      <Select label="停用選單" disabled defaultValue="a"><option value="a">選項一</option></Select>
      <Checkbox label="未勾選"/>
      <Checkbox label="已勾選" defaultChecked/>
      <Checkbox label="不確定" {...indeterminate}/>
      <Checkbox label="錯誤" error="錯誤訊息"/>
      <Checkbox label="停用" disabled/>
      <StatusMessage tone="success">已完成</StatusMessage>
      <StatusMessage tone="warning">請注意</StatusMessage>
      <StatusMessage tone="error">發生錯誤</StatusMessage>
      <ContentState state="loading"/>
      <ContentState state="empty"/>
      <ContentState state="error" onRetry={()=>{}}/>
      <MetricCard label="指標" value="123" eyebrow="分類" detail="細節"/>
      <MetricCard label="重點指標" value="456" detail="細節" highlight/>
      <DataTable caption="表格" columns={columns} rows={rows} rowKey={row=>row.id}/>
    </main>
  </ThemeProvider>;
}
