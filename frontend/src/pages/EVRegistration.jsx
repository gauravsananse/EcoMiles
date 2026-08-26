import React, { useState, useEffect } from 'react';
import {
  Zap,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Info
} from 'lucide-react';
import VehicleSearch from '../components/VehicleSearch';
import VehicleDetails from '../components/VehicleDetails';
import VerificationStatus from '../components/VerificationStatus';
import RegisteredVehicle from '../components/RegisteredVehicle';
import QRVehicleBinding from '../components/QRVehicleBinding';
import { api } from '../services/api';

export default function EVRegistration({ user, onOpenAuth }) {
  // Verification State Machine
  // 'IDLE' | 'VERIFYING' | 'EV_CONFIRMED' | 'REGISTERED' | 'ERROR'
  const [viewState, setViewState] = useState('IDLE');
  const [errorState, setErrorState] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorVehicleData, setErrorVehicleData] = useState(null);

  // Active verified candidate vehicle
  const [verifiedVehicleData, setVerifiedVehicleData] = useState(null);

  // User's currently bound vehicle
  const [myBoundVehicle, setMyBoundVehicle] = useState(null);
  const [isLoadingBoundVehicle, setIsLoadingBoundVehicle] = useState(false);

  // Action loaders
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRegeneratingQR, setIsRegeneratingQR] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  // QR Modal
  const [showQRModal, setShowQRModal] = useState(false);

  // Fetch user's registered vehicle when user changes
  useEffect(() => {
    if (user) {
      loadMyVehicle();
    } else {
      setMyBoundVehicle(null);
    }
  }, [user]);

  const loadMyVehicle = async () => {
    try {
      setIsLoadingBoundVehicle(true);
      const res = await api.getMyVehicle();
      if (res.success && res.vehicle) {
        setMyBoundVehicle(res.vehicle);
      } else {
        setMyBoundVehicle(null);
      }
    } catch (err) {
      console.error('Failed to load my registered vehicle:', err);
    } finally {
      setIsLoadingBoundVehicle(false);
    }
  };

  // 1. Verify Vehicle against RC Gateway
  const handleVerifyVehicle = async (registrationNumber) => {
    setIsVerifying(true);
    setViewState('VERIFYING');
    setErrorState(null);
    setErrorMessage('');
    setErrorVehicleData(null);
    setVerifiedVehicleData(null);

    try {
      const res = await api.verifyVehicle(registrationNumber);
      if (res.success && res.data) {
        setVerifiedVehicleData(res.data);
        setViewState('EV_CONFIRMED');
      }
    } catch (err) {
      console.error('Vehicle verification failed:', err);
      const errCode = err.errorState || (err.status === 409 ? 'ALREADY_REGISTERED' : 'API_ERROR');
      setErrorState(errCode);
      setErrorMessage(err.data?.error || err.message || 'Failed to verify vehicle.');
      setErrorVehicleData(err.data?.vehicleData || null);
      setViewState('ERROR');
    } finally {
      setIsVerifying(false);
    }
  };

  // 2. Register / Bind Verified EV
  const handleRegisterEV = async (vehiclePayload) => {
    if (!user) {
      onOpenAuth('login');
      return;
    }

    setIsRegistering(true);
    setErrorState(null);

    try {
      const res = await api.registerVehicle({
        registrationNumber: vehiclePayload.registrationNumber,
        manufacturer: vehiclePayload.manufacturer,
        model: vehiclePayload.model,
        fuelType: vehiclePayload.fuelType,
        vehicleClass: vehiclePayload.vehicleClass,
        maskedOwnerName: vehiclePayload.ownerName,
        registrationDate: vehiclePayload.registrationDate,
        verificationSource: vehiclePayload.verificationSource,
      });

      if (res.success && res.vehicle) {
        setMyBoundVehicle(res.vehicle);
        setViewState('REGISTERED');
        setShowQRModal(true); // Automatically open QR Pass upon registration
      }
    } catch (err) {
      console.error('Vehicle registration failed:', err);
      const errCode = err.errorState || (err.status === 409 ? 'ALREADY_REGISTERED' : 'API_ERROR');
      setErrorState(errCode);
      setErrorMessage(err.data?.error || err.message || 'Failed to register vehicle.');
      setViewState('ERROR');
    } finally {
      setIsRegistering(false);
    }
  };

  // 3. Regenerate QR Code
  const handleRegenerateQR = async () => {
    if (!myBoundVehicle) return;
    setIsRegeneratingQR(true);
    try {
      const res = await api.regenerateQR(myBoundVehicle.id || myBoundVehicle._id);
      if (res.success) {
        setMyBoundVehicle((prev) => ({
          ...prev,
          qrToken: res.qrToken,
          qrCreatedAt: res.qrCreatedAt,
          qrDataURL: res.qrDataURL,
        }));
      }
    } catch (err) {
      console.error('Failed to regenerate QR code:', err);
    } finally {
      setIsRegeneratingQR(false);
    }
  };

  // 4. Unlink Vehicle
  const handleUnlinkVehicle = async (vehicleId) => {
    setIsUnlinking(true);
    try {
      const res = await api.unlinkVehicle(vehicleId);
      if (res.success) {
        setMyBoundVehicle(null);
        setVerifiedVehicleData(null);
        setViewState('IDLE');
        setShowQRModal(false);
      }
    } catch (err) {
      console.error('Failed to unlink vehicle:', err);
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleResetSearch = () => {
    setViewState('IDLE');
    setErrorState(null);
    setErrorMessage('');
    setErrorVehicleData(null);
    setVerifiedVehicleData(null);
  };

  return (
    <div className="main-content">
      {/* Page Header */}
      <div className="page-header">
        <div className="badge-tag">
          <Zap size={14} fill="#059669" color="#059669" />
          <span>Green Credits EV Mobility</span>
        </div>
        <h1 className="page-title">Verify Your Electric Vehicle</h1>
        <p className="page-subtitle">
          Register your EV once and securely bind it to your Green Credits account.
        </p>
      </div>

      {/* Already bound vehicle dashboard view */}
      {myBoundVehicle && viewState !== 'EV_CONFIRMED' && (
        <div style={{ marginBottom: '2.5rem' }}>
          <RegisteredVehicle
            vehicle={myBoundVehicle}
            onViewQR={() => setShowQRModal(true)}
            onRegenerateQR={handleRegenerateQR}
            onUnlink={handleUnlinkVehicle}
            isRegenerating={isRegeneratingQR}
            isUnlinking={isUnlinking}
          />
        </div>
      )}

      {/* Success banner after initial registration */}
      {viewState === 'REGISTERED' && (
        <div className="status-banner success" style={{ maxWidth: '640px', margin: '0 auto 2rem' }}>
          <CheckCircle2 size={24} className="text-emerald-600" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.25rem' }}>
              EV Successfully Registered
            </div>
            <div style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
              ✓ Vehicle Verified &nbsp;|&nbsp; ✓ EV Type Confirmed &nbsp;|&nbsp; ✓ Vehicle Bound to Your Account
            </div>
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setShowQRModal(true)}
                className="btn btn-primary"
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
              >
                <QrCode size={15} />
                <span>View Vehicle QR Pass</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Show search form when no vehicle is bound, or allow searching another vehicle */}
      {(!myBoundVehicle || viewState === 'EV_CONFIRMED' || viewState === 'ERROR') && (
        <>
          <VehicleSearch
            onVerify={handleVerifyVehicle}
            isVerifying={isVerifying}
            disabled={viewState === 'EV_CONFIRMED'}
          />

          {/* Verification Status & Errors */}
          {viewState === 'ERROR' && (
            <VerificationStatus
              errorState={errorState}
              message={errorMessage}
              vehicleData={errorVehicleData}
              onReset={handleResetSearch}
            />
          )}

          {/* Verified Vehicle Details Card */}
          {viewState === 'EV_CONFIRMED' && verifiedVehicleData && (
            <>
              <VehicleDetails
                vehicleData={verifiedVehicleData}
                onRegister={handleRegisterEV}
                isRegistering={isRegistering}
                isLoggedIn={Boolean(user)}
                onRequireAuth={() => onOpenAuth('login')}
              />
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button
                  onClick={handleResetSearch}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}
                >
                  Verify Another Plate
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* QR Code Binding Modal */}
      {showQRModal && myBoundVehicle && (
        <QRVehicleBinding
          vehicle={myBoundVehicle}
          onClose={() => setShowQRModal(false)}
          onRegenerate={handleRegenerateQR}
          isRegenerating={isRegeneratingQR}
        />
      )}
    </div>
  );
}
