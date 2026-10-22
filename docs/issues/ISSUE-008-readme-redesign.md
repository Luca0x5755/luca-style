# 重新設計 README

Blocked by: ISSUE-006, ISSUE-007

## Done when

- README 依序包含：一句話介紹與截圖、快速開始、公開套件與文件導覽、開發與驗證、授權。
- 附線上樣張連結 `https://luca0x5755.github.io/luca-style/`；本機預覽改稱「本機預覽」，不再稱「正式預覽」。
- 快速開始包含 `git clone`、`npm ci`、`npm run dev`，以及不超過 10 行的最少使用程式碼，並連到[使用端接入文件](../consumer-guide.md)。
- 四張截圖來自 `docs/images/`。
- 所有連結有效：相對連結的檔案存在，線上樣張連結實際回 200。
- 開頭的英文簡介與授權段落保留。

## Context

規格見 [ISSUE-001](ISSUE-001-github-pages-readme.md)，承諾 PR-STYLE-21、PR-STYLE-22。README 目前以維護者視角撰寫；開源讀者想先知道這是什麼、長什麼樣子、怎麼使用。

## Blocked by

ISSUE-006 — 線上樣張要實際可開，連結才不會是死連結。ISSUE-007 — 需要截圖。

## Notes

- 程式碼片段從 `examples/consumer/src/main.tsx` 摘錄，與範例保持一致，不另創用法。
- 安裝與封裝細節只維護在 consumer-guide，不在 README 重寫一份。
- README 維持中文；不新增 CONTRIBUTING、SECURITY、CHANGELOG（見 ISSUE-001 範圍外）。
- 完成時依 ISSUE-001 的做法，PR-STYLE-15～24 的承諾移入 `docs/capabilities/design-system.md`，更新 `docs/delivery-verification.md`，再用 `git rm` 刪除 `docs/issues/` 內全部議題，否則 `issues-check` 會擋下 PR。
