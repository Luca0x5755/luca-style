# 補齊其餘兩個試點母版

Blocked by: ISSUE-018

## Done when

- `C/State/Loading`、`C/Nav/Mobile` 在暫存檔建好，4 個組合 × 3 個尺寸解析的色彩都與 `docs/mockup/themes/variables.json` 一致（PR-FILE-20 完成）。
- 記錄 `.fig` 只存預設模式的三項（hug 版面尺寸、陰影開關、載入圖片透明度）在 Penpot 是否隨 theme 切換。

## Context

`C/State/Loading` 有四個圖片填色，透明度在 `.fig` 沒有綁定欄位；`C/Nav/Mobile` 靠自動排版，是版面最容易出問題的一個。背景見 ISSUE-017 與 ADR 0008。

## Blocked by

ISSUE-018

## Notes

結果寫進 ISSUE-017 的 Open questions 對應項，不要自行決定捨棄。
