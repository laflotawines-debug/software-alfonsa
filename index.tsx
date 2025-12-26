
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Registro del Service Worker mediante ruta relativa estándar
// Esto evita errores de construcción de URL en entornos como Vercel o Previews
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('Alfonsa PWA: Service Worker registrado con éxito:', reg.scope);
      })
      .catch(err => {
        // No bloqueamos la ejecución de la app si el SW falla (útil en entornos de desarrollo/preview)
        console.warn('Alfonsa PWA: Aviso en registro de Service Worker:', err.message);
      });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
