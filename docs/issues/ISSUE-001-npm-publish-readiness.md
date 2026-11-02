# 完成 P0 驗證，並讓 Luca Style 可以發佈到 npm

## Why

Luca Style 想成為多數前端專案的起點，但現在只能手動打包 tarball，元件也封閉到專案常要自己重做。接入的成本已經擋住真實專案。發佈前要先修好已知問題、打開元件限制，並驗證選的路線沒有錯。

## Scope

- 完成 P0 ②（評測）和 ③（React 18、Next SSR）。
- 修操作元件高度，打開公開 API。
- 提供 Tailwind v3、v4 的接法和可照抄的接入文件。
- 準備好發佈流程，做到只差擁有者確認。

只有首次發佈要等評測結果，其他工作不用等。

## Promises

### 元件

- `PR-STYLE-55` — 文字單行時，Button、Select、TextField 的實際高度等於 `control-height`，涵蓋兩種風格套系、三種資訊密度、兩種元件外形。
- `PR-STYLE-56` — 文字換行時，上述元件會長高，內容不被裁切。
- `PR-STYLE-57` — `Navigation` 可以用專案提供的連結元件，點擊不整頁重載，目前頁面仍有 `aria-current`。
- `PR-STYLE-58` — `Button` 可以透過公開型別渲染成連結，外觀不變，鍵盤可操作。
- `PR-STYLE-59` — `StatusMessage` 和 `ContentState` 寫死的文字可以替換，沒提供時維持現有文字。
- `PR-STYLE-60` — `Checkbox` 可以隱藏標籤，輔助科技仍讀得到名稱。

### 評測

- `PR-EVAL-01` — 用同一個任務比較複製原始碼和 npm 套件，每組至少 3 次，記錄寫死顏色數、axe 違規、水平溢出、四種狀態缺漏、費用和時間。任務使用後台與 CRUD 場景；npm 組在發佈前安裝本機打包檔。
- `PR-EVAL-02` — 評測包含一題：把元件更新到新版，並記錄本地改動是否保留。
- `PR-EVAL-03` — 報告依 ADR 0010 和下方〈Decisions〉的門檻，寫明複製組是否較好。較好時停止首次發佈，並重新討論 ADR 0010。
- `PR-EVAL-04` — 基準評測比較「無工具」和「裝 Luca Style 並附文件」，涵蓋後台與 CRUD、資料儀表板與監控、行銷與定價頁。題目和結果留在 repo，供 P2 用同一批題目比較。

### 接入

- `PR-ADOPT-01` — Next 乾淨專案可以建置，首屏沒有 hydration 錯誤，也不會閃一下日間模式。
- `PR-ADOPT-02` — React 18 不改程式碼就通過時放寬 peer，否則維持 `^19`，並寫進文件。
- `PR-ADOPT-03` — Tailwind v3 乾淨專案不寫色彩對應，就能用所有 Luca 角色的 class，包括 `border-success/40` 這類透明度寫法。
- `PR-ADOPT-04` — Tailwind v4 乾淨專案也能做到 `PR-ADOPT-03` 的事。
- `PR-ADOPT-05` — 兩個 Tailwind 版本依文件載入 CSS 後，專案傳給元件的 class 能生效，Luca 元件樣式也不被 preflight 蓋掉。例外：不帶狀態的 class 不會蓋掉 `:focus-visible` 的焦點框，要改焦點樣式用 `focus-visible:` 前綴。
- `PR-ADOPT-06` — 全新的代理只靠文件，用一個指令安裝，其餘照貼，就能在乾淨專案跑通。跑 3 次，記錄每次是否需要人介入。
- `PR-ADOPT-07` — `docs/consumer-guide.md` 補上 P0 回報的 7 項錯漏：
  1. 同步 effect 刪除後，依賴該時機的程式要改用 MutationObserver 監看 `data-mode`。
  2. 手寫腳本可能還寫了 `data-theme` 和 `style.colorScheme`，`themeInitScript` 都不寫。
  3. 參考範例要傳入 suite，否則 professional 專案會閃一下。
  4. 補 jsdom 的測試改法，包括 `fireEvent.change` 對 Select 靜默無效，以及選項要先送 `pointerDown`。
  5. 補與 Tailwind 並用時的 CSS 載入順序。
  6. 第三方 portal 在 `target="self"` 會拿到 `:root` 預設主題。
  7. Windows 上建置後，`docs/design-tokens.md` 可能只有換行符差異。
- `PR-ADOPT-08` — `DESIGN.md` 由 DTCG 產生，並通過 lint。
- `PR-ADOPT-09` — 導入 changesets，兩個套件版本一致，不相容變更附升級說明。
- `PR-ADOPT-10` — CI 能對 0.3.0 跑完發佈的試跑，並設定好來源證明，權杖不進 repo。
- `PR-ADOPT-11` — 沒有 `PR-EVAL-03` 的結論和擁有者的確認，發佈流程不會真的發佈。

## Out of scope

- 真的發佈到 npm，以及升級 `automated_trading`：要等這個分支合併，所以另寫第二份規格。
- CLI：等 `PR-ADOPT-06` 實測常接錯時才補。
- 頁面範本和它的複製機制：屬於 P2。
- 新元件和新功能，例如 Dialog、`Button` 危險樣式、`DataTable` 部分跨欄：等後台範本用到，屬於 P2。
- 「只有 skill」和「完整團隊」兩組評測：團隊到 P2 才建立，屆時用同一批題目跑。
- shadcn 的相容：ADR 0010 已決定不承諾。
- 建立 npm 的 `@luca-style` 組織和權杖：由擁有者自己做，不經過代理。

## Decisions

- 發佈路線見 ADR 0010。其他取捨見 `docs/decision-log.md` 2026-11-02 的紀錄。
- 規格做到「只差確認就能發佈」，發佈和 `automated_trading` 另寫一份。不放同一份，因為議題要在同一分支建立和結案，而發佈要先合併。
- P0 基準只比兩組，不等 P2 的團隊。原計畫的三組現在比不了。
- 評測場景取優先順序前三名。複製與 npm 只跑後台與 CRUD，因為它用到最多元件，不跑三個場景以控制費用。
- 「明顯變好」的門檻如下。數字是提議後接受的，不是研究得出的：
  - 寫死顏色數、四種狀態缺漏：中位數較好，且改善至少 20%。
  - axe 違規、水平溢出、更新時遺失本地改動：從有問題變成零問題。
  - 費用和時間只記錄，不算品質項目。
- 「常接錯」的門檻：`PR-ADOPT-06` 的 3 次中，有 2 次以上需要人介入，就補 CLI。
- React 18 沒過時，用它的專案（例如 `AssetMind`）就接不進來。這是已接受的取捨。
- `PR-STYLE-55` 改變實際高度，截圖基準會更新，更新內容要列入 PR 揭露。

## Open questions

- Tailwind v4 在 `@import` 時把 Luca CSS 放進圖層的做法還沒實測。`PR-ADOPT-04`、`PR-ADOPT-05` 的乾淨專案會回答這題；沒過就重新決定做法，不放寬承諾。
