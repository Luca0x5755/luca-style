import { createRoot } from 'react-dom/client';
import '@luca-style/tokens/css';
import '@luca-style/react/css';
import { ThemeProvider } from '@luca-style/react';
import { LocalButton } from './local-button';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider suite="professional">
    <main>
      <h1>訂單操作</h1>
      <p>儲存或取消這筆訂單的變更。</p>
      <div>
        <LocalButton>儲存</LocalButton>
        <LocalButton variant="secondary">取消</LocalButton>
        <LocalButton loading>送出中</LocalButton>
      </div>
    </main>
  </ThemeProvider>,
);
