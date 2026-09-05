import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import MobileBottomNav from './components/MobileBottomNav';
import MultimodalMobilityVerification from './pages/MultimodalMobilityVerification';
import EVRegistration from './pages/EVRegistration';
import SmartRoutePlanner from './pages/SmartRoutePlanner';
import CityTransportNetwork from './pages/CityTransportNetwork';
import RewardsMarketplace from './pages/RewardsMarketplace';
import Login from './pages/Login';
import Register from './pages/Register';
import { api, getStoredUser } from './services/api';
import { I18nProvider, useTranslation } from './i18n/I18nContext';

function AppContent() {
  const [user, setUser] = useState(getStoredUser());
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) return tabParam;
      if (params.get('journeyId') || params.get('pair')) return 'tracker';
    }
    return 'routes';
  });
  const [selectedRouteToTrack, setSelectedRouteToTrack] = useState(null);
  const [authModal, setAuthModal] = useState(null); // 'login' | 'register' | null
  const { t } = useTranslation();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) {
        setActiveTab(tabParam);
      } else if (params.get('journeyId') || params.get('pair')) {
        setActiveTab('tracker');
      }
    }
  }, []);

  useEffect(() => {
    // Validate session if user token exists
    const checkSession = async () => {
      try {
        const res = await api.getMe();
        if (res.success && res.user) {
          setUser(res.user);
        }
      } catch (err) {
        // Token invalid or expired
        api.logout();
        setUser(null);
      }
    };

    if (user) {
      checkSession();
    }
  }, []);

  const handleLogout = () => {
    api.logout();
    setUser(null);
  };

  const handleAuthSuccess = (userData) => {
    setUser(userData);
    setAuthModal(null);
  };

  const handleSelectRouteToTrack = (route) => {
    setSelectedRouteToTrack(route);
    setActiveTab('tracker');
  };

  return (
    <div className="app-layout">
      <Navbar
        user={user}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        onLogout={handleLogout}
        onOpenAuth={(type) => setAuthModal(type)}
      />

      <main style={{ minHeight: 'calc(100vh - 160px)' }}>
        {activeTab === 'tracker' && (
          <MultimodalMobilityVerification
            user={user}
            selectedRoute={selectedRouteToTrack}
            onClearSelectedRoute={() => setSelectedRouteToTrack(null)}
            onUserUpdate={setUser}
            onOpenAuth={(type) => setAuthModal(type)}
          />
        )}

        {activeTab === 'routes' && (
          <SmartRoutePlanner
            onSelectRouteToTrack={handleSelectRouteToTrack}
          />
        )}

        {activeTab === 'city' && (
          <CityTransportNetwork />
        )}

        {activeTab === 'rewards' && (
          <RewardsMarketplace
            user={user}
            onUserUpdate={setUser}
            onOpenAuth={(type) => setAuthModal(type)}
          />
        )}

        {activeTab === 'ev' && (
          <EVRegistration
            user={user}
            onOpenAuth={(type) => setAuthModal(type)}
          />
        )}
      </main>

      {/* Auth Modals */}
      <Login
        isOpen={authModal === 'login'}
        onClose={() => setAuthModal(null)}
        onSwitchToRegister={() => setAuthModal('register')}
        onSuccess={handleAuthSuccess}
      />

      <Register
        isOpen={authModal === 'register'}
        onClose={() => setAuthModal(null)}
        onSwitchToLogin={() => setAuthModal('login')}
        onSuccess={handleAuthSuccess}
      />

      <footer style={{
        textAlign: 'center',
        padding: '2rem 1rem',
        borderTop: '1px solid var(--slate-200)',
        fontSize: '0.82rem',
        color: 'var(--slate-500)',
        background: '#ffffff',
        marginTop: '2rem',
      }}>
        <div style={{ fontWeight: 700, color: 'var(--slate-700)' }}>
          {t('footer.tagline')}
        </div>
        <div style={{ fontSize: '0.75rem', marginTop: '0.35rem', color: 'var(--slate-400)' }}>
          {t('footer.subtagline')}
        </div>
      </footer>

      {/* Mobile-First App Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
      />
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}
