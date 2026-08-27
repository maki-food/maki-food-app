import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.error('Não foi possível registrar as notificações:', error);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
