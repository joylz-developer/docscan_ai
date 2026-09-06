import React from 'react';
import ReactDOM from 'react-dom/client';
import { ToastProvider } from './context/ToastContext';
import { AppProvider } from './context/AppContext';
import { MainAppContent } from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ToastProvider>
      <AppProvider>
        <MainAppContent />
      </AppProvider>
    </ToastProvider>
  </React.StrictMode>
);
