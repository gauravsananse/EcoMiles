import React, { useState, useEffect } from 'react';
import { sensorManager } from '../services/sensorManager';
import { cyclingVerificationEngine } from '../services/cyclingVerificationEngine';
import { walkingVerificationService } from '../services/walkingVerificationService';
import { stepCountingEngine } from '../services/stepCountingEngine';

export const VerificationDebugPanel = ({ currentMode = 'WALK' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [metrics, setMetrics] = useState({});

  useEffect(() => {
    const updateMetrics = () => {
      const mode = (currentMode || '').toUpperCase();
      const isCycling = mode === 'CYCLING';

      if (isCycling) {
        setMetrics(cyclingVerificationEngine.getDebugMetrics());
      } else {
        const counts = stepCountingEngine.getCounts();
        setMetrics(
          walkingVerificationService.getDebugMetrics(
            counts.sessionSteps,
            counts.baselineSteps,
            counts.rawSteps
          )
        );
      }
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 400);
    return () => clearInterval(interval);
  }, [currentMode]);

  const isCycling = (currentMode || '').toUpperCase() === 'CYCLING';

  return (
    <div className="fixed bottom-4 left-4 z-50 font-mono text-xs max-w-sm w-full">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between w-full px-3 py-2 bg-slate-900/90 text-emerald-400 border border-emerald-500/40 rounded-t-lg shadow-xl hover:bg-slate-900 transition-all"
      >
        <span className="flex items-center gap-2 font-bold tracking-wide">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          DEV DEBUG: {isCycling ? 'CYCLING ENGINE' : 'WALKING ENGINE'}
        </span>
        <span className="text-slate-400">{isOpen ? '▼ Hide' : '▲ Open'}</span>
      </button>

      {/* Panel Body */}
      {isOpen && (
        <div className="bg-slate-950/95 text-slate-200 border-x border-b border-emerald-500/30 rounded-b-lg p-3.5 space-y-2 shadow-2xl backdrop-blur-md max-h-96 overflow-y-auto">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800 text-[11px]">
            <span className="text-slate-400">Activity Mode:</span>
            <span className="font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60">
              {metrics.activityMode || currentMode}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            <div>
              <span className="text-slate-400">GPS Accuracy:</span>
              <p className="font-semibold text-white">{metrics.gpsAccuracy || 'N/A'}</p>
            </div>
            <div>
              <span className="text-slate-400">GPS Speed:</span>
              <p className="font-semibold text-white">{metrics.gpsSpeed || '0.0 km/h'}</p>
            </div>
            <div>
              <span className="text-slate-400">Calc Speed:</span>
              <p className="font-semibold text-white">{metrics.calculatedSpeed || '0.0 km/h'}</p>
            </div>
            <div>
              <span className="text-slate-400">GPS Distance:</span>
              <p className="font-semibold text-white">{metrics.gpsDistance || '0.000 km'}</p>
            </div>
            <div>
              <span className="text-slate-400">Accelerometer:</span>
              <p className="font-semibold text-emerald-300">{metrics.accelerometerAvailable || 'No'}</p>
            </div>
            <div>
              <span className="text-slate-400">Gyroscope:</span>
              <p className="font-semibold text-emerald-300">{metrics.gyroscopeAvailable || 'No'}</p>
            </div>
          </div>

          {/* Mode-Specific Metrics */}
          {isCycling ? (
            <div className="pt-2 border-t border-slate-800 space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Cycling Confidence:</span>
                <span className="font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                  {metrics.cyclingConfidence || '0%'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Verification State:</span>
                <span className="font-semibold text-yellow-300">{metrics.verificationState || 'NOT VERIFIED'}</span>
              </div>
              <div className="flex justify-between items-center text-rose-400">
                <span className="text-slate-400">Walking Confidence:</span>
                <span className="font-mono font-bold bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800/40">
                  {metrics.walkingConfidence === null ? 'NULL (Strictly Locked)' : 'ERROR: NOT NULL'}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Session Steps:</span>
                <span className="font-mono text-slate-500">{metrics.sessionSteps || 'DISABLED'}</span>
              </div>
              <div className="text-[10px] text-slate-400 pt-1">
                <span>Cycling Flags: </span>
                <span className="text-amber-300 font-mono">{metrics.cyclingFlags || 'None'}</span>
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-800 space-y-1.5 text-[11px]">
              <div className="grid grid-cols-3 gap-1 text-[10px]">
                <div className="bg-slate-900/80 p-1 rounded border border-slate-800 text-center">
                  <span className="text-slate-400 block">Raw Steps</span>
                  <span className="font-bold text-white text-xs">{metrics.rawStepCount ?? 0}</span>
                </div>
                <div className="bg-slate-900/80 p-1 rounded border border-slate-800 text-center">
                  <span className="text-slate-400 block">Baseline</span>
                  <span className="font-bold text-white text-xs">{metrics.baselineStepCount ?? 0}</span>
                </div>
                <div className="bg-slate-900/80 p-1 rounded border border-emerald-900/80 text-center">
                  <span className="text-emerald-400 block">Session</span>
                  <span className="font-bold text-emerald-300 text-xs">{metrics.sessionSteps ?? 0}</span>
                </div>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-slate-400">Walking Confidence:</span>
                <span className="font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                  {metrics.walkingConfidence || '0%'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Verification State:</span>
                <span className="font-semibold text-yellow-300">{metrics.verificationState || 'Not enough walking evidence'}</span>
              </div>
              <div className="text-[10px] text-slate-400">
                <span>Fraud Flags: </span>
                <span className="text-amber-300 font-mono">{metrics.fraudFlags || 'None'}</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 pt-1">
                <span>Last Step: {metrics.lastStepUpdate || 'Waiting...'}</span>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="pt-2 border-t border-slate-800 flex justify-between text-[10px] text-slate-500">
            <span>Last GPS: {metrics.lastGpsUpdate || 'Waiting...'}</span>
            <span>{isCycling ? `Last Sensor: ${metrics.lastSensorUpdate || 'Waiting...'}` : ''}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificationDebugPanel;
