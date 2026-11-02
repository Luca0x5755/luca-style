import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import {Button, Checkbox, Select, TextField, ThemeProvider, useTheme} from '@luca-style/react';
import {twMerge} from 'tailwind-merge';
import {roleProbes} from './role-probes';
import './index.css';
import './page.css';

// CheckboxProps 沒有宣告 indeterminate，執行期會傳到 Base UI，所以用展開避開型別檢查。
const indeterminate = {indeterminate:true};
const option = <option value="a">選項</option>;

// 角色探針掛在自己的主題容器，腳本切換 data-suite、data-mode 後讀計算值。
function RoleProbes() {
  return <div id="role-probes" data-luca-theme="" data-suite="vibrant" data-mode="light">{roleProbes.map(({id,className,kind}) =>
    kind==='input' ? <input key={id} data-probe={id} className={className} placeholder="探針"/>
    : kind==='parent' ? <div key={id} data-probe={id} className={className}><i/><i/></div>
    : <div key={id} data-probe={id} className={className}>探針</div>)}</div>;
}

// 每個 id 對應腳本裡一條期望；專案以 tailwind-merge 3.x 合併 class，後者蓋掉衝突的前者。
function PassedClasses() {
  return <ThemeProvider suite="vibrant" persist={false}><main id="passed-classes">
    <Button id="button-merged" className={twMerge('bg-accent','bg-success/40')}>合併</Button>
    <Button id="button-secondary-base" variant="secondary" className="bg-success/40">次要</Button>
    <Button id="button-hover" className="hover:bg-warning/40">滑過</Button>
    <Button id="button-active" className="active:bg-error/40">按下</Button>
    <Button id="button-secondary-hover" variant="secondary" className="hover:text-warning">次要滑過</Button>
    <Button id="button-secondary-active" variant="secondary" className="active:text-error">次要按下</Button>
    <Button id="button-disabled" disabled className="disabled:opacity-100">停用</Button>
    <Button id="button-secondary-disabled" variant="secondary" disabled className="disabled:opacity-100">次要停用</Button>
    <Button id="button-plain-hover" className="bg-success/40">不帶狀態</Button>
    <Button id="button-plain-disabled" disabled className="opacity-100">不帶狀態停用</Button>
    <TextField id="input-plain-invalid" label="不帶狀態錯誤" error="錯誤" className="border-success"/>
    <Button id="button-focus" className="focus-visible:outline-warning">焦點</Button>
    <Button id="button-outline-none" className="outline-none">拿掉外框</Button>
    <Button id="button-outline-hidden" className="outline-hidden">隱藏外框</Button>
    <TextField id="input-base" label="一般" className="bg-success/40"/>
    <TextField id="input-invalid" label="錯誤" error="錯誤" className="aria-[invalid=true]:border-warning"/>
    <TextField id="input-disabled" label="停用" disabled className="disabled:opacity-100"/>
    <TextField id="input-focus" label="焦點" className="focus-visible:outline-warning"/>
    <TextField id="input-outline-none" label="拿掉外框" className="outline-none"/>
    <TextField id="input-outline-hidden" label="隱藏外框" className="outline-hidden"/>
    <Select id="select-base" label="選單一般" className="bg-success/40">{option}</Select>
    <Select id="select-invalid" label="選單錯誤" error="錯誤" className="aria-[invalid=true]:border-warning">{option}</Select>
    <Select id="select-disabled" label="選單停用" disabled className="disabled:opacity-100">{option}</Select>
    <Select id="select-focus" label="選單焦點" className="focus-visible:outline-warning">{option}</Select>
    <Select id="select-outline-none" label="選單拿掉外框" className="outline-none">{option}</Select>
    <Select id="select-outline-hidden" label="選單隱藏外框" className="outline-hidden">{option}</Select>
    <Checkbox id="checkbox-base" label="方框一般" className="bg-success/40"/>
    <Checkbox id="checkbox-checked" label="方框勾選" defaultChecked className="data-[checked]:bg-warning/40"/>
    <Checkbox id="checkbox-plain-checked" label="方框不帶狀態" defaultChecked className="bg-success/40"/>
    <Checkbox id="checkbox-indeterminate" label="方框不確定" {...indeterminate} className="data-[indeterminate]:bg-error/40"/>
    <Checkbox id="checkbox-invalid" label="方框錯誤" error="錯誤" className="aria-[invalid=true]:border-warning"/>
    <Checkbox id="checkbox-disabled" label="方框停用" disabled className="data-[disabled]:opacity-100"/>
    <Checkbox id="checkbox-focus" label="方框焦點" className="focus-visible:outline-warning"/>
    <Checkbox id="checkbox-outline-none" label="方框拿掉外框" className="outline-none"/>
    <Checkbox id="checkbox-outline-hidden" label="方框隱藏外框" className="outline-hidden"/>
  </main></ThemeProvider>;
}

// 專案強調色在執行期才寫進變數，設定檔的顏色要跟著改。
function AccentOverride() {
  return <ThemeProvider suite="vibrant" persist={false} accent={{light:'#9A4C32'}}><div id="accent-override" className="bg-accent/40">探針</div></ThemeProvider>;
}

// 執行期切換：腳本按鈕改專案強調色、切到暗黑，每一步後讀計算值。值照抄腳本的期望，兩邊都要改。
const runtimeAccent = {light:'#9A4C32', dark:'#D9876B'};
function RuntimeControls({onAccent}:{onAccent:()=>void}) {
  const {setMode} = useTheme();
  return <>
    <button type="button" id="runtime-set-accent" onClick={onAccent}>改強調色</button>
    <button type="button" id="runtime-set-dark" onClick={()=>setMode('dark')}>切到暗黑</button>
    {['bg-accent','bg-accent/40','bg-surface','bg-surface/40'].map(className => <div key={className} data-runtime={className} className={className}>探針</div>)}
  </>;
}
function RuntimeSwitch() {
  const [accent, setAccent] = useState<typeof runtimeAccent|undefined>();
  return <ThemeProvider suite="vibrant" persist={false} accent={accent}><div id="runtime-switch"><RuntimeControls onAccent={()=>setAccent(runtimeAccent)}/></div></ThemeProvider>;
}

createRoot(document.getElementById('root')!).render(<><PassedClasses/><AccentOverride/><RuntimeSwitch/><RoleProbes/></>);
