import { createRoot } from 'react-dom/client';
import '@luca-style/tokens/css';
import '@luca-style/react/fonts.css';
import '@luca-style/react/css';
import { ThemeProvider } from '@luca-style/react';
import './app.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider suite="professional" target="document">
    <App />
  </ThemeProvider>,
);
