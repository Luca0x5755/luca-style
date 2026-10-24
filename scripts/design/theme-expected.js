// 主題保真驗收共用：由 docs/mockup/themes/ 的 JSON 組出「某個套系設計檔應有的解析值」。
//   resolved.json  頁面 frame 在自己主題下解析後的值（驗收基準）；母版與兩個共用項目以 Vibrant／Light／Desktop 解析。
//   bindings.json  每個節點的每個屬性綁了哪個變數（與 resolved.json 同序同索引）。
//   variables.json 變數在 mode／suite／device 12 個組合下的值。
// Professional 檔的母版與共用項目（名稱不含套系字樣）以本套系的值為期望：用 bindings.json 的變數名稱
//   加 variables.json 的 Professional 值推導，而不是直接沿用 resolved.json 的 Vibrant 預設值。
// 推導邏輯的自洽檢查：對 resolved.json 自己所屬套系的條目，推導值必須與 resolved.json 逐筆相同；
//   不同就回報（代表 variables.json 與 resolved.json 不一致），避免推導本身默默出錯。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const readJson = (dir, name) => JSON.parse(readFileSync(join(dir, name), 'utf8'));

// 名稱的各段裡有沒有明寫套系；沒有就是無套系項目（母版、Library guide、Canvas directory）。
const suiteInName = (name, suites) => {
  const parts = name.split('/').map((p) => p.trim());
  return suites.find((s) => parts.includes(s)) || null;
};

// 回傳 { entries, errors }。entry = { frame, master, modes: {mode, device}, nodes: [{ path, values }] }。
// values 的鍵為 resolved.json 的屬性名（fill、stroke、fontFamily、fontSize、gap、padding、cornerRadius、
//   strokeWidth、strokeWidth.left、effect.enabled、fill[i].opacity）。
export const loadExpected = (dir, suite) => {
  const resolved = readJson(dir, 'resolved.json');
  const bindings = readJson(dir, 'bindings.json');
  const variables = readJson(dir, 'variables.json');
  const suites = variables.axes.suite;
  const byName = new Map(variables.variables.map((v) => [v.name, v]));
  const errors = [];
  const entries = [];
  for (const kind of ['masters', 'frames']) {
    resolved[kind].forEach((r, gi) => {
      const b = bindings[kind][gi];
      if (b.frame !== r.frame) {
        errors.push(`[基準] ${kind}[${gi}] 名稱不一致：resolved.json「${r.frame}」，bindings.json「${b.frame}」`);
        return;
      }
      const own = suiteInName(r.frame, suites);
      // 明寫其他套系的 frame 不屬於這個檔案。
      if (kind === 'frames' && own && own !== suite) return;
      const { mode, device } = r.theme;
      const key = `${mode}/${suite}/${device}`;
      const nodes = r.nodes.map((n, ni) => {
        const bn = b.nodes[ni];
        if (bn.path !== n.path) errors.push(`[基準] ${r.frame}：第 ${ni} 個節點路徑不一致`);
        // 自己的套系與 resolved.json 的套系相同：直接用 resolved.json。
        if (r.theme.suite === suite) return { path: n.path, values: n.values };
        // 否則用變數名稱加 Professional 的值推導，並對 Vibrant 做自洽檢查（見檔頭）。
        const values = {};
        for (const [prop, name] of Object.entries(bn.bind)) {
          const v = byName.get(name);
          const value = v && v.values[key];
          if (value === undefined) errors.push(`[基準] ${r.frame} ${n.path} ${prop}：變數 ${name} 沒有 ${key} 的值`);
          values[prop] = value;
          const own0 = v && v.values[`${mode}/${r.theme.suite}/${device}`];
          if (own0 !== n.values[prop]) errors.push(`[基準] ${r.frame} ${n.path} ${prop}：variables.json 為 ${own0}，resolved.json 為 ${n.values[prop]}`);
        }
        return { path: n.path, values };
      });
      entries.push({ frame: r.frame, master: kind === 'masters', modes: { mode, device }, nodes });
    });
  }
  return { entries, errors };
};
