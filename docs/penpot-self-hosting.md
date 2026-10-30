# Penpot 自架說明

元件庫設計檔 `docs/mockup/luca-style-library.penpot` 用自架 Penpot 編輯（ADR 0008）。本文件列出所用版本、啟動步驟與 MCP 外掛安裝。repo 內不放 compose 檔、`.env` 或任何密鑰；下列步驟的命令都來自官方文件，網址附在各節。

標「待確認」的是本 repo 與官方文件都查不到、或維護者尚未核實的部分，不要當成已驗證的事實。

## 版本

- 建置母版與匯出所用：Penpot 2.18.5-RC1（`docs/mockup/luca-style-library.penpot` 匯出時記錄 `generatedBy: penpot/2.18.5-RC1`）。
- 維護者本機的容器映像標籤是 `2.18`（`penpotapp/frontend:2.18`、`backend`、`exporter`、`admin-console`、`mcp` 同標籤）。標籤 `2.18` 是否正好對應 2.18.5-RC1：待確認。
- 是否固定版本的決定：不強制固定，只記錄「測試過的版本是 2.18.5-RC1」。更新版本的 Penpot 未測試；升級後請重跑 `npm run check:penpot`，並用新版匯出一次檔案確認匯出檔格式沒有變（`check:penpot` 與 `penpot-dump.mjs` 依賴匯出檔的內部結構）。
- 想固定版本時，依官方文件在啟動前設環境變數 `PENPOT_VERSION`（官方建議固定版本，見下節網址）。

## 啟動步驟

來源：[Penpot 官方 Docker 自架文件](https://help.penpot.app/technical-guide/getting-started/docker/)。

1. 在 repo 之外的目錄下載官方 compose 檔（不要放進本 repo）：

   ```sh
   curl -o docker-compose.yaml https://raw.githubusercontent.com/penpot/penpot/main/docker/images/docker-compose.yaml
   ```

2. 啟動（官方預設監聽 `http://localhost:9001`）：

   ```sh
   docker compose -p penpot -f docker-compose.yaml up -d
   ```

   固定版本時：`PENPOT_VERSION=<版本> docker compose -p penpot -f docker-compose.yaml up -d`，或寫進同目錄的 `.env`。

3. 停止：`docker compose -p penpot -f docker-compose.yaml down`。更新映像：`docker compose -f docker-compose.yaml pull` 後再 `up -d`；官方建議小步升級。

4. 旗標在 compose 檔的 `PENPOT_FLAGS`（前後端都要）。MCP 需要含 `enable-mcp`；維護者本機的旗標另有 `disable-email-verification`、`enable-smtp`、`enable-prepl-server`、`disable-secure-session-cookies`、`enable-admin-console`。`disable-secure-session-cookies` 只適合本機非 HTTPS 環境，官方不建議用於正式環境。

   `enable-admin-console` 依官方文件在 2.18 不強制，但官方預告後續版本會需要，建議先啟用。其餘旗標（`enable-smtp`、`enable-prepl-server` 等）不是 MCP 的必要條件。

維護者本機的實際環境（唯讀觀察，不是 repo 的一部分）：compose 專案名稱 `penpot`，容器有 frontend（對外 9001）、backend、exporter、admin-console、postgres 15、valkey 8.1、mailpit、mcp（啟動參數 `--multi-user`）。第一次登入的帳號建立方式（例如經 mailpit 收信或管理主控台）：待確認，官方文件頁面沒有在本文引用的段落說明，維護者也未記錄。

## MCP 外掛安裝

Penpot 的 MCP 有兩種接法，來源：[Penpot MCP 文件](https://help.penpot.app/mcp/)、[MCP README](https://github.com/penpot/penpot/blob/main/mcp/README.md)。

### 本機 npm 版（官方文件）

1. 需要 Node.js（官方測過 v22，v20 應可）。
2. 在終端機啟動 MCP 與外掛伺服器，並保持開著：

   ```sh
   npx -y @penpot/mcp@stable
   ```

3. 在 Penpot 開啟設計檔，選單 Plugins → Load from URL，填入：

   ```
   http://localhost:4400/manifest.json
   ```

4. 執行外掛並按 Connect to MCP server；使用代理期間外掛視窗與該 Penpot 分頁都要保持開著（分頁閒置可能斷線）。
5. 把代理連到 `http://localhost:4401/mcp`（官方範例：`npx -y add-mcp -g -n penpot http://localhost:4401/mcp`）。埠號：外掛伺服器 4400、MCP 4401（官方 MCP 頁）；WebSocket 4402 為 MCP README 所列預設；可用 `PENPOT_MCP_SERVER_PORT`、`PENPOT_MCP_WEBSOCKET_PORT` 等環境變數更改。

注意：官方文件指出，部分 Chromium 系瀏覽器會擋下 HTTPS 頁面連到 `http://localhost`；遇到時允許本機網路存取或改用 Firefox。MCP 一次只作用於目前使用中的 Penpot 分頁，且只有一個分頁能持有 MCP。

### 自架 Penpot 內建的 MCP 服務

官方 Docker 文件只說明要開 `enable-mcp` 旗標（反向代理需轉發 `/mcp/ws` 的 WebSocket）；官方 MCP 頁面描述的「Your account → Integrations → MCP Server」啟用、產生 MCP 金鑰（只顯示一次）與「File → MCP Server → Connect」是針對託管版的流程，自架環境的網域與設定官方指向 MCP README。

本專案實際連線方式（維護者本機的 `mcp` 容器 `--multi-user`，用哪個接法、是否用 MCP 金鑰、外掛從哪個網址載入）：待確認。金鑰屬於密鑰，不要寫進 repo、提交紀錄或聊天紀錄。

## 與 repo 的關係

- 設計檔改完後的匯出與提交流程（匯出覆蓋 `.penpot`、重新產生 `luca-style-library.dump.json`、`npm run check:penpot`，兩個檔案一起提交）見[使用端接入](consumer-guide.md#更新元件庫設計檔維護-luca-style-的人)。
- 外掛 API 的 `File.export` 會失敗，匯出只能由人在介面操作（見[交付驗證](delivery-verification.md)）。
- 匯出檔的位元組不可決定（時間戳、隨機縮圖 id、雜湊鍵序），所以審查與驗證用正規化文字 dump（`docs/mockup/luca-style-library.dump.json`），不直接比對 zip。
- Penpot 是否比先前的設計工具穩定沒有驗證（ADR 0008）；長時間編輯若遇到同樣的當機，要重新評估。
