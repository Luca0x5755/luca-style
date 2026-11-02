# 把接入文件改成 npm 接法並補上錯漏

## Done when

- `docs/consumer-guide.md` 改成從 npm 安裝，涵蓋 Tailwind v3、v4、Next 和 React 版本要求。
- 規格 `PR-ADOPT-07` 列出的 7 項都已補上。
- 文件裡的每段設定都和 ISSUE-002、ISSUE-003、ISSUE-007 實測的乾淨專案一致。有測試比對這些段落和專案裡的設定檔。
- 文件要讀者參考的範例，照抄後不會出錯。
- 承諾已移入 `docs/capabilities/design-system.md`。

## Context

規格見 `docs/issues/ISSUE-001-npm-publish-readiness.md`。決策紀錄已定：P1 不做 CLI，條件是一個指令安裝，其餘照文件貼上。下一張票 ISSUE-012 會讓全新的代理只靠這份文件接入。

## Blocked by

Blocked by: ISSUE-002, ISSUE-003, ISSUE-007

## Notes

- 7 項的原始位置是 `161bbf7` 版本的第 194–197、196、47、160–173、28–35、46 和 235、13 行。
- 還沒發佈時，安裝指令已寫成 npm 版本。乾淨專案的測試則用打包檔。
- `README.md` 和 `llms.txt` 若提到舊的 tarball 接法，也一併更新。
