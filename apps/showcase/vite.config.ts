import { defineConfig } from 'vite';
import { themeInitScript } from '@luca-style/react';

// 把設計系統的首屏腳本注入 <head> 最前面，React 掛載前就依已存偏好設定 <html> 主題屬性。
export default defineConfig({
  plugins:[{
    name:'luca-theme-init',
    transformIndexHtml:() => [{tag:'script', children:themeInitScript(), injectTo:'head-prepend'}],
  }],
});
