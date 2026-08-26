/**
 * Feature Extractor for Multimodal Mobility Verification
 * Extracts statistical, kinematic, and contextual features from sliding sensor windows.
 */

class FeatureExtractor {
  computeRMS(array) {
    if (!array || array.length === 0) return 0;
    const sumSq = array.reduce((acc, val) => acc + val * val, 0);
    return Math.sqrt(sumSq / array.length);
  }

  computeVariance(array, mean) {
    if (!array || array.length === 0) return 0;
    const m = mean !== undefined ? mean : this.computeMean(array);
    const sumDiffSq = array.reduce((acc, val) => acc + Math.pow(val - m, 2), 0);
    return sumDiffSq / array.length;
  }

  computeMean(array) {
    if (!array || array.length === 0) return 0;
    const sum = array.reduce((acc, val) => acc + val, 0);
    return sum / array.length;
  }

  computeJerk(accelArray, dt = 0.2) {
    if (!accelArray || accelArray.length < 2) return 0;
    let jerkSum = 0;
    for (let i = 1; i < accelArray.length; i++) {
      jerkSum += Math.abs(accelArray[i] - accelArray[i - 1]) / Math.max(dt, 0.01);
    }
    return jerkSum / (accelArray.length - 1);
  }

  /**
   * Extract complete 18-feature vector from a raw sensor window
   */
  extract(sensorWindow) {
    const speeds = sensorWindow.speeds || [sensorWindow.speed || 0];
    const ax = sensorWindow.accelerationsX || [0];
    const ay = sensorWindow.accelerationsY || [0];
    const az = sensorWindow.accelerationsZ || [9.81];
    const gx = sensorWindow.gyrosAlpha || [0];
    const gy = sensorWindow.gyrosBeta || [0];
    const gz = sensorWindow.gyrosGamma || [0];
    const headings = sensorWindow.headings || [0];

    // Compute dynamic acceleration magnitudes (remove gravity vector)
    const accelMagnitudes = [];
    const len = Math.max(ax.length, ay.length, az.length);
    for (let i = 0; i < len; i++) {
      const x = ax[i] || 0;
      const y = ay[i] || 0;
      const z = az[i] !== undefined ? az[i] : 9.81;
      const mag = Math.sqrt(x * x + y * y + z * z);
      accelMagnitudes.push(Math.abs(mag - 9.81));
    }

    // Compute gyro magnitudes
    const gyroMagnitudes = [];
    const gLen = Math.max(gx.length, gy.length, gz.length);
    for (let i = 0; i < gLen; i++) {
      const x = gx[i] || 0;
      const y = gy[i] || 0;
      const z = gz[i] || 0;
      gyroMagnitudes.push(Math.sqrt(x * x + y * y + z * z));
    }

    // GPS Features
    const gpsSpeedAvg = Number(this.computeMean(speeds).toFixed(2));
    const gpsSpeedVar = Number(this.computeVariance(speeds, gpsSpeedAvg).toFixed(2));
    const gpsSpeedMax = Number(Math.max(...speeds, 0).toFixed(2));

    let gpsAccelRms = 0;
    if (speeds.length > 1) {
      const gpsAccels = [];
      for (let i = 1; i < speeds.length; i++) {
        gpsAccels.push((speeds[i] - speeds[i - 1]) / 3.6); // m/s^2 approx
      }
      gpsAccelRms = Number(this.computeRMS(gpsAccels).toFixed(2));
    }

    let headingChangeRate = 0;
    if (headings.length > 1) {
      let hDiffSum = 0;
      for (let i = 1; i < headings.length; i++) {
        let diff = Math.abs(headings[i] - headings[i - 1]);
        diff = Math.min(diff, 360 - diff);
        hDiffSum += diff;
      }
      headingChangeRate = Number((hDiffSum / (headings.length - 1)).toFixed(2));
    }

    const stopsCount = speeds.filter((s) => s < 1.0).length;
    const stopFrequency = Number((stopsCount / speeds.length).toFixed(2));

    // Accelerometer Features
    const accelMagnitudeMean = Number(this.computeMean(accelMagnitudes).toFixed(3));
    const accelMagnitudeVar = Number(this.computeVariance(accelMagnitudes, accelMagnitudeMean).toFixed(3));
    const accelRms = Number(this.computeRMS(accelMagnitudes).toFixed(3));
    const accelJerkMean = Number(this.computeJerk(accelMagnitudes).toFixed(3));
    const accelPeakFreq = Number(sensorWindow.accelPeakFreq || (accelRms > 1.2 ? 1.8 : 0.2));

    // Gyroscope Features
    const gyroMagnitudeMean = Number(this.computeMean(gyroMagnitudes).toFixed(2));
    const gyroMagnitudeVar = Number(this.computeVariance(gyroMagnitudes, gyroMagnitudeMean).toFixed(2));
    const gyroRms = Number(this.computeRMS(gyroMagnitudes).toFixed(2));

    // Context / External Features
    const cadence = Number(sensorWindow.cadence || 0);
    const transitCorridorOverlap = Number(sensorWindow.transitCorridorOverlap || 0.0);
    const dwellTimeRatio = Number(sensorWindow.dwellTimeRatio || (stopFrequency > 0.3 ? 0.35 : 0.05));
    const bleBeaconProximity = Number(sensorWindow.bleBeaconProximity || 0.0);

    return {
      gpsSpeedAvg,
      gpsSpeedVar,
      gpsSpeedMax,
      gpsAccelRms,
      headingChangeRate,
      stopFrequency,
      accelMagnitudeMean,
      accelMagnitudeVar,
      accelRms,
      accelJerkMean,
      accelPeakFreq,
      gyroMagnitudeMean,
      gyroMagnitudeVar,
      gyroRms,
      cadence,
      transitCorridorOverlap,
      dwellTimeRatio,
      bleBeaconProximity,
    };
  }
}

module.exports = new FeatureExtractor();
