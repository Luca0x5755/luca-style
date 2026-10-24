// 畫布頁規則：套系設計檔內每個頂層節點應該放在哪一個畫布頁。
// 規則（見 GLOSSARY「畫布頁」）：frame 名稱第一段是產品頁面名稱就放同名畫布頁；
// 母版（COMPONENT）、元件檢視板、目錄、標題文字與 Library guide 一律放 Library guide。
// paginate-fig.js 與 verify-split.js 共用同一份規則，改這裡即同時改兩邊。
export const GUIDE_PAGE = 'Library guide';
export const PRODUCT_PAGES = ['Home', 'Foundations', 'Components', 'Product', 'Intro', 'NotFound'];
// App 或 openpencil 自動維持的空頁，不放設計內容，所有檢查略過。
export const IGNORED_PAGES = ['Internal Only Canvas'];

export const pageOf = (name, type) => {
  if (type === 'COMPONENT') return GUIDE_PAGE;
  const first = name.split('/')[0];
  return PRODUCT_PAGES.includes(first) ? first : GUIDE_PAGE;
};

// 給 openpencil eval 片段使用的同一份規則（片段內不能 import）。
export const PAGE_RULES_SNIPPET = `
const GUIDE_PAGE = ${JSON.stringify(GUIDE_PAGE)}
const PRODUCT_PAGES = ${JSON.stringify(PRODUCT_PAGES)}
const IGNORED_PAGES = ${JSON.stringify(IGNORED_PAGES)}
const pageOf = ${pageOf.toString()}
`;
