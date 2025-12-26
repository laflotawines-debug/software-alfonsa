
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Registro robusto del Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Usamos el pathname actual para asegurar que el registro ocurra en el dominio correcto
    const swPath = `${window.location.pathname.replace(/\/[^\/]*$/, '')}/sw.js`.replace(/\/+/g, '/');
    
    navigator.serviceWorker.register(swPath)
      .then(reg => {
        console.log('Alfonsa PWA: Service Worker activo en el scope:', reg.scope);
        
        // Si hay una actualización, forzamos recarga para limpiar errores de caché previos
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('Nueva versión detectada. Actualizando...');
                window.location.reload();
              }
            };
          }
        };
      })
      .catch(err => {
        // Silenciamos el error en entornos de desarrollo que no permiten SW (como iframes restringidos)
        if (!window.location.hostname.includes('localhost')) {
          console.warn('PWA: La instalación no está disponible en este entorno de previsualización:', err.message);
        }
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
