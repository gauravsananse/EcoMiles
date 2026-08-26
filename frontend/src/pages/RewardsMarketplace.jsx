import React, { useState, useEffect } from 'react';
import {
  Gift,
  Flame,
  Leaf,
  Sparkles,
  ShoppingBag,
  CheckCircle2,
  Lock,
  ArrowRight,
  Copy,
  Check,
  Ticket,
  Clock,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { api } from '../services/api';

export default function RewardsMarketplace({ user, onUserUpdate, onOpenAuth }) {
  const [activeCategory, setActiveCategory] = useState('ALL'); // 'ALL' | 'FITNESS' | 'GREEN' | 'MY_VOUCHERS'
  const [rewards, setRewards] = useState([]);
  const [myRedemptions, setMyRedemptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRedemptions, setIsLoadingRedemptions] = useState(false);
  const [redeemedCode, setRedeemedCode] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    if (activeCategory === 'MY_VOUCHERS') {
      loadMyRedemptions();
    } else {
      loadRewards();
    }
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

  const loadMyRedemptions = async () => {
    if (!user) return;
    setIsLoadingRedemptions(true);
    try {
      const res = await api.getMyRedemptions();
      if (res.success && res.redemptions) {
        setMyRedemptions(res.redemptions);
      }
    } catch (err) {
      console.warn('Failed to load user redemptions:', err.message);
    } finally {
      setIsLoadingRedemptions(false);
    }
  };

  const handleCopyCode = (code) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2500);
    }
  };

  const handleRedeem = async (reward) => {
    if (!user) {
      onOpenAuth('login');
      return;
    }

    const isFitness = reward.pointsType === 'FITNESS_POINTS';
    const userBalance = isFitness ? (user.fitnessPoints || 0) : (user.greenCredits || 0);

    if (userBalance < reward.pointsRequired) {
      alert(`Insufficient ${isFitness ? 'Fitness Points' : 'Green Credits'}. You have ${userBalance}, but need ${reward.pointsRequired}.`);
      return;
    }

    try {
      const res = await api.redeemReward(reward._id);
      if (res.success) {
        const coupon = res.redemption?.voucherCode || res.redemption?.couponCode || `ECO-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        setRedeemedCode({
          reward,
          couponCode: coupon,
          discountValue: reward.discountValue,
        });

        // Update local user state immediately
        if (onUserUpdate && res.updatedBalances) {
          onUserUpdate((prev) => ({
            ...prev,
            fitnessPoints: res.updatedBalances.fitnessPoints,
            greenCredits: res.updatedBalances.greenCredits,
          }));
        } else if (onUserUpdate) {
          onUserUpdate((prev) => ({
            ...prev,
            fitnessPoints: isFitness ? prev.fitnessPoints - reward.pointsRequired : prev.fitnessPoints,
            greenCredits: !isFitness ? prev.greenCredits - reward.pointsRequired : prev.greenCredits,
          }));
        }

        // Refresh redemptions
        loadMyRedemptions();
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
          Redeem verified Green Credits and Fitness Points earned from verified walking, cycling, transit, and registered EV trips.
        </p>
      </div>

      {/* Balances Card */}
      <div className="card" style={{
        maxWidth: '780px',
        margin: '0 auto 2rem',
        background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        textAlign: 'center',
        padding: '1.35rem',
        borderRadius: '16px',
        boxShadow: '0 10px 25px -5px rgba(6, 78, 59, 0.3)',
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#a7f3d0', fontWeight: 700, letterSpacing: '0.05em' }}>
            Your Fitness Points
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '3px' }}>
            <Flame size={22} fill="#f97316" color="#f97316" />
            <span>{user?.fitnessPoints || 0} FP</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.75)', marginTop: '2px' }}>
            Earned from active walking & cycling
          </div>
        </div>

        <div style={{ width: '1px', height: '42px', background: 'rgba(255, 255, 255, 0.2)' }} />

        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#a7f3d0', fontWeight: 700, letterSpacing: '0.05em' }}>
            Your Green Credits
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '3px' }}>
            <Leaf size={22} fill="#a7f3d0" color="#a7f3d0" />
            <span>{user?.greenCredits || 0} GP</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.75)', marginTop: '2px' }}>
            Earned from verified low-carbon trips
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {[
          { id: 'ALL', label: 'All Rewards' },
          { id: 'FITNESS', label: '🔥 Fitness Perks' },
          { id: 'GREEN', label: '🌱 Green Partners' },
          { id: 'MY_VOUCHERS', label: '🎟️ My Vouchers' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveCategory(tab.id);
              setRedeemedCode(null);
            }}
            style={{
              padding: '7px 18px',
              borderRadius: '9999px',
              border: '1px solid var(--slate-200)',
              fontSize: '0.83rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeCategory === tab.id ? 'var(--slate-900)' : '#ffffff',
              color: activeCategory === tab.id ? '#ffffff' : 'var(--slate-600)',
              boxShadow: activeCategory === tab.id ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Redeemed Success Modal / Banner */}
      {redeemedCode && (
        <div className="status-banner success" style={{
          maxWidth: '780px',
          margin: '0 auto 2rem',
          animation: 'fadeIn 0.2s ease',
          padding: '1.25rem',
          borderRadius: '16px',
        }}>
          <CheckCircle2 size={32} className="text-emerald-600" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ fontWeight: 800, fontSize: '1.15rem' }}>
                🎉 Voucher Unlocked: {redeemedCode.reward.title}
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, background: '#ecfdf5', color: '#047857', padding: '2px 8px', borderRadius: '6px' }}>
                {redeemedCode.discountValue}
              </span>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--slate-600)', marginTop: '0.35rem' }}>
              Present this promo code at checkout or copy to your clipboard:
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginTop: '0.75rem',
              background: '#ffffff',
              border: '2px dashed #059669',
              borderRadius: '10px',
              padding: '0.5rem 1rem',
              maxWidth: '380px',
            }}>
              <code style={{ fontSize: '1.1rem', fontWeight: 800, color: '#065f46', letterSpacing: '1px', flex: 1 }}>
                {redeemedCode.couponCode}
              </code>
              <button
                onClick={() => handleCopyCode(redeemedCode.couponCode)}
                className="btn btn-primary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
              >
                {copiedCode === redeemedCode.couponCode ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedCode === redeemedCode.couponCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View: My Vouchers */}
      {activeCategory === 'MY_VOUCHERS' ? (
        <div style={{ maxWidth: '850px', margin: '0 auto' }}>
          {!user ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <Lock size={36} className="text-slate-400" style={{ margin: '0 auto 0.75rem' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--slate-900)' }}>Sign in to View Your Vouchers</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)', marginBottom: '1.25rem' }}>
                Log in to see all your active and redeemed coupon codes.
              </p>
              <button onClick={() => onOpenAuth('login')} className="btn btn-primary">
                Sign In
              </button>
            </div>
          ) : myRedemptions.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <Ticket size={40} className="text-emerald-600" style={{ margin: '0 auto 0.75rem', opacity: 0.7 }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--slate-900)' }}>No Vouchers Redeemed Yet</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)', marginBottom: '1.25rem' }}>
                Use your Fitness Points and Green Credits to unlock discounts from partner brands!
              </p>
              <button onClick={() => setActiveCategory('ALL')} className="btn btn-primary">
                Explore Rewards
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {myRedemptions.map((item) => (
                <div key={item._id} className="card" style={{ borderLeft: '4px solid #059669' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#047857', background: '#ecfdf5', padding: '2px 8px', borderRadius: '9999px' }}>
                      {item.partner}
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                      {item.discountValue}
                    </span>
                  </div>

                  <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--slate-900)', marginBottom: '0.5rem' }}>
                    {item.rewardTitle}
                  </h4>

                  <div style={{
                    background: 'var(--slate-50)',
                    border: '1px solid var(--slate-200)',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '0.75rem',
                  }}>
                    <code style={{ fontSize: '0.95rem', fontWeight: 800, color: '#065f46', fontFamily: 'var(--font-mono)' }}>
                      {item.voucherCode}
                    </code>
                    <button
                      onClick={() => handleCopyCode(item.voucherCode)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: copiedCode === item.voucherCode ? '#059669' : 'var(--slate-500)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      {copiedCode === item.voucherCode ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedCode === item.voucherCode ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <div style={{ fontSize: '0.72rem', color: 'var(--slate-400)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} />
                    <span>Redeemed on {new Date(item.redeemedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* View: Catalog */
        <div style={{
          maxWidth: '850px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.25rem',
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
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                      {r.discountValue}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--slate-900)', marginBottom: '0.25rem' }}>
                    {r.title}
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--slate-500)', marginBottom: '0.6rem', fontWeight: 600 }}>
                    Partner: {r.partner}
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
                    style={{ fontSize: '0.85rem', padding: '0.6rem', justifyContent: 'center' }}
                  >
                    <ShoppingBag size={15} />
                    <span>{canAfford ? 'Redeem Voucher' : `Need ${r.pointsRequired - userBalance} more ${isFitness ? 'FP' : 'GP'}`}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
