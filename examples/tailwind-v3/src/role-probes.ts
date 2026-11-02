// 乾淨專案腳本會依 packages/tokens/src 的色彩角色覆寫這個檔案；class 要逐字寫在檔案裡，Tailwind 才掃得到。
export type RoleProbe = {id:string; className:string; kind:'plain'|'input'|'parent'};
export const roleProbes: RoleProbe[] = [];
