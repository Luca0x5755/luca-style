import {createRoot} from 'react-dom/client';
import {ThemeProvider, Button} from '@luca-style/react';
import './index.css';

function App() {
  return (
    <ThemeProvider suite="professional" target="document">
      <main className="p-6">
        <h1 className="text-2xl font-bold">訂單後台</h1>
        <Button type="button" className="mt-4">新增訂單</Button>
      </main>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(<App/>);
