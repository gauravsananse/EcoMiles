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
  ChevronRight,
  X,
  AlertCircle,
  ShoppingCart,
  TreePine,
  Dumbbell,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../i18n/I18nContext';

// Comprehensive 8-Partner Initial / Fallback Catalog with exact real partner destinations
const DEFAULT_REWARDS = [
  // 1. Fast&Up (Fitness / Nutrition)
  {
    _id: 'reward-fastandup-01',
    title: 'Fast&Up Plant Protein & Hydration Electrolytes',
    category: 'FITNESS',
    subcategory: 'Nutrition',
    partner: 'Fast&Up',
    discountValue: 'Flat ₹300 OFF',
    pointsRequired: 50,
    pointsType: 'FITNESS_POINTS',
    description: 'Premium vegan protein powders and effervescent daily electrolytes.',
    voucherCode: 'GREENFAST300',
    partnerUrl: 'https://in.fastandup.com/',
    buttonText: 'Shop at Fast&Up',
    badgeText: 'Nutrition',
    iconType: 'bottle',
    expiryDate: '30 Sep 2026',
    isActive: true,
  },
  // 2. Decathlon (Fitness / Sports & Cycling)
  {
    _id: 'reward-decathlon-02',
    title: 'Decathlon Sportswear & Cycling Accessories',
    category: 'FITNESS',
    subcategory: 'Sports & Cycling',
    partner: 'Decathlon',
    discountValue: '25% OFF',
    pointsRequired: 60,
    pointsType: 'FITNESS_POINTS',
    description: 'Get flat 25% off on activewear, running shoes, and cycling helmets.',
    voucherCode: 'GREENDECATH25',
    partnerUrl: 'https://www.decathlon.in/',
    buttonText: 'Shop at Decathlon',
    badgeText: 'Sports & Cycling',
    iconType: 'cycling',
    expiryDate: '30 Sep 2026',
    isActive: true,
  },
  // 3. Cult.fit (Fitness / Gym Pass)
  {
    _id: 'reward-cultfit-03',
    title: 'Cult.fit 1-Month All-Access Gym Pass',
    category: 'FITNESS',
    subcategory: 'Fitness Perks',
    partner: 'cult.fit',
    discountValue: '₹750 OFF',
    pointsRequired: 80,
    pointsType: 'FITNESS_POINTS',
    description: 'Valid across 300+ Cult centers for strength, cardio, and yoga sessions.',
    voucherCode: 'GREENCULT750',
    partnerUrl: 'https://www.cult.fit/',
    buttonText: 'Get Cult.fit Pass',
    badgeText: 'Fitness Perks',
    iconType: 'gym',
    expiryDate: '30 Sep 2026',
    isActive: true,
  },
  // 4. Amazon India (Fitness / Shopping)
  {
    _id: 'reward-amazon-04',
    title: 'Amazon India – Eco & Fitness Essentials',
    category: 'FITNESS',
    subcategory: 'Fitness Perks',
    partner: 'Amazon India',
    discountValue: '₹200 Amazon Gift Voucher',
    pointsRequired: 70,
    pointsType: 'FITNESS_POINTS',
    description: 'Redeem for sports gear, gym accessories, yoga mats, and organic fitness foods.',
    voucherCode: 'GREENAMAZON200',
    partnerUrl: 'https://www.amazon.in/',
    buttonText: 'Shop on Amazon',
    badgeText: 'Shopping Partner',
    iconType: 'shopping',
    expiryDate: '30 Sep 2026',
    isActive: true,
  },
  // 5. Myntra (Green / Sustainable Fashion)
  {
    _id: 'reward-myntra-05',
    title: 'Myntra Sustainable Cotton & Eco-Apparel',
    category: 'GREEN',
    subcategory: 'Sustainable Fashion',
    partner: 'Myntra',
    discountValue: '₹500 OFF',
    pointsRequired: 75,
    pointsType: 'GREEN_CREDITS',
    description: 'Organic certified cotton apparel and recycled fiber sustainable clothing.',
    voucherCode: 'GREENMYNTRA500',
    partnerUrl: 'https://www.myntra.com/',
    buttonText: 'Shop at Myntra',
    badgeText: 'Sustainable Fashion',
    iconType: 'fashion',
    expiryDate: '30 Sep 2026',
    isActive: true,
  },
  // 6. SankalpTaru (Green / Climate Action)
  {
    _id: 'reward-sankalp-06',
    title: 'SankalpTaru – Plant a Tree in Your Name with Geo-Tag',
    category: 'GREEN',
    subcategory: 'Climate Action',
    partner: 'SankalpTaru Foundation',
    discountValue: '1 Free Geo-Tagged Tree',
    pointsRequired: 90,
    pointsType: 'GREEN_CREDITS',
    description: 'Sponsor a live fruit-bearing tree planted in rural India with GPS tracking and certificate.',
    voucherCode: 'GREENSANKALP',
    partnerUrl: 'https://sankalptaru.org/',
    buttonText: 'Plant My Tree',
    badgeText: 'Climate Action',
    iconType: 'plant',
    expiryDate: '30 Sep 2026',
    isActive: true,
  },
  // 7. BECO (Green / Eco Products)
  {
    _id: 'reward-beco-07',
    title: 'Beco 100% Bamboo Eco-Stationery & Living Kit',
    category: 'GREEN',
    subcategory: 'Eco Products',
    partner: 'BECO',
    discountValue: '40% OFF',
    pointsRequired: 50,
    pointsType: 'GREEN_CREDITS',
    description: 'Zero-plastic bamboo home essentials, eco-stationery, and reusable living kits.',
    voucherCode: 'GREENBECO40',
    partnerUrl: 'https://www.letsbeco.com/',
    buttonText: 'Shop at BECO',
    badgeText: 'Eco Products',
    iconType: 'leaf',
    expiryDate: '30 Sep 2026',
    isActive: true,
  },
  // 8. Flipkart (Green / Eco Products)
  {
    _id: 'reward-flipkart-08',
    title: 'Flipkart Sports, Fitness & Eco-Living Store',
    category: 'GREEN',
    subcategory: 'Eco Products',
    partner: 'Flipkart',
    discountValue: '₹150 OFF Voucher',
    pointsRequired: 50,
    pointsType: 'GREEN_CREDITS',
    description: 'Redeem across Sports & Fitness, Food & Health, and eco-friendly household goods.',
    voucherCode: 'GREENFLIP150',
    partnerUrl: 'https://www.flipkart.com/',
    buttonText: 'Shop on Flipkart',
    badgeText: 'Eco Retail',
    iconType: 'shopping',
    expiryDate: '30 Sep 2026',
    isActive: true,
  },
];

export default function RewardsMarketplace({ user, onUserUpdate, onOpenAuth }) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState('ALL'); // 'ALL' | 'FITNESS' | 'GREEN' | 'MY_VOUCHERS'
  const [rewards, setRewards] = useState(DEFAULT_REWARDS);
  const [myRedemptions, setMyRedemptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRedemptions, setIsLoadingRedemptions] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  // Active Voucher Modal State
  const [activeModalVoucher, setActiveModalVoucher] = useState(null);

  // Insufficient Points Modal State
  const [insufficientPointsModal, setInsufficientPointsModal] = useState(null);

  // Quick success toast
  const [successToast, setSuccessToast] = useState(null);

  // Load redemptions from localStorage / API on mount
  useEffect(() => {
    loadLocalRedemptions();
    loadRewards();
    if (user) {
      loadMyRedemptions();
    }
  }, [user]);

  useEffect(() => {
    if (activeCategory === 'MY_VOUCHERS') {
      loadMyRedemptions();
    } else {
      loadRewards();
    }
  }, [activeCategory]);

  const loadLocalRedemptions = () => {
    try {
      const stored = localStorage.getItem('greencredits_my_redemptions');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMyRedemptions(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load local redemptions:', e);
    }
  };

  const saveLocalRedemptions = (newList) => {
    try {
      localStorage.setItem('greencredits_my_redemptions', JSON.stringify(newList));
    } catch (e) {
      console.warn('Failed to save local redemptions:', e);
    }
  };

  const loadRewards = async () => {
    setIsLoading(true);
    try {
      const cat = activeCategory === 'ALL' ? null : activeCategory;
      const res = await api.getRewards(cat);
      if (res && res.success && res.rewards && res.rewards.length > 0) {
        setRewards(res.rewards);
      } else {
        // Filter default rewards if offline
        const filtered = activeCategory === 'ALL'
          ? DEFAULT_REWARDS
          : DEFAULT_REWARDS.filter((r) => r.category === activeCategory);
        setRewards(filtered);
      }
    } catch (err) {
      console.warn('Using local rewards catalog:', err.message);
      const filtered = activeCategory === 'ALL'
        ? DEFAULT_REWARDS
        : DEFAULT_REWARDS.filter((r) => r.category === activeCategory);
      setRewards(filtered);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMyRedemptions = async () => {
    if (!user) return;
    setIsLoadingRedemptions(true);
    try {
      const res = await api.getMyRedemptions();
      if (res && res.success && res.redemptions && res.redemptions.length > 0) {
        setMyRedemptions(res.redemptions);
        saveLocalRedemptions(res.redemptions);
      }
    } catch (err) {
      console.warn('Failed to load user redemptions from server, using local:', err.message);
      loadLocalRedemptions();
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

  // Check if a specific reward has already been redeemed
  const getExistingRedemption = (reward) => {
    return myRedemptions.find(
      (item) =>
        (item.rewardId && (item.rewardId === reward._id || item.rewardId._id === reward._id)) ||
        (item.rewardTitle && item.rewardTitle.toLowerCase() === reward.title.toLowerCase()) ||
        (item.partner && item.partner.toLowerCase() === reward.partner.toLowerCase())
    );
  };

  // Open Partner Website in a NEW browser tab with tracking
  const handleShopNow = (partnerUrl, reward, voucherCode) => {
    const targetUrl = partnerUrl || reward.partnerUrl || 'https://in.fastandup.com/';
    const targetPartner = reward.partner || 'Partner';
    const targetCode = voucherCode || reward.voucherCode || 'GREENCREDIT';

    // 1. Record Click Tracking Event
    const clickEvent = {
      userId: user?._id || user?.id || 'demo-user',
      rewardId: reward._id || 'reward-demo',
      partner: targetPartner,
      voucherCode: targetCode,
      clickedAt: new Date().toISOString(),
      action: 'partner_redirect',
    };

    console.log('[PartnerClickTracked]', clickEvent);
    api.trackPartnerClick(clickEvent).catch(() => {});

    // 2. Open Partner URL in NEW Tab safely
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  // Handle Voucher Redemption
  const handleRedeem = async (reward) => {
    if (!user) {
      onOpenAuth('login');
      return;
    }

    // 1. Check if already redeemed
    const alreadyRedeemedItem = getExistingRedemption(reward);
    if (alreadyRedeemedItem) {
      // Reopen existing voucher modal directly
      setActiveModalVoucher({
        reward,
        voucherCode: alreadyRedeemedItem.voucherCode || reward.voucherCode,
        discountValue: alreadyRedeemedItem.discountValue || reward.discountValue,
        partnerUrl: alreadyRedeemedItem.partnerUrl || reward.partnerUrl,
        buttonText: alreadyRedeemedItem.buttonText || reward.buttonText,
        expiryDate: alreadyRedeemedItem.expiryDate || reward.expiryDate || '30 Sep 2026',
        pointsDeducted: alreadyRedeemedItem.pointsSpent || reward.pointsRequired,
        pointsType: alreadyRedeemedItem.pointsType || reward.pointsType,
        isExisting: true,
      });
      return;
    }

    // 2. Check Point Balances
    const isFitness = reward.pointsType === 'FITNESS_POINTS';
    const userBalance = isFitness ? (user.fitnessPoints || 0) : (user.greenCredits || 0);

    if (userBalance < reward.pointsRequired) {
      setInsufficientPointsModal({
        reward,
        needed: reward.pointsRequired,
        current: userBalance,
        pointsType: isFitness ? 'FP' : 'GP',
        pointsLabel: isFitness ? 'Fitness Points' : 'Green Credits',
      });
      return;
    }

    try {
      let finalVoucherCode = reward.voucherCode || `GREEN-${reward.partner.substring(0, 4).toUpperCase()}`;
      let newFP = user.fitnessPoints || 0;
      let newGP = user.greenCredits || 0;

      // Try Backend API
      try {
        const res = await api.redeemReward(reward._id);
        if (res && res.success) {
          if (res.redemption && res.redemption.voucherCode) {
            finalVoucherCode = res.redemption.voucherCode;
          }
          if (res.updatedBalances) {
            newFP = res.updatedBalances.fitnessPoints;
            newGP = res.updatedBalances.greenCredits;
          } else {
            newFP = isFitness ? Math.max(0, newFP - reward.pointsRequired) : newFP;
            newGP = !isFitness ? Math.max(0, newGP - reward.pointsRequired) : newGP;
          }
        } else {
          // Local deduction fallback
          newFP = isFitness ? Math.max(0, newFP - reward.pointsRequired) : newFP;
          newGP = !isFitness ? Math.max(0, newGP - reward.pointsRequired) : newGP;
        }
      } catch (apiErr) {
        console.warn('API redemption fallback to local point deduction:', apiErr.message);
        newFP = isFitness ? Math.max(0, newFP - reward.pointsRequired) : newFP;
        newGP = !isFitness ? Math.max(0, newGP - reward.pointsRequired) : newGP;
      }

      // Update User Balance in State / Parent
      if (onUserUpdate) {
        onUserUpdate((prev) => ({
          ...prev,
          fitnessPoints: newFP,
          greenCredits: newGP,
        }));
      }

      // Create local redemption entry
      const newRedemptionEntry = {
        _id: `redemption-${Date.now()}`,
        userId: user._id || user.id || 'demo-user',
        rewardId: reward._id,
        rewardTitle: reward.title,
        partner: reward.partner,
        discountValue: reward.discountValue,
        category: reward.category,
        voucherCode: finalVoucherCode,
        partnerUrl: reward.partnerUrl,
        buttonText: reward.buttonText,
        pointsSpent: reward.pointsRequired,
        pointsType: reward.pointsType,
        expiryDate: reward.expiryDate || '30 Sep 2026',
        redeemedAt: new Date().toISOString(),
      };

      const updatedRedemptions = [newRedemptionEntry, ...myRedemptions];
      setMyRedemptions(updatedRedemptions);
      saveLocalRedemptions(updatedRedemptions);

      // Brief flash animation
      setSuccessToast(`Voucher Unlocked 🎉: ${reward.discountValue} at ${reward.partner}`);
      setTimeout(() => setSuccessToast(null), 3000);

      // Open Centered Premium Voucher Modal
      setActiveModalVoucher({
        reward,
        voucherCode: finalVoucherCode,
        discountValue: reward.discountValue,
        partnerUrl: reward.partnerUrl,
        buttonText: reward.buttonText,
        expiryDate: reward.expiryDate || '30 Sep 2026',
        pointsDeducted: reward.pointsRequired,
        pointsType: isFitness ? 'FP' : 'GP',
        remainingFP: newFP,
        remainingGP: newGP,
        isExisting: false,
      });
    } catch (err) {
      alert(err.message || 'Failed to redeem voucher. Please try again.');
    }
  };

  return (
    <div className="main-content" style={{ position: 'relative' }}>
      {/* Page Header */}
      <div className="page-header">
        <div className="badge-tag">
          <Gift size={14} fill="#f59e0b" color="#f59e0b" />
          <span>{t('rewards.badge')}</span>
        </div>
        <h1 className="page-title">{t('rewards.title')}</h1>
        <p className="page-subtitle">
          {t('rewards.subtitle')}
        </p>
      </div>

      {/* Success Banner Notification */}
      {successToast && (
        <div style={{
          maxWidth: '780px',
          margin: '0 auto 1.5rem',
          background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
          color: '#ffffff',
          borderRadius: '12px',
          padding: '0.85rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 8px 20px rgba(5, 150, 105, 0.25)',
          animation: 'fadeIn 0.3s ease',
          fontSize: '0.9rem',
          fontWeight: 700,
        }}>
          <CheckCircle2 size={20} className="text-white" />
          <span>{successToast}</span>
        </div>
      )}

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
            {t('rewards.fitnessBalance')}
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '3px' }}>
            <Flame size={22} fill="#f97316" color="#f97316" />
            <span>{user?.fitnessPoints || 0} FP</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.75)', marginTop: '2px' }}>
            {t('tracker.fitnessPointsEarned')}
          </div>
        </div>

        <div style={{ width: '1px', height: '42px', background: 'rgba(255, 255, 255, 0.2)' }} />

        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#a7f3d0', fontWeight: 700, letterSpacing: '0.05em' }}>
            {t('rewards.greenBalance')}
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '3px' }}>
            <Leaf size={22} fill="#a7f3d0" color="#a7f3d0" />
            <span>{user?.greenCredits || 0} GP</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.75)', marginTop: '2px' }}>
            {t('tracker.greenCreditsEarned')}
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {[
          { id: 'ALL', label: t('rewards.allRewards') },
          { id: 'FITNESS', label: `🔥 ${t('rewards.fitnessPerks')}` },
          { id: 'GREEN', label: `🌱 ${t('rewards.sustainablePerks')}` },
          { id: 'MY_VOUCHERS', label: `🎟️ ${t('rewards.unlockedVoucher')} (${myRedemptions.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id)}
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

      {/* VIEW: My Vouchers */}
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
                Use your Fitness Points and Green Credits to unlock discounts from partner brands like Fast&Up, Decathlon, Cult.fit, and more!
              </p>
              <button onClick={() => setActiveCategory('ALL')} className="btn btn-primary">
                Explore Rewards
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {myRedemptions.map((item) => (
                <div key={item._id} className="card" style={{ borderLeft: '4px solid #059669', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
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

                    {/* Voucher Code Box */}
                    <div style={{
                      background: '#f8fafc',
                      border: '1.5px dashed #059669',
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
                          gap: '3px',
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

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button
                      onClick={() => {
                        const matchedReward = rewards.find((r) => r.partner === item.partner || r.title === item.rewardTitle) || {
                          title: item.rewardTitle,
                          partner: item.partner,
                          discountValue: item.discountValue,
                          partnerUrl: item.partnerUrl || 'https://in.fastandup.com/',
                          buttonText: item.buttonText || 'Shop Now',
                          pointsRequired: item.pointsSpent || 50,
                          pointsType: item.pointsType || 'FITNESS_POINTS',
                        };
                        setActiveModalVoucher({
                          reward: matchedReward,
                          voucherCode: item.voucherCode,
                          discountValue: item.discountValue,
                          partnerUrl: item.partnerUrl || matchedReward.partnerUrl,
                          buttonText: item.buttonText || matchedReward.buttonText,
                          expiryDate: item.expiryDate || '30 Sep 2026',
                          pointsDeducted: item.pointsSpent || matchedReward.pointsRequired,
                          pointsType: item.pointsType === 'GREEN_CREDITS' ? 'GP' : 'FP',
                          isExisting: true,
                        });
                      }}
                      className="btn btn-secondary"
                      style={{ flex: 1, fontSize: '0.78rem', padding: '0.45rem 0.5rem', justifyContent: 'center' }}
                    >
                      <Ticket size={13} />
                      <span>View Voucher</span>
                    </button>

                    <button
                      onClick={() => handleShopNow(item.partnerUrl, { partner: item.partner, _id: item.rewardId }, item.voucherCode)}
                      className="btn btn-primary"
                      style={{ flex: 1, fontSize: '0.78rem', padding: '0.45rem 0.5rem', justifyContent: 'center' }}
                    >
                      <ExternalLink size={13} />
                      <span>{item.buttonText || 'Shop Again'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* VIEW: Catalog */
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
            const alreadyRedeemed = getExistingRedemption(r);

            return (
              <div key={r._id || r.title} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: alreadyRedeemed ? '1.5px solid #a7f3d0' : '1px solid var(--slate-200)' }}>
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
                    Partner: <span style={{ color: 'var(--slate-800)', fontWeight: 700 }}>{r.partner}</span>
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

                  {alreadyRedeemed ? (
                    <button
                      onClick={() => handleRedeem(r)}
                      className="btn btn-secondary btn-full"
                      style={{
                        fontSize: '0.85rem',
                        padding: '0.6rem',
                        justifyContent: 'center',
                        background: '#ecfdf5',
                        color: '#047857',
                        borderColor: '#a7f3d0',
                        fontWeight: 700,
                      }}
                    >
                      <CheckCircle2 size={15} color="#059669" />
                      <span>✓ Redeemed • View Voucher</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRedeem(r)}
                      className={`btn ${canAfford ? 'btn-primary' : 'btn-secondary'} btn-full`}
                      style={{ fontSize: '0.85rem', padding: '0.6rem', justifyContent: 'center' }}
                    >
                      <ShoppingBag size={15} />
                      <span>{canAfford ? 'Redeem Voucher' : `Need ${r.pointsRequired - userBalance} more ${isFitness ? 'FP' : 'GP'}`}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. PROFESSIONAL CENTERED VOUCHER UNLOCKED MODAL                           */}
      {/* ========================================================================= */}
      {activeModalVoucher && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            maxWidth: '520px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--slate-200)',
            position: 'relative',
            padding: '1.75rem',
            animation: 'scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            {/* Modal Close Button */}
            <button
              onClick={() => setActiveModalVoucher(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'var(--slate-100)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--slate-600)',
              }}
              title="Close"
            >
              <X size={18} />
            </button>

            {/* Header Badge */}
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#ecfdf5',
                color: '#047857',
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '0.8rem',
                fontWeight: 800,
                marginBottom: '0.5rem',
              }}>
                <Leaf size={14} fill="#059669" />
                <span>{activeModalVoucher.isExisting ? 'Voucher Unlocked 🎟️' : 'Voucher Redeemed Successfully 🎉'}</span>
              </div>

              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)', marginTop: '4px', lineHeight: 1.3 }}>
                {activeModalVoucher.reward.title}
              </h2>
              <div style={{ fontSize: '0.82rem', color: 'var(--slate-500)', marginTop: '2px' }}>
                Partner: <strong style={{ color: 'var(--slate-800)' }}>{activeModalVoucher.reward.partner}</strong>
              </div>
            </div>

            {/* Discount Highlight Card */}
            <div style={{
              background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
              color: '#ffffff',
              borderRadius: '14px',
              padding: '1rem',
              textAlign: 'center',
              marginBottom: '1.25rem',
              boxShadow: '0 6px 16px rgba(4, 120, 87, 0.25)',
            }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a7f3d0', fontWeight: 700 }}>
                Exclusive Benefit
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '2px', letterSpacing: '-0.5px' }}>
                {activeModalVoucher.discountValue}
              </div>
              {!activeModalVoucher.isExisting && activeModalVoucher.pointsDeducted && (
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)', marginTop: '4px' }}>
                  ✓ {activeModalVoucher.pointsDeducted} {activeModalVoucher.pointsType} deducted from balance
                </div>
              )}
            </div>

            {/* Voucher Code Box */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-600)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Your Unique Voucher Code:
              </div>

              <div style={{
                background: '#f8fafc',
                border: '2px dashed #059669',
                borderRadius: '12px',
                padding: '0.75rem 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
              }}>
                <code style={{
                  fontSize: '1.25rem',
                  fontWeight: 900,
                  color: '#065f46',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '1.5px',
                  userSelect: 'all',
                }}>
                  {activeModalVoucher.voucherCode}
                </code>

                <button
                  type="button"
                  onClick={() => handleCopyCode(activeModalVoucher.voucherCode)}
                  className="btn btn-primary"
                  style={{
                    padding: '0.45rem 0.9rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    whiteSpace: 'nowrap',
                    background: copiedCode === activeModalVoucher.voucherCode ? '#047857' : '#059669',
                  }}
                >
                  {copiedCode === activeModalVoucher.voucherCode ? (
                    <>
                      <Check size={15} />
                      <span>✓ Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={15} />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>

              <div style={{ fontSize: '0.73rem', color: 'var(--slate-500)', marginTop: '0.35rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>Valid until: <strong>{activeModalVoucher.expiryDate}</strong></span>
                <span style={{ color: '#047857', fontWeight: 600 }}>100% Verified Code</span>
              </div>
            </div>

            {/* Primary Action Button: Opens Partner Website in NEW tab */}
            <div style={{ marginBottom: '1.5rem' }}>
              <button
                type="button"
                onClick={() => handleShopNow(activeModalVoucher.partnerUrl, activeModalVoucher.reward, activeModalVoucher.voucherCode)}
                className="btn btn-primary btn-full"
                style={{
                  padding: '0.75rem',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  borderRadius: '12px',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  boxShadow: '0 6px 16px rgba(5, 150, 105, 0.3)',
                }}
              >
                <ShoppingCart size={18} />
                <span>{activeModalVoucher.buttonText || `Shop at ${activeModalVoucher.reward.partner}`}</span>
                <ExternalLink size={15} style={{ marginLeft: '4px', opacity: 0.8 }} />
              </button>
            </div>

            {/* 6-Step Usage Instructions */}
            <div style={{
              background: 'var(--slate-50)',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              border: '1px solid var(--slate-200)',
              marginBottom: '1rem',
            }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--slate-800)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Tag size={14} className="text-emerald-600" />
                <span>How to use this voucher:</span>
              </div>
              <ol style={{ fontSize: '0.78rem', color: 'var(--slate-600)', margin: 0, paddingLeft: '1.2rem', lineHeight: 1.5 }}>
                <li>Copy the voucher code above.</li>
                <li>Click <strong>“{activeModalVoucher.buttonText || `Shop at ${activeModalVoucher.reward.partner}`}”</strong> to open partner platform.</li>
                <li>Select an eligible product or service.</li>
                <li>Add it to your shopping cart.</li>
                <li>Enter the voucher code <strong>{activeModalVoucher.voucherCode}</strong> at checkout.</li>
                <li>Complete your purchase and enjoy your GreenCredits discount!</li>
              </ol>
            </div>

            {/* Prototype Notice */}
            <div style={{ fontSize: '0.7rem', color: 'var(--slate-400)', textAlign: 'center', fontStyle: 'italic' }}>
              Prototype Demo Notice: Demonstration voucher codes. Real partner-issued coupons replace demo codes in live deployment.
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. NOT ENOUGH POINTS MODAL                                                */}
      {/* ========================================================================= */}
      {insufficientPointsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            maxWidth: '420px',
            width: '100%',
            padding: '1.75rem',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--slate-200)',
            position: 'relative',
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#fef2f2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}>
              <AlertCircle size={28} />
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)', marginBottom: '0.5rem' }}>
              Not Enough Points
            </h3>

            <p style={{ fontSize: '0.85rem', color: 'var(--slate-600)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              You need <strong>{insufficientPointsModal.needed} {insufficientPointsModal.pointsType}</strong> to redeem{' '}
              <strong>{insufficientPointsModal.reward.title}</strong>, but you currently have{' '}
              <strong style={{ color: '#dc2626' }}>{insufficientPointsModal.current} {insufficientPointsModal.pointsType}</strong>.
            </p>

            <div style={{
              background: '#f8fafc',
              borderRadius: '10px',
              padding: '0.75rem',
              marginBottom: '1.25rem',
              fontSize: '0.8rem',
              color: 'var(--slate-600)',
            }}>
              💡 <em>Take a verified walk, cycling ride, or EV journey in the Mobility Tracker to earn more {insufficientPointsModal.pointsLabel}!</em>
            </div>

            <button
              onClick={() => setInsufficientPointsModal(null)}
              className="btn btn-primary btn-full"
              style={{ justifyContent: 'center', padding: '0.65rem' }}
            >
              Continue Earning
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

