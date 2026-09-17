import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AdminAuthProvider } from './context/AdminAuthContext.jsx';
import { OrderAlertProvider } from './context/OrderAlertContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AdminAuthProvider>
      <OrderAlertProvider>
        <App />
      </OrderAlertProvider>
    </AdminAuthProvider>
  </React.StrictMode>
);
