import React, { useState } from 'react';
import { useSuperAdminAuth } from './context/SuperAdminAuthContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import CanteenControl from './pages/CanteenControl';
import OrdersExplorer from './pages/OrdersExplorer';
import StudentsExplorer from './pages/StudentsExplorer';
import MenuExplorer from './pages/MenuExplorer';
import InventoryExplorer from './pages/InventoryExplorer';
import StaffExplorer from './pages/StaffExplorer';
import Plans from './pages/Plans';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';
import Login from './pages/Login';

export default function App() {
  const { isAuthenticated } = useSuperAdminAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!isAuthenticated) {
    return <Login />;
  }

  const getPageMeta = () => {
    switch (activeTab) {
      case 'dashboard':
        return { 
          title: 'Cafe D Cruze Restaurant Overview', 
          subtitle: 'Live operational health, revenue metrics & platform quick governance' 
        };
      case 'canteen_control':
        return { 
          title: 'Subscription & Access Control', 
          subtitle: 'Manage Cafe D Cruze Restaurant plan, trial extension, cascading suspension & panel switches' 
        };
      case 'plans':
        return { 
          title: 'Subscription Plans & Pricing Control', 
          subtitle: 'Adjust subscription package pricing with immutable audit trails' 
        };
      case 'orders':
        return { 
          title: 'Orders & Sales Database', 
          subtitle: 'Inspect live meal tokens, order status history, dish details, and revenue flow' 
        };
      case 'students':
        return { 
          title: 'Registered Students Database', 
          subtitle: 'Inspect verified campus student accounts, roll numbers, and total spending' 
        };
      case 'menu':
        return { 
          title: 'Canteen Menu Catalog', 
          subtitle: 'View breakfast, lunch, snacks, and dinner dishes available for booking' 
        };
      case 'inventory':
        return { 
          title: 'Kitchen Inventory & Ingredients', 
          subtitle: 'Inspect real-time stock levels, units, and automated low-stock warnings' 
        };
      case 'staff':
        return { 
          title: 'Staff & Admin Accounts', 
          subtitle: 'Inspect canteen admin managers and kitchen staff operator accounts' 
        };
      case 'audit':
        return { 
          title: 'Security & Governance Audit Trail', 
          subtitle: 'Immutable record of all super-admin modifications and price adjustments' 
        };
      case 'settings':
        return { 
          title: 'Super-Admin Settings', 
          subtitle: 'Account master credentials and platform parameters' 
        };
      default:
        return { 
          title: 'Cafe D Cruze Super-Admin Console', 
          subtitle: 'Dedicated restaurant management' 
        };
    }
  };

  const meta = getPageMeta();

  return (
    <div className="flex min-h-screen bg-[#090d16] text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          setMobileOpen={setMobileOpen}
          title={meta.title}
          subtitle={meta.subtitle}
        />

        <main className="flex-1 pb-12">
          {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
          {activeTab === 'canteen_control' && <CanteenControl />}
          {activeTab === 'plans' && <Plans />}
          {activeTab === 'orders' && <OrdersExplorer />}
          {activeTab === 'students' && <StudentsExplorer />}
          {activeTab === 'menu' && <MenuExplorer />}
          {activeTab === 'inventory' && <InventoryExplorer />}
          {activeTab === 'staff' && <StaffExplorer />}
          {activeTab === 'audit' && <AuditLogs />}
          {activeTab === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  );
}
