import {createRoot} from 'react-dom/client';
import {LucaComponents} from './components';
import './baseline.css';
import './page.css';

createRoot(document.getElementById('root')!).render(<LucaComponents/>);
