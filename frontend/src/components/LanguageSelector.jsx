import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useTranslation, SUPPORTED_LANGUAGES } from '../i18n/I18nContext';

export default function LanguageSelector() {
  const { language, changeLanguage, currentLanguageInfo } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (langCode) => {
    changeLanguage(langCode);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select Language"
        aria-expanded={isOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.35rem 0.65rem',
          background: isOpen ? 'var(--slate-100)' : '#ffffff',
          border: '1px solid var(--slate-200)',
          borderRadius: '9999px',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'var(--slate-700)',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-sm)',
          transition: 'all 0.15s ease',
          outline: 'none',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary-500)')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--slate-200)')}
      >
        <Globe size={15} className="text-emerald-600" style={{ color: '#059669', flexShrink: 0 }} />
        <span style={{ fontSize: '0.85rem' }}>{currentLanguageInfo.flag}</span>
        <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>
          {currentLanguageInfo.nativeName}
        </span>
        <ChevronDown
          size={13}
          style={{
            color: 'var(--slate-400)',
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            background: '#ffffff',
            border: '1px solid var(--slate-200)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-lg)',
            padding: '6px',
            minWidth: '190px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div
            style={{
              padding: '0.35rem 0.6rem 0.45rem',
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--slate-400)',
              borderBottom: '1px solid var(--slate-100)',
              marginBottom: '2px',
            }}
          >
            Choose Language / भाषा
          </div>

          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = lang.code === language;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelect(lang.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  border: 'none',
                  borderRadius: '8px',
                  background: isSelected ? 'var(--primary-50)' : 'transparent',
                  color: isSelected ? 'var(--primary-800)' : 'var(--slate-700)',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'var(--slate-50)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1rem', lineHeight: 1 }}>{lang.flag}</span>
                  <div>
                    <span style={{ display: 'block', lineHeight: 1.2 }}>{lang.nativeName}</span>
                    {lang.code !== 'en' && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--slate-400)', display: 'block' }}>
                        {lang.name}
                      </span>
                    )}
                  </div>
                </div>
                {isSelected && (
                  <Check size={15} style={{ color: '#059669', strokeWidth: 2.5 }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
