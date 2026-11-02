// 伺服器元件：照 consumer-guide 的 Next 接法，從套件入口匯入首屏腳本並放進 <head>（PR-ADOPT-01）。
import type {ReactNode} from 'react';
import {themeInitScript} from '@luca-style/react';
import '@luca-style/tokens/css';
import '@luca-style/react/fonts.css';
import '@luca-style/react/css';
import {Providers} from './providers';

// 首屏腳本會在 hydration 前寫入 <html> 的主題屬性，所以 <html> 要 suppressHydrationWarning；少了它，next dev 會報 hydration 屬性不一致。它只作用在 <html> 自己的屬性。
export default function RootLayout({children}: {children: ReactNode}) {
  return <html lang="zh-Hant" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{__html: themeInitScript({suite: 'professional'})}}/></head>
    <body><Providers>{children}</Providers></body>
  </html>;
}
