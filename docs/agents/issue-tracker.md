# Issue tracker

使用本機 Markdown，每張議題位於：
docs/issues/ISSUE-NNN-<slug>.md

NNN 為目前最大編號加一，補足三位；沒有議題時從 001 開始。
slug 使用英文 kebab-case。檔案存在即代表議題尚未完成。

## 建立議題（在根目錄執行 PowerShell）

```powershell
$issueSlug = 'replace-with-topic'
New-Item -ItemType Directory -Path docs/issues -Force | Out-Null
$issueNumbers = @(Get-ChildItem docs/issues -File | ForEach-Object {
    if ($_.Name -match '^ISSUE-(\d+)-') { [int]$Matches[1] }
})
$issueNext = 1
if ($issueNumbers.Count) {
    $issueNext = ($issueNumbers | Measure-Object -Maximum).Maximum + 1
}
$issuePath = 'docs/issues/ISSUE-{0:D3}-{1}.md' -f [int]$issueNext, $issueSlug
New-Item -ItemType File -Path $issuePath -ErrorAction Stop
```

將議題標題、需求與驗收條件寫入該檔案；規格議題保留 promise IDs。
檔案寫入並提交後才算發佈。

## 列出未完成議題

```powershell
Get-ChildItem docs/issues -File -Filter 'ISSUE-*.md' | Sort-Object Name
```

## 阻塞關係

在議題內記錄：
Blocked by: ISSUE-001, ISSUE-002
沒有阻塞時記錄：
Blocked by: none

## 生命週期

議題在同一功能分支建立、執行及結案。
完成時將持續有效的規格移入正式文件，再以 git rm 刪除議題，
並隨實作提交。跨分支持續存在的工作應改用外部追蹤器。
