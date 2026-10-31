# 切換主題和寬度，並定下桌機並排方式

Blocked by: ISSUE-002

## Done when

- 切換風格套系或明暗模式時，四格一起改變，其他頁面的主題設定不受影響。
- 切換桌機或手機寬度時，版面按該寬度的斷點呈現。
- `docs/05_frontend_spec.md` §5.3.7 的 Loading、Empty、Error 都做好；單一格無法呈現時，其他格和切換控制照常可用。
- 桌機並排方式由專案負責人看過實際畫面後決定，結果寫進 §5.3.7 和 `docs/decision-log.md`。

## Context

兌現 PR-REVIEW-03、04，規格見 `docs/issues/ISSUE-001-state-overview-page.md`。四格 1280px 放不進一個視窗，規格刻意沒有定下並排方式，要看到實際畫面才能判斷。這張票也是 ISSUE-001 記載的 Storybook 退路判斷點。

## Notes

- 版面斷點都是 `@media`，同一視窗內不會跟著改變，所以寬度要用 iframe 切換。
- 局部切換要用 `ThemeProvider` 預設的外層 div。App 外層的 `target="document"` 會影響整頁，不能用它切換單格。
- 代理要準備縮小並排和原尺寸橫向捲動兩種截圖，然後停下來問專案負責人，不能自己選。縮小看得到全貌但字會失真，原尺寸字正確但看不到全貌。
- 同時請專案負責人判斷 Storybook 退路：如果總覽頁外殼的工夫明顯超過頁面本身，就停下來，不要繼續做。
