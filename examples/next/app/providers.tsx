'use client';
// ThemeProvider 放在 layout 的 client 外殼裡，換頁時不會重新掛載，<html> 的主題屬性不會被清掉再寫回。
import type {ReactNode} from 'react';
import {ThemeProvider} from '@luca-style/react';

export function Providers({children}: {children: ReactNode}) {
  return <ThemeProvider suite="professional" target="document">{children}</ThemeProvider>;
}
