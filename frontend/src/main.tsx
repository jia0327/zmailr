import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import '@fortawesome/fontawesome-free/css/all.min.css'
import { initI18n } from './i18n'

const router = {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  },
};

initI18n().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter {...router}>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
});
