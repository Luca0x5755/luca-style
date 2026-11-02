import {themeInitScript} from '@luca-style/react';

// 首屏腳本外掛：照接入文件，傳入和 ThemeProvider 相同的 suite（PR-ADOPT-07）。
export default {
  plugins: [{
    name: 'luca-theme-init',
    transformIndexHtml: () => [{tag: 'script', children: themeInitScript({suite: 'professional'}), injectTo: 'head-prepend'}],
  }],
  // 純客戶端打包用不到 'use client'，只靜音這一種警告，其他警告照常顯示。
  build: {
    rolldownOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && /"use client"/.test(warning.message)) return;
        warn(warning);
      },
    },
  },
};
