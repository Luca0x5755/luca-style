import { createRoot } from 'react-dom/client';
import '@luca-style/tokens/css';
import './luca-style/styles.css';
import { ThemeProvider, Button } from './luca-style/index.js';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider suite="professional">
    <main>
      <h1>訂單操作</h1>
      <p>儲存或取消這筆訂單的變更。</p>
      <div>
        <Button>儲存</Button>
        <Button variant="secondary">取消</Button>
        <Button loading>送出中</Button>
      </div>
    </main>
  </ThemeProvider>,
);
