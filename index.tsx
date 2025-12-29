
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Registro del Service Worker en la raíz del proyecto
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Registramos el sw.js que reside en el mismo nivel que el index.html
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('Alfonsa PWA: Service Worker activo en el scope:', reg.scope);
      })
      .catch(err => {
        console.warn('Alfonsa PWA: Falló el registro del Service Worker (esto es normal en desarrollo local sin HTTPS):', err.message);
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
