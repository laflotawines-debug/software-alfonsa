import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// ============================
// REGISTRO DEL SERVICE WORKER
// ============================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log(
          'Alfonsa PWA: Service Worker registrado correctamente. Scope:',
          registration.scope
        );

        // Escucha actualizaciones del Service Worker
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;

          if (!installingWorker) return;

          installingWorker.onstatechange = () => {
            // Cuando hay una nueva versión lista y la app ya estaba controlada
            if (
              installingWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              console.log('Alfonsa PWA: Nueva versión detectada. Recargando...');
              window.location.reload();
            }
          };
        };
      })
      .catch((error) => {
        console.error('Alfonsa PWA: Error registrando el Service Worker:', error);
      });
  });
}

// ============================
// RENDER DE REACT
// ============================
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
