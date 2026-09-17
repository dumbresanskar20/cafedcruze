import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SuperAdminAuthProvider } from './context/SuperAdminAuthContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SuperAdminAuthProvider>
      <App />
    </SuperAdminAuthProvider>
  </React.StrictMode>
);
