# 切出兩個套系設計檔並能用 MCP 編輯

## Done when

- `docs/mockup/components-vibrant.fig` 與 `docs/mockup/components-professional.fig` 存在，兩者節點數都低於 10,000。
- 以 OpenPencil MCP 對兩個檔案各做一次 `set_fill`，都能成功並自動儲存，再還原；不需手動存檔。
- 切檔腳本 `scripts/design/split-by-suite.js` 已進版控，能從 `docs/mockup/components.fig` 重跑出兩個檔案。腳本內註解使用繁體中文。
- 兩檔都含該套系全部頁面 frame 與元件檢視板，以及 22 個母版、`Library guide`、`00 / Canvas directory` 與兩個文字節點的各一份。
- 兩檔都不含 `Internal Only Canvas` 頁。

## Context

規格見 [ISSUE-001](ISSUE-001-split-design-source-by-suite.md)，決策見 [ADR 0003](../adr/0003-split-design-source-by-style-suite-in-fig.md)。對應 PR-FILE-01、PR-FILE-02。這是追蹤子彈：先讓兩個檔案存在且可編輯，驗收與文件留給後續票。

## Blocked by

nothing

## Notes

- 用離線 `openpencil eval <檔> --stdin -o <輸出>`，在 `D:\luca-style` 的子目錄執行。不要在 OpenPencil App 內大量刪除節點，那會讓 WebAssembly 渲染器損壞並使 App 當機。
- 以 `figma.currentPage.children` 的名稱過濾：精緻專業的名稱形如 `<頁>/Professional/...`、`Professional/...`、`Professional ?/...`，精緻活力同理。已驗證做法：從原檔刪掉專業的 151 個頂層節點，得到活力檔 5,823 個節點。試做檔在 `test-results/probe/`（已被 gitignore，可參考腳本 `cut-pro.js`）。
- 刪除 `Internal Only Canvas` 頁前，先記下它的內容；若不是空白，在結案說明中告訴使用者。
- Windows 上 `openpencil` 需要兩處本機修補，位於全域 npm 目錄 `@open-pencil/cli/node_modules/@open-pencil/core/dist/` 的 `io/formats/raster/headless.js` 與 `canvaskit.js`：以 `fileURLToPath` 取代直接使用 `URL.pathname`，否則出現 `ENOENT D:\C:\Users\...\canvaskit.wasm`。重新安裝套件會還原修補。把這個狀況寫在腳本檔頭註解。
- `OPENPENCIL_MCP_ROOT` 目前是 `D:\luca-style`，檔案放在其下才能被 MCP 開啟。開大檔時 `open_file` 可能 RPC 逾時但稍後仍會載入；用 `list_documents` 確認。
- 不要對綁定 `components.fig` 的分頁呼叫無 `path` 的 `save_file`。
