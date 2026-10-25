import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

/**
 * El service worker estaba configurado como `autoUpdate` pero nadie lo
 * registraba desde la app: se instalaba la versión nueva en segundo plano y la
 * página seguía corriendo la vieja indefinidamente, porque index.html está
 * precacheado. Cada deploy quedaba invisible hasta que alguien hacía un
 * refresh forzado a mano.
 *
 * `immediate: true` toma control apenas se activa; `onNeedRefresh` recarga una
 * sola vez para levantar los assets nuevos. El guard evita un bucle de
 * recargas si el navegador vuelve a disparar el evento.
 */
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
  },
  onRegisteredSW(_url, registration) {
    // Un panel abierto todo el día no vuelve a navegar: sin esto, no se entera
    // de un deploy hasta la próxima vez que se cierre la pestaña.
    if (registration) {
      setInterval(() => { registration.update(); }, 60 * 60 * 1000);
    }
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
