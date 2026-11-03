import {createRoot} from 'react-dom/client';
import './index.css';

function App() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">訂單後台</h1>
      <button type="button" className="mt-4 rounded bg-blue-600 px-4 py-2 text-white">新增訂單</button>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App/>);
