"""
Feature Extraction Pipeline for Multimodal Mobility Verification
Extracts time-domain, kinematic, and statistical features from raw sensor windows.
"""

import numpy as np

FEATURE_NAMES = [
    "gps_speed_avg",
    "gps_speed_var",
    "gps_speed_max",
    "gps_accel_rms",
    "heading_change_rate",
    "stop_frequency",
    "accel_magnitude_mean",
    "accel_magnitude_var",
    "accel_rms",
    "accel_jerk_mean",
    "accel_peak_freq",
    "gyro_magnitude_mean",
    "gyro_magnitude_var",
    "gyro_rms",
    "cadence_steps_per_min",
    "transit_corridor_overlap",
    "dwell_time_ratio",
    "ble_beacon_proximity",
]

def compute_rms(signal):
    """Compute Root Mean Square of a 1D array."""
    signal = np.array(signal, dtype=np.float64)
    if len(signal) == 0:
        return 0.0
    return float(np.sqrt(np.mean(signal**2)))

def compute_jerk(accel_signal, dt=0.2):
    """Compute rate of change of acceleration (jerk) in m/s^3."""
    accel = np.array(accel_signal, dtype=np.float64)
    if len(accel) < 2:
        return 0.0
    diffs = np.diff(accel) / max(dt, 0.01)
    return float(np.mean(np.abs(diffs)))

def compute_peak_frequency(signal, sampling_rate=20.0):
    """Extract dominant spectral frequency (useful for pedaling/walking cadence)."""
    signal = np.array(signal, dtype=np.float64)
    if len(signal) < 8:
        return 0.0
    # Remove DC component
    signal = signal - np.mean(signal)
    fft_vals = np.abs(np.fft.rfft(signal))
    freqs = np.fft.rfftfreq(len(signal), d=1.0/sampling_rate)
    if len(fft_vals) <= 1:
        return 0.0
    # Ignore 0Hz bin
    peak_idx = np.argmax(fft_vals[1:]) + 1
    return float(freqs[peak_idx])

def extract_features_from_window(sensor_window):
    """
    Extract a 18-dimensional feature vector from a sensor window dictionary.
    """
    speeds = np.array(sensor_window.get("speeds", [0.0]), dtype=np.float64)
    ax = np.array(sensor_window.get("accelerations_x", [0.0]), dtype=np.float64)
    ay = np.array(sensor_window.get("accelerations_y", [0.0]), dtype=np.float64)
    az = np.array(sensor_window.get("accelerations_z", [9.81]), dtype=np.float64)
    
    # 3D acceleration magnitude (with gravity subtraction for dynamic motion)
    accel_mag = np.sqrt(ax**2 + ay**2 + az**2)
    dynamic_accel_mag = np.abs(accel_mag - 9.81)

    gx = np.array(sensor_window.get("gyros_alpha", [0.0]), dtype=np.float64)
    gy = np.array(sensor_window.get("gyros_beta", [0.0]), dtype=np.float64)
    gz = np.array(sensor_window.get("gyros_gamma", [0.0]), dtype=np.float64)
    gyro_mag = np.sqrt(gx**2 + gy**2 + gz**2)

    headings = np.array(sensor_window.get("headings", [0.0]), dtype=np.float64)
    
    # 1. GPS features
    gps_speed_avg = float(np.mean(speeds)) if len(speeds) > 0 else 0.0
    gps_speed_var = float(np.var(speeds)) if len(speeds) > 0 else 0.0
    gps_speed_max = float(np.max(speeds)) if len(speeds) > 0 else 0.0
    
    # Estimate acceleration from GPS speed diffs
    if len(speeds) > 1:
        gps_accels = np.diff(speeds / 3.6) / 1.0  # m/s^2 roughly assuming 1s interval
        gps_accel_rms = float(compute_rms(gps_accels))
    else:
        gps_accel_rms = 0.0

    # Heading change rate (deg/s)
    if len(headings) > 1:
        heading_diffs = np.abs(np.diff(headings))
        heading_diffs = np.minimum(heading_diffs, 360.0 - heading_diffs)
        heading_change_rate = float(np.mean(heading_diffs))
    else:
        heading_change_rate = 0.0

    # Stop frequency (fraction of points with speed < 1.0 km/h)
    stop_frequency = float(np.mean(speeds < 1.0)) if len(speeds) > 0 else 0.0

    # 2. Accelerometer features
    accel_magnitude_mean = float(np.mean(dynamic_accel_mag))
    accel_magnitude_var = float(np.var(dynamic_accel_mag))
    accel_rms = float(compute_rms(dynamic_accel_mag))
    accel_jerk_mean = float(compute_jerk(dynamic_accel_mag))
    accel_peak_freq = float(compute_peak_frequency(dynamic_accel_mag))

    # 3. Gyroscope features
    gyro_magnitude_mean = float(np.mean(gyro_mag))
    gyro_magnitude_var = float(np.var(gyro_mag))
    gyro_rms = float(compute_rms(gyro_mag))

    # 4. Context & Activity features
    cadence = float(sensor_window.get("cadence", 0.0))
    transit_corridor_overlap = float(sensor_window.get("transit_corridor_overlap", 0.0))
    dwell_time_ratio = float(sensor_window.get("dwell_time_ratio", 0.0))
    ble_beacon_proximity = float(sensor_window.get("ble_beacon_proximity", 0.0))

    return [
        gps_speed_avg,
        gps_speed_var,
        gps_speed_max,
        gps_accel_rms,
        heading_change_rate,
        stop_frequency,
        accel_magnitude_mean,
        accel_magnitude_var,
        accel_rms,
        accel_jerk_mean,
        accel_peak_freq,
        gyro_magnitude_mean,
        gyro_magnitude_var,
        gyro_rms,
        cadence,
        transit_corridor_overlap,
        dwell_time_ratio,
        ble_beacon_proximity,
    ]
