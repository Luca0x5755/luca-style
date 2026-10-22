# Luca Style

A reusable React design system with two style suites (vibrant and professional), light/dark modes, shared components, design tokens and page templates. Documentation is in Traditional Chinese. Licensed under MIT.

跨專案設計系統；提供雙套系、日夜模式、共用元件、設計基礎與產品／介紹頁範本。

## 開發

需要 Node.js 22.12 以上與 npm 11。

```sh
npm ci
npm run dev
```

開啟終端顯示的本機網址。`/` 的主要行動可進入 `/foundations`；該頁展示正式設計基礎。

```sh
npm run build
npm run preview
```

正式預覽位於 http://127.0.0.1:4173。工作區依序建置 tokens、React、showcase。

## 公開套件

- `@luca-style/tokens/css`：產生的 CSS variables。
- `@luca-style/tokens/data`：相同來源的 JSON 資料，以 vibrant/professional、light/dark 兩層索引。
- `@luca-style/react`：Button、表單與回饋、Navigation、MetricCard、DataTable、ThemeProvider、useTheme 及相關型別；搭配 `@luca-style/react/css` 使用。字體另引用 `@luca-style/react/fonts.css`。

變數來源為 `packages/tokens/src/tokens.json`。修改後執行 `npm run generate`，再重建或重啟開發指令。產物在各套件 `dist/`，不納入版本管理。

## 驗證

```sh
npx playwright install chromium
npm run build
npm run typecheck
npm run lint
npm test
```

瀏覽器測試使用獨立 4173 port，不重用既有伺服器；先關閉該埠的其他服務。來源串接測試會暫時修改強調色、重建並驗證瀏覽器，最後復原來源及輸出；執行測試時請勿同時編輯 token。

視覺真相見 `docs/05_frontend_spec.md` 與 `docs/mockup/components.pen`。


## 使用端接入

要讓其他專案的代理套用此設計，複製[跨專案套用提示詞](docs/adoption-prompt.md)，填寫套系與範圍即可；內附精緻活力與精緻專業的輸入範例。

安裝封裝產物、公開 API、字體授權與 Pencil 同步見 [使用端接入文件](docs/consumer-guide.md)。獨立 consumer 驗證：`npm run test:consumer`（先 build，需要網路、Chromium 與獨立 4174 port）。

## 授權

程式碼與文件以 [MIT License](LICENSE) 釋出。`packages/react/fonts/` 內的字體維持 SIL Open Font License 1.1，再散布時須保留對應的 OFL 檔案。
