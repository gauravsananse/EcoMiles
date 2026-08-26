import React, { useState } from 'react';
import { Mail, Lock, User, Loader2, AlertCircle, X, Zap } from 'lucide-react';
import { api } from '../services/api';

export default function Register({ isOpen, onClose, onSwitchToLogin, onSuccess }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await api.register(name.trim(), email.trim(), password);
      if (res.success) {
        onSuccess(res.user);
        onClose();
      }
    } catch (err) {
      setError(err.data?.error || err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '1.5rem',
    }}>
      <div className="card" style={{ maxWidth: '420px', width: '100%', position: 'relative' }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--slate-400)',
          }}
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '44px',
            height: '44px',
            background: 'var(--primary-50)',
            color: 'var(--primary-600)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 0.75rem',
          }}>
            <Zap size={24} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--slate-900)' }}>
            Create Account
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)', marginTop: '0.25rem' }}>
            Register to bind and verify your Electric Vehicles
          </p>
        </div>

        {error && (
          <div style={{
            background: 'var(--rose-50)',
            border: '1px solid #fecdd3',
            color: 'var(--rose-700)',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1rem',
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--slate-700)', marginBottom: '0.35rem' }}>
              Full Name
            </label>
            <div style={{ position: 'relative' }}>
              <User size={17} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--slate-400)' }} />
              <input
                type="text"
                placeholder="Gaurav Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem 0.65rem 2.4rem',
                  borderRadius: '10px',
                  border: '1px solid var(--slate-300)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--slate-700)', marginBottom: '0.35rem' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={17} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--slate-400)' }} />
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem 0.65rem 2.4rem',
                  borderRadius: '10px',
                  border: '1px solid var(--slate-300)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--slate-700)', marginBottom: '0.35rem' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={17} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--slate-400)' }} />
              <input
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem 0.65rem 2.4rem',
                  borderRadius: '10px',
                  border: '1px solid var(--slate-300)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            style={{ marginTop: '0.5rem' }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              <span>Create Account</span>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.85rem', color: 'var(--slate-500)' }}>
          Already have an account?{' '}
          <button
            onClick={onSwitchToLogin}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary-600)',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
