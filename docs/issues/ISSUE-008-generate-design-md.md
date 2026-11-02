# 由 DTCG 產生 DESIGN.md

## Done when

- `DESIGN.md` 的設計變數由 `packages/tokens` 的 DTCG 正本產生（`PR-ADOPT-08`）。
- 重新產生後，git 沒有差異。正本改了卻沒有重新產生時，測試會失敗。
- `DESIGN.md` 通過 Google DESIGN.md 規格的 lint。
- 現有的文字說明都保留。
- `tests/agent-docs.spec.ts` 和 `npm run test:consumer` 通過。
- 承諾已移入 `docs/capabilities/design-system.md`。

## Context

規格見 `docs/issues/ISSUE-001-npm-publish-readiness.md`。`DESIGN.md` 目前是手寫的，隨 `@luca-style/react` 發佈，專案的代理會讀它，所以數值不能和正本不一致。

## Blocked by

Blocked by: none

## Notes

- Google 的規格還是 alpha。先查 lint 工具現在的套件名稱和版本，釘住版本，再加進開發依賴。
- 手寫文字和產生的區塊要分開，重新產生時不能蓋掉手寫文字。
- ISSUE-005、ISSUE-006 也會改 `DESIGN.md` 的元件說明，合併時注意保留。
- `DESIGN.md` 第 154 行的 Penpot 暫停說明不在這張票的範圍。
