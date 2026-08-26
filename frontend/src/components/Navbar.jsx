import React from 'react';
import {
  Zap,
  LogOut,
  User,
  Compass,
  MapPin,
  Building2,
  Gift,
  ShieldCheck,
  Flame,
  Leaf
} from 'lucide-react';

export default function Navbar({
  user,
  activeTab,
  onSelectTab,
  onLogout,
  onOpenAuth,
}) {
  return (
    <header className="navbar">
      <div className="navbar-inner" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        {/* Brand */}
        <div className="brand" onClick={() => onSelectTab('tracker')} style={{ cursor: 'pointer' }}>
          <div className="brand-icon">
            <Zap size={22} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ lineHeight: 1.1, fontSize: '1.15rem' }}>Green Credits</div>
            <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700, letterSpacing: '0.06em' }}>
              SMART MOBILITY PLATFORM
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          background: 'var(--slate-100)',
          padding: '4px',
          borderRadius: '12px',
          overflowX: 'auto',
          maxWidth: '100%',
        }}>
          <button
            onClick={() => onSelectTab('tracker')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.83rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'tracker' ? '#ffffff' : 'transparent',
              color: activeTab === 'tracker' ? 'var(--slate-900)' : 'var(--slate-600)',
              boxShadow: activeTab === 'tracker' ? 'var(--shadow-sm)' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <Compass size={15} className="text-emerald-600" />
            <span>Green Journey</span>
          </button>

          <button
            onClick={() => onSelectTab('routes')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.83rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'routes' ? '#ffffff' : 'transparent',
              color: activeTab === 'routes' ? 'var(--slate-900)' : 'var(--slate-600)',
              boxShadow: activeTab === 'routes' ? 'var(--shadow-sm)' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <MapPin size={15} className="text-emerald-600" />
            <span>Smart Routes</span>
          </button>

          <button
            onClick={() => onSelectTab('city')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.83rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'city' ? '#ffffff' : 'transparent',
              color: activeTab === 'city' ? 'var(--slate-900)' : 'var(--slate-600)',
              boxShadow: activeTab === 'city' ? 'var(--shadow-sm)' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <Building2 size={15} className="text-emerald-600" />
            <span>City Network</span>
          </button>

          <button
            onClick={() => onSelectTab('rewards')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.83rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'rewards' ? '#ffffff' : 'transparent',
              color: activeTab === 'rewards' ? 'var(--slate-900)' : 'var(--slate-600)',
              boxShadow: activeTab === 'rewards' ? 'var(--shadow-sm)' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <Gift size={15} className="text-amber-500" />
            <span>Rewards</span>
          </button>

          <button
            onClick={() => onSelectTab('ev')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.83rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'ev' ? '#ffffff' : 'transparent',
              color: activeTab === 'ev' ? 'var(--slate-900)' : 'var(--slate-600)',
              boxShadow: activeTab === 'ev' ? 'var(--shadow-sm)' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <ShieldCheck size={15} className="text-emerald-600" />
            <span>EV Pass</span>
          </button>
        </nav>

        {/* User & Points Balances */}
        <div className="nav-actions">
          {user ? (
            <>
              {/* Dual-Economy Points Pill */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                background: '#ffffff',
                border: '1px solid var(--slate-200)',
                borderRadius: '9999px',
                padding: '0.3rem 0.75rem',
                boxShadow: 'var(--shadow-sm)',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#ea580c' }} title="Fitness Points">
                  <Flame size={14} fill="#ea580c" />
                  <span>{user.fitnessPoints ?? 0} FP</span>
                </div>
                <div style={{ width: '1px', height: '14px', background: 'var(--slate-200)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#059669' }} title="Green Credits">
                  <Leaf size={14} fill="#059669" />
                  <span>{user.greenCredits ?? 0} GP</span>
                </div>
              </div>

              <div className="user-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <User size={14} className="text-emerald-600" />
                <span>{user.name?.split(' ')[0]}</span>
              </div>

              <button
                onClick={onLogout}
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                title="Log out"
              >
                <LogOut size={14} />
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => onOpenAuth('login')}
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem' }}
              >
                Sign In
              </button>
              <button
                onClick={() => onOpenAuth('register')}
                className="btn btn-primary"
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem' }}
              >
                Register
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
