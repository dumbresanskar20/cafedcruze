import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import KitchenScreen from './components/KitchenScreen';
import CAFE_D_CRUZE_LOGO from './assets/logo';

import OrderHistoryScreen from './components/OrderHistoryScreen';
import RatingsReviewsScreen from './components/RatingsReviewsScreen';
import MenuManagement from './components/MenuManagement';
import MealTimings from './components/MealTimings';
import StaffManagement from './components/StaffManagement';
import AdminAuth from './components/AdminAuth';
import SubscriptionExpiredOverlay from './components/SubscriptionExpiredOverlay';
import SubscriptionModal from './components/SubscriptionModal';
import { useAdminAuth } from './context/AdminAuthContext';

import InventoryManagement from './components/InventoryManagement';
import MenuReportScreen from './components/MenuReportScreen';
import DiscountSettingsScreen from './components/DiscountSettingsScreen';
import { createAdminSocketClient } from './services/socket';
import AlertControls from './components/AlertControls';
import NotificationPermissionModal from './components/NotificationPermissionModal';
import ChangePasswordModal from './components/ChangePasswordModal';
import { KeyRound } from 'lucide-react';

export default function App() {
  const {
    admin,
    token,
    logout,
    isAuthenticated,
    isSuperAdmin,
    subscriptionExpired,
    setSubscriptionExpired,
    subscription,
    setSubscription,
    fetchSubscriptionStatus,
  } = useAdminAuth();
  const [activeTab, setActiveTab] = useState('kitchen');
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  // Force active tab to kitchen for kitchen staff upon login/session switch
  React.useEffect(() => {
    if (isAuthenticated && !isSuperAdmin) {
      setActiveTab('kitchen');
    }
  }, [isAuthenticated, isSuperAdmin]);

  // Real-time synchronization with Super-Admin actions (Suspensions, Pricing updates, Trial extensions)
  React.useEffect(() => {
    let socket = null;
    if (token) {
      socket = createAdminSocketClient(token);

      socket.on('subscription:status_changed', (data) => {
        console.log('[Admin App] Real-time subscription status update received:', data);
        fetchSubscriptionStatus();
      });

      socket.on('subscription:plans_updated', (data) => {
        console.log('[Admin App] Real-time plan pricing update received:', data);
        fetchSubscriptionStatus();
      });

      socket.on('client:status_changed', (data) => {
        console.log('[Admin App] Real-time client status update received:', data);
        fetchSubscriptionStatus();
      });
    }

    // Periodic sync every 20 seconds
    const interval = setInterval(() => {
      if (isAuthenticated) {
        fetchSubscriptionStatus();
      }
    }, 20000);

    return () => {
      if (socket) socket.disconnect();
      clearInterval(interval);
    };
  }, [token, isAuthenticated]);

  // Path: / (Standard Canteen Admin Panel)
  if (!isAuthenticated) {
    return <AdminAuth />;
  }

  // Staff Role View: Dedicated Full-Screen Kitchen Display (No Sidebar)
  if (admin?.role === 'staff') {
    return (
      <div className="min-h-screen bg-admin-bg text-admin-dark flex flex-col">
        {/* Fullscreen Staff Top Header */}
        <header className="bg-slate-900 text-white px-5 sm:px-8 py-3.5 flex items-center justify-between border-b border-slate-800 shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <img
              src={CAFE_D_CRUZE_LOGO}
              alt="Cafe D Cruze Restaurant Logo"
              className="w-10 h-10 rounded-2xl object-contain bg-white p-1 shadow-sm border border-slate-700"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base sm:text-lg text-white tracking-tight leading-none">
                  Cafe D Cruze <span className="text-emerald-400">Restaurant Staff</span>
                </h1>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                  Staff Mode
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Active Staff: {admin?.username || 'Staff'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <AlertControls isDarkHeader={true} />
            <button
              onClick={() => setChangePasswordOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer"
              title="Change Password"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">Change Password</span>
              <span className="sm:hidden">Password</span>
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Fullscreen Kitchen Screen */}
        <main className="flex-1 overflow-y-auto w-full">
          <KitchenScreen isStaffFullscreen={true} />
        </main>

        {/* Real-time Browser Notification Pre-Permission Friendly Modal */}
        <NotificationPermissionModal />

        {/* Subscription Expired Blocking Overlay for Staff */}
        {subscriptionExpired && (
          <SubscriptionExpiredOverlay
            subscription={subscription}
            onOpenRenewModal={() => setRenewModalOpen(true)}
          />
        )}

        {/* Super Admin Renewal Modal */}
        <SubscriptionModal
          isOpen={renewModalOpen}
          onClose={() => setRenewModalOpen(false)}
          onSuccess={(updatedSub) => {
            setSubscription(updatedSub);
            setSubscriptionExpired(false);
            fetchSubscriptionStatus();
          }}
        />

        {/* Change Password Modal for Staff */}
        <ChangePasswordModal
          isOpen={changePasswordOpen}
          onClose={() => setChangePasswordOpen(false)}
        />
      </div>
    );
  }

  // Once authenticated as admin/super_admin, render the Admin Panel dashboard with Sidebar
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-admin-bg text-admin-dark relative">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenChangePassword={() => setChangePasswordOpen(true)}
      />

      {/* Main View Area with Persistent Top Header */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Desktop Top Header Bar */}
        <header className="hidden md:flex bg-white border-b border-slate-200 px-6 py-3 items-center justify-between shadow-xs shrink-0 z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-black text-slate-900 capitalize tracking-tight">
              {activeTab === 'kitchen' ? 'Order Fulfillment & Kitchen Operations' :
               activeTab === 'history' ? 'Order History & Sales Analytics' :
               activeTab === 'reviews' ? 'Ratings & Student Feedback' :
               activeTab === 'menu' ? 'Menu & Recipe Management' :
               activeTab === 'inventory' ? 'Inventory & Stock Control' :
               activeTab === 'menu-report' ? 'Menu Sales & Performance Reports' :
               activeTab === 'timings' ? 'Meal Timing Schedules' :
               activeTab === 'discounts' ? 'Discount Rules & Dynamic Pricing' :
               activeTab === 'staff' ? 'Staff Account Management' : 'Admin Dashboard'}
            </h2>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              onClick={() => setChangePasswordOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-bold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer"
              title="Change Account Password"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Change Password</span>
            </button>
            <AlertControls isDarkHeader={false} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto min-w-0">
          {activeTab === 'kitchen' && <KitchenScreen isStaffFullscreen={false} />}

          {activeTab === 'history' && (isSuperAdmin || admin?.role === 'admin') && <OrderHistoryScreen />}
          {activeTab === 'reviews' && (isSuperAdmin || admin?.role === 'admin') && <RatingsReviewsScreen />}
          {activeTab === 'menu' && (isSuperAdmin || admin?.role === 'admin') && <MenuManagement />}
          {activeTab === 'inventory' && (isSuperAdmin || admin?.role === 'admin') && <InventoryManagement />}
          {activeTab === 'menu-report' && (isSuperAdmin || admin?.role === 'admin') && <MenuReportScreen />}
          {activeTab === 'timings' && (isSuperAdmin || admin?.role === 'admin') && <MealTimings />}
          {activeTab === 'discounts' && (isSuperAdmin || admin?.role === 'admin') && <DiscountSettingsScreen />}
          {activeTab === 'staff' && isSuperAdmin && <StaffManagement />}
        </main>
      </div>

      {/* Real-time Browser Notification Pre-Permission Friendly Modal */}
      <NotificationPermissionModal />

      {/* Subscription Expired Blocking Overlay */}
      {subscriptionExpired && (
        <SubscriptionExpiredOverlay
          subscription={subscription}
          onOpenRenewModal={() => setRenewModalOpen(true)}
        />
      )}

      {/* Super Admin Renewal Modal */}
      <SubscriptionModal
        isOpen={renewModalOpen}
        onClose={() => setRenewModalOpen(false)}
        onSuccess={(updatedSub) => {
          setSubscription(updatedSub);
          setSubscriptionExpired(false);
          fetchSubscriptionStatus();
        }}
      />

      {/* Change Password Modal for Admin & Super Admin */}
      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </div>
  );
}
