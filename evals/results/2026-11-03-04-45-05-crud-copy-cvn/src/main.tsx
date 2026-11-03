import '@luca-style/tokens/css';
import './fonts/fonts.css';
import './luca-style/styles.css';
import './app.css';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './luca-style/index';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider suite="professional" target="document">
    <App />
  </ThemeProvider>,
);
