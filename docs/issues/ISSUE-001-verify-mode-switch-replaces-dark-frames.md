# Verify that one page frame can show Light and Dark by switching Mode

## Done when
- 在複本檔 `components-vibrant.fig` 上，`Home/Vibrant/Light/Desktop/Success` 拿掉 Mode 固定後，OpenPencil App 切換 Mode 為 Light 與 Dark，畫面分別等於現有 `Light` 與 `Dark` 兩個 frame（顏色與版面）。
- 同一個複本，用 MCP 的 `get_node` 或匯出圖在兩個模式下讀值／匯出，結果是否跟著模式變，有明確紀錄（變或不變都要寫）。
- 離線 `openpencil eval` 讀到的 Device 固定值、其他 frame 的模式、節點總數與實例連結都沒有被這個修改弄壞。
- 結論寫進 `docs/delivery-verification.md` 新一節：可行／不可行，以及全面改要動的檔案清單（規格 §5.3、PR-FILE-04、`baseline.json`、`verify-split.js`、`verify-themes.js`）。
- 正式的兩個 `.fig` 檔與規格本身**不修改**。

## Context
目前每頁有 Light 與 Dark 兩份 frame，各自在 frame 上固定 Mode（ISSUE-009 的做法）。母版沒有固定模式，所以在 App 切 Mode 會跟著變（使用者已確認 `C/Field/Default`、`C/Button/Focus`）。想知道頁面 frame 拿掉固定後能否取代 Dark 那一份，以減少約一半的 frame 與節點。見 `docs/05_frontend_spec.md` §5.3、`docs/capabilities/design-system.md` PR-FILE-04。

## Blocked by
none

## Notes
- 一次只開一個檔案（OpenPencil App 的限制）；在暫存複本上做，不碰版控的檔案。
- App 曾因渲染器問題當機；若當機，記錄為「未能驗證」，不要寫成可行。
- 只試 Vibrant 的一個 frame；Professional 與其他頁面等結論出來再說。
- 若可行，另開票做全面改動（規格、基準、驗收腳本）；本票不做。
