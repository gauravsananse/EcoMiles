"""
Generates synthetic & empirical sensor kinematic datasets for training the
multimodal mobility classification model.
Covers 7 modes: walking, cycling, bus, metro, car, scooter, stationary.
"""

import os
import csv
import random
import numpy as np

LABELS = ["walking", "cycling", "bus", "metro", "car", "scooter", "stationary"]

HEADER = [
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
    "label"
]

def generate_sample(mode):
    """Generate a single feature vector based on real physical kinematic envelopes."""
    if mode == "walking":
        speed_avg = random.uniform(3.0, 5.8)
        speed_var = random.uniform(0.1, 0.6)
        speed_max = speed_avg + random.uniform(0.5, 1.8)
        gps_accel_rms = random.uniform(0.1, 0.4)
        heading_change = random.uniform(3.0, 12.0)
        stop_freq = random.uniform(0.0, 0.15)
        
        # Accelerometer (human gait cadence, distinct rhythmic impacts)
        accel_mean = random.uniform(1.2, 2.8)
        accel_var = random.uniform(0.8, 3.2)
        accel_rms = random.uniform(1.4, 3.5)
        accel_jerk = random.uniform(4.0, 10.0)
        accel_peak_freq = random.uniform(1.6, 2.2)  # ~1.8 Hz walking step frequency
        
        # Gyroscope (body sway)
        gyro_mean = random.uniform(20.0, 60.0)
        gyro_var = random.uniform(100.0, 400.0)
        gyro_rms = random.uniform(25.0, 70.0)
        
        cadence = random.uniform(95.0, 130.0)
        transit_corridor = random.uniform(0.0, 0.25)
        dwell_ratio = random.uniform(0.0, 0.1)
        ble_beacon = random.uniform(0.0, 0.05)

    elif mode == "cycling":
        speed_avg = random.uniform(11.0, 24.0)
        speed_var = random.uniform(0.8, 4.0)
        speed_max = speed_avg + random.uniform(2.0, 8.0)
        gps_accel_rms = random.uniform(0.3, 0.9)
        heading_change = random.uniform(2.0, 8.0)
        stop_freq = random.uniform(0.02, 0.2)
        
        # Accelerometer (pedaling rhythm, road roughness, moderate jerk)
        accel_mean = random.uniform(0.6, 1.6)
        accel_var = random.uniform(0.3, 1.4)
        accel_rms = random.uniform(0.8, 2.0)
        accel_jerk = random.uniform(2.0, 6.0)
        accel_peak_freq = random.uniform(1.0, 1.5)  # ~1.2 Hz pedaling cadence
        
        # Gyroscope (handlebar balance adjustments)
        gyro_mean = random.uniform(15.0, 45.0)
        gyro_var = random.uniform(50.0, 250.0)
        gyro_rms = random.uniform(18.0, 55.0)
        
        cadence = random.uniform(60.0, 95.0) # Crank RPM
        transit_corridor = random.uniform(0.05, 0.35)
        dwell_ratio = random.uniform(0.02, 0.15)
        ble_beacon = random.uniform(0.0, 0.05)

    elif mode == "scooter":
        # Critical Anti-Fraud Scenario: Petrol/electric scooter driving at cycling-like or higher speed
        speed_avg = random.uniform(12.0, 32.0) # overlaps cycling speed!
        speed_var = random.uniform(0.5, 3.5)
        speed_max = speed_avg + random.uniform(3.0, 12.0)
        gps_accel_rms = random.uniform(0.4, 1.2)
        heading_change = random.uniform(1.5, 6.0)
        stop_freq = random.uniform(0.05, 0.25)
        
        # Accelerometer: High-frequency low-amplitude engine vibrations, low human jerk, NO pedaling frequency
        accel_mean = random.uniform(0.2, 0.6)
        accel_var = random.uniform(0.05, 0.25)
        accel_rms = random.uniform(0.25, 0.75)
        accel_jerk = random.uniform(0.8, 2.5)  # Much lower jerk than bicycle
        accel_peak_freq = random.uniform(0.05, 0.4) # NO periodic human gait/pedal frequency
        
        # Gyroscope (leaning into turns, smooth road roll)
        gyro_mean = random.uniform(8.0, 25.0)
        gyro_var = random.uniform(20.0, 90.0)
        gyro_rms = random.uniform(10.0, 32.0)
        
        cadence = 0.0 # ZERO human pedaling cadence!
        transit_corridor = random.uniform(0.05, 0.4)
        dwell_ratio = random.uniform(0.05, 0.2)
        ble_beacon = random.uniform(0.0, 0.05)

    elif mode == "bus":
        speed_avg = random.uniform(14.0, 38.0)
        speed_var = random.uniform(4.0, 16.0) # High variance from stop & go
        speed_max = speed_avg + random.uniform(8.0, 20.0)
        gps_accel_rms = random.uniform(0.6, 1.8)
        heading_change = random.uniform(1.0, 5.0)
        stop_freq = random.uniform(0.25, 0.6) # Frequent stops at bus stations
        
        # Accelerometer: Heavy vehicle braking/accelerating, low human frequency
        accel_mean = random.uniform(0.3, 0.9)
        accel_var = random.uniform(0.1, 0.6)
        accel_rms = random.uniform(0.4, 1.1)
        accel_jerk = random.uniform(1.2, 3.5)
        accel_peak_freq = random.uniform(0.0, 0.3)
        
        gyro_mean = random.uniform(4.0, 18.0)
        gyro_var = random.uniform(10.0, 60.0)
        gyro_rms = random.uniform(6.0, 22.0)
        
        cadence = 0.0
        transit_corridor = random.uniform(0.70, 0.98) # High alignment with bus corridor
        dwell_time = random.uniform(0.25, 0.55)      # High dwell time at stops
        ble_beacon = random.uniform(0.0, 0.85)       # Possible transit BLE beacon match
        dwell_ratio = dwell_time

    elif mode == "metro":
        speed_avg = random.uniform(32.0, 75.0)
        speed_var = random.uniform(5.0, 25.0)
        speed_max = speed_avg + random.uniform(15.0, 35.0)
        gps_accel_rms = random.uniform(0.5, 1.6)
        heading_change = random.uniform(0.2, 2.5) # Very linear track
        stop_freq = random.uniform(0.15, 0.45) # Station dwell intervals
        
        # Accelerometer: Smooth linear rail motion, minimal road bumps
        accel_mean = random.uniform(0.15, 0.55)
        accel_var = random.uniform(0.05, 0.3)
        accel_rms = random.uniform(0.2, 0.7)
        accel_jerk = random.uniform(0.5, 1.8)
        accel_peak_freq = random.uniform(0.0, 0.2)
        
        gyro_mean = random.uniform(2.0, 10.0)
        gyro_var = random.uniform(5.0, 30.0)
        gyro_rms = random.uniform(3.0, 14.0)
        
        cadence = 0.0
        transit_corridor = random.uniform(0.85, 1.0) # Exact rail track alignment
        dwell_ratio = random.uniform(0.2, 0.5)
        ble_beacon = random.uniform(0.1, 0.95)       # Station beacon proximity

    elif mode == "car":
        speed_avg = random.uniform(22.0, 65.0)
        speed_var = random.uniform(2.0, 12.0)
        speed_max = speed_avg + random.uniform(10.0, 30.0)
        gps_accel_rms = random.uniform(0.4, 1.3)
        heading_change = random.uniform(1.0, 6.0)
        stop_freq = random.uniform(0.05, 0.25) # Traffic lights only, not regular bus stops
        
        # Accelerometer: Smooth cabin, low human jitter
        accel_mean = random.uniform(0.2, 0.65)
        accel_var = random.uniform(0.05, 0.35)
        accel_rms = random.uniform(0.25, 0.8)
        accel_jerk = random.uniform(0.6, 2.2)
        accel_peak_freq = random.uniform(0.0, 0.3)
        
        gyro_mean = random.uniform(5.0, 20.0)
        gyro_var = random.uniform(15.0, 80.0)
        gyro_rms = random.uniform(7.0, 25.0)
        
        cadence = 0.0
        transit_corridor = random.uniform(0.05, 0.45) # Irregular or road-based
        dwell_ratio = random.uniform(0.05, 0.2)
        ble_beacon = random.uniform(0.0, 0.05)

    else: # stationary
        speed_avg = random.uniform(0.0, 0.6)
        speed_var = random.uniform(0.0, 0.05)
        speed_max = random.uniform(0.0, 0.9)
        gps_accel_rms = random.uniform(0.0, 0.05)
        heading_change = random.uniform(0.0, 1.0)
        stop_freq = 1.0
        
        accel_mean = random.uniform(0.0, 0.08)
        accel_var = random.uniform(0.0, 0.01)
        accel_rms = random.uniform(0.0, 0.09)
        accel_jerk = random.uniform(0.0, 0.2)
        accel_peak_freq = 0.0
        
        gyro_mean = random.uniform(0.0, 2.0)
        gyro_var = random.uniform(0.0, 1.0)
        gyro_rms = random.uniform(0.0, 2.5)
        
        cadence = 0.0
        transit_corridor = random.uniform(0.0, 0.2)
        dwell_ratio = 1.0
        ble_beacon = random.uniform(0.0, 0.1)

    return [
        round(speed_avg, 3),
        round(speed_var, 3),
        round(speed_max, 3),
        round(gps_accel_rms, 3),
        round(heading_change, 3),
        round(stop_freq, 3),
        round(accel_mean, 3),
        round(accel_var, 3),
        round(accel_rms, 3),
        round(accel_jerk, 3),
        round(accel_peak_freq, 3),
        round(gyro_mean, 3),
        round(gyro_var, 3),
        round(gyro_rms, 3),
        round(cadence, 1),
        round(transit_corridor, 3),
        round(dwell_ratio, 3),
        round(ble_beacon, 3),
        mode
    ]

def main():
    dataset_dir = os.path.join(os.path.dirname(__file__), "dataset")
    os.makedirs(dataset_dir, exist_ok=True)
    
    all_data = []
    
    # Generate individual class CSVs and combined training dataset
    for mode in LABELS:
        mode_samples = [generate_sample(mode) for _ in range(400)]
        all_data.extend(mode_samples)
        
        class_file = os.path.join(dataset_dir, f"{mode}.csv")
        with open(class_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(HEADER)
            writer.writerows(mode_samples)
        print(f"[Dataset Generator] Created {mode}.csv with 400 samples")

    # Combined master dataset
    combined_file = os.path.join(dataset_dir, "mobility_training_dataset.csv")
    random.shuffle(all_data)
    with open(combined_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(HEADER)
        writer.writerows(all_data)
    
    print(f"[Dataset Generator] Created combined master dataset: {combined_file} ({len(all_data)} total samples)")

if __name__ == "__main__":
    main()
