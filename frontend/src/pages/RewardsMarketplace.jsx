import React, { useState, useEffect } from 'react';
import {
  Gift,
  Flame,
  Leaf,
  Sparkles,
  ShoppingBag,
  CheckCircle2,
  Lock,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';

export default function RewardsMarketplace({ user, onUserUpdate, onOpenAuth }) {
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [rewards, setRewards] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [redeemedCode, setRedeemedCode] = useState(null);

  useEffect(() => {
    loadRewards();
  }, [activeCategory]);

  const loadRewards = async () => {
    setIsLoading(true);
    try {
      const cat = activeCategory === 'ALL' ? null : activeCategory;
      const res = await api.getRewards(cat);
      if (res.success && res.rewards) {
        setRewards(res.rewards);
      }
    } catch (err) {
      console.error('Failed to load rewards:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRedeem = async (reward) => {
    if (!user) {
      onOpenAuth('login');
      return;
    }

    try {
      const res = await api.redeemReward(reward._id);
      if (res.success) {
        setRedeemedCode({
          reward,
          couponCode: res.redemption?.couponCode || `ECO-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        });
        if (onUserUpdate && res.updatedUser) {
          onUserUpdate((prev) => ({
            ...prev,
            ...res.updatedUser,
          }));
        }
      }
    } catch (err) {
      alert(err.message || 'Failed to redeem reward.');
    }
  };

  return (
    <div className="main-content">
      <div className="page-header">
        <div className="badge-tag">
          <Gift size={14} fill="#f59e0b" color="#f59e0b" />
          <span>Dual Economy Marketplace</span>
        </div>
        <h1 className="page-title">Green Credits & Fitness Rewards Store</h1>
        <p className="page-subtitle">
          Redeem verified Green Credits and Fitness Points earned from active commutes, cycling, walking, transit, and registered EV trips.
        </p>
      </div>

      {/* Balances Card */}
      <div className="card" style={{
        maxWidth: '720px',
        margin: '0 auto 2rem',
        background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        textAlign: 'center',
        padding: '1.25rem',
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#a7f3d0', fontWeight: 700 }}>
            Your Fitness Points
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginTop: '2px' }}>
            <Flame size={20} fill="#f97316" color="#f97316" />
            <span>{user?.fitnessPoints || 0} FP</span>
          </div>
        </div>

        <div style={{ width: '1px', height: '36px', background: 'rgba(255, 255, 255, 0.2)' }} />

        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#a7f3d0', fontWeight: 700 }}>
            Your Green Credits
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginTop: '2px' }}>
            <Leaf size={20} fill="#a7f3d0" color="#a7f3d0" />
            <span>{user?.greenCredits || 0} GP</span>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
        {['ALL', 'FITNESS', 'GREEN'].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '6px 16px',
              borderRadius: '9999px',
              border: '1px solid var(--slate-200)',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeCategory === cat ? 'var(--slate-900)' : '#ffffff',
              color: activeCategory === cat ? '#ffffff' : 'var(--slate-600)',
            }}
          >
            {cat === 'ALL' ? 'All Rewards' : (cat === 'FITNESS' ? '🔥 Fitness Perks' : '🌱 Green Transit')}
          </button>
        ))}
      </div>

      {/* Redeemed Success Modal */}
      {redeemedCode && (
        <div className="status-banner success" style={{ maxWidth: '640px', margin: '0 auto 2rem' }}>
          <CheckCircle2 size={24} className="text-emerald-600" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>
              Voucher Unlocked: {redeemedCode.reward.title}
            </div>
            <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Coupon Code: <code style={{ background: '#ffffff', padding: '2px 8px', borderRadius: '6px', fontWeight: 800, color: '#059669', border: '1px solid #a7f3d0' }}>{redeemedCode.couponCode}</code>
            </div>
          </div>
        </div>
      )}

      {/* Rewards Grid */}
      <div style={{
        maxWidth: '850px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1rem',
      }}>
        {rewards.map((r) => {
          const isFitness = r.pointsType === 'FITNESS_POINTS';
          const userBalance = isFitness ? (user?.fitnessPoints || 0) : (user?.greenCredits || 0);
          const canAfford = userBalance >= r.pointsRequired;

          return (
            <div key={r._id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    background: isFitness ? '#ffedd5' : '#ecfdf5',
                    color: isFitness ? '#c2410c' : '#047857',
                  }}>
                    {r.badgeText || (isFitness ? 'Fitness' : 'Eco Partner')}
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                    {r.discountValue}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--slate-900)', marginBottom: '0.25rem' }}>
                  {r.title}
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--slate-500)', marginBottom: '0.6rem' }}>
                  {r.partner}
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--slate-600)', lineHeight: 1.4, marginBottom: '1rem' }}>
                  {r.description}
                </p>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Required:</span>
                  <span style={{ fontWeight: 800, color: isFitness ? '#ea580c' : '#059669', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    {isFitness ? <Flame size={14} fill="#ea580c" /> : <Leaf size={14} fill="#059669" />}
                    {r.pointsRequired} {isFitness ? 'FP' : 'GP'}
                  </span>
                </div>

                <button
                  onClick={() => handleRedeem(r)}
                  className={`btn ${canAfford ? 'btn-primary' : 'btn-secondary'} btn-full`}
                  style={{ fontSize: '0.82rem' }}
                >
                  <ShoppingBag size={14} />
                  <span>Redeem Voucher</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
