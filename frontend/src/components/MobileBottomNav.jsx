import React from 'react';
import {
  Compass,
  MapPin,
  Building2,
  Gift,
  ShieldCheck
} from 'lucide-react';
import { useTranslation } from '../i18n/I18nContext';

export default function MobileBottomNav({ activeTab, onSelectTab }) {
  const { t } = useTranslation();

  const tabs = [
    {
      id: 'tracker',
      label: t('nav.tabTracker') || 'Tracker',
      icon: Compass,
      activeColor: '#059669',
      activeBg: '#ecfdf5',
    },
    {
      id: 'routes',
      label: t('nav.tabRoutes') || 'Routes',
      icon: MapPin,
      activeColor: '#059669',
      activeBg: '#ecfdf5',
    },
    {
      id: 'city',
      label: t('nav.tabCity') || 'City',
      icon: Building2,
      activeColor: '#059669',
      activeBg: '#ecfdf5',
    },
    {
      id: 'rewards',
      label: t('nav.tabRewards') || 'Rewards',
      icon: Gift,
      activeColor: '#d97706',
      activeBg: '#fffbeb',
    },
    {
      id: 'ev',
      label: t('nav.tabEv') || 'EV Pass',
      icon: ShieldCheck,
      activeColor: '#059669',
      activeBg: '#ecfdf5',
    },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      <div className="mobile-bottom-nav-inner">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
              style={{
                color: isActive ? tab.activeColor : 'var(--slate-500)',
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              <div
                className="mobile-nav-icon-wrapper"
                style={{
                  background: isActive ? tab.activeBg : 'transparent',
                  color: isActive ? tab.activeColor : 'inherit',
                }}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={isActive ? 'mobile-nav-icon-active' : ''}
                />
              </div>
              <span className="mobile-nav-label">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
