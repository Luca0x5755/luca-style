# 新增從 npm registry 安裝已發佈版本並驗證的指令

## Done when
- 有一個 npm 指令接收版本號，例如 `npm run test:registry -- 0.3.0`。它會：
  - 在暫存目錄的乾淨專案，從 npm registry 安裝 `@luca-style/tokens@<版本>` 與 `@luca-style/react@<版本>`；
  - 跑與 `npm run test:consumer` 相同的檢查：型別檢查、production build、主題與元件操作、字體與授權；
  - 在該專案執行 `npm audit signatures`，失敗時指令也失敗。
- 這個模式不會對本機的 `packages/` 執行 `npm pack`，也不會安裝本機的 tarball。
- 沒有給版本號時，指令失敗並說明用法。
- 有測試證明以上三點，`npm test` 綠燈。
- PR-RELEASE-03 寫進 `docs/capabilities/design-system.md`，`docs/delivery-verification.md` 有一列，並註明真實執行在 ISSUE-019。

## Context
規格見 `docs/issues/ISSUE-015-first-npm-release.md`（PR-RELEASE-03）。現有的 `scripts/verify-consumer.mjs` 會先 `npm pack` 本機套件，再複製 `examples/consumer` 去安裝並檢查。這張議題讓同一套檢查改從 registry 取得套件，用來驗證真的發佈出去的東西。

## Blocked by
Blocked by: none

## Notes
- 現在 npm 上還沒有任何版本，對 0.3.0 的真實執行要到 ISSUE-019 才會發生。
- 這張議題的測試在不連網的切入點上證明三件事：選了 registry 模式就不呼叫 `npm pack`、版本號有傳到安裝參數、`audit signatures` 有被呼叫。做法例如把「決定安裝來源」抽成可單獨測試的函式。
- 不引入 verdaccio 之類的本機 registry，那是要執行第三方程式的新依賴。
- 優先共用 `verify-consumer.mjs` 的檢查程式，用參數或環境變數切換來源。不要複製一份檢查，否則兩份會慢慢不一致。
- `npm run test:consumer` 的行為不能改變。
