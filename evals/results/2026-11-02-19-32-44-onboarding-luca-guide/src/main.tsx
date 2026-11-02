import {createRoot} from 'react-dom/client';
import {ThemeProvider, Button} from '@luca-style/react';
import './index.css';

function App() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold text-text">訂單後台</h1>
      <Button className="mt-4">新增訂單</Button>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <ThemeProvider suite="professional" target="document">
    <App/>
  </ThemeProvider>,
);
