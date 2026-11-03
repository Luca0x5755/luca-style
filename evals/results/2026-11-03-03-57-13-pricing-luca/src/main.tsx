import '@luca-style/tokens/css';
import '@luca-style/react/fonts.css';
import '@luca-style/react/css';
import './styles.css';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@luca-style/react';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider suite="vibrant" target="document">
    <App />
  </ThemeProvider>,
);
