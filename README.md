# Green Credit — AI Multimodal Mobility Verification & EV Platform

A production-quality, full-stack **AI Multimodal Mobility Verification and Electric Vehicle (EV) Registration Platform**.

The platform continuously verifies whether a commuter is **Walking, Cycling, Travelling by Bus, Travelling by Metro/Train, Travelling in a Private Car, Travelling on a Motorcycle/Scooter, or Stationary** using real browser/device sensors, multi-signal sensor fusion, and anti-fraud kinematic analysis—preventing reward farming and spoofing attacks.

---

## Table of Contents

1. [Platform Overview & Core Concept](#1-platform-overview--core-concept)
2. [Multi-Signal Sensor Fusion Engine](#2-multi-signal-sensor-fusion-engine)
3. [Anti-Fraud & Attack Detection (Scooter vs. Cycling)](#3-anti-fraud--attack-detection-scooter-vs-cycling)
4. [Public Transport Verification & Reward Locking](#4-public-transport-verification--reward-locking)
5. [Project Architecture](#5-project-architecture)
6. [Machine Learning Pipeline (`/ml`)](#6-machine-learning-pipeline-ml)
7. [Installation & Setup](#7-installation--setup)
8. [Environment Variables](#8-environment-variables)
9. [Running the Application](#9-running-the-application)
10. [REST API Documentation](#10-rest-api-documentation)
11. [Browser Sensor Permissions & Fallbacks](#11-browser-sensor-permissions--fallbacks)
12. [Developer Test Mode](#12-developer-test-mode)
13. [Automated Acceptance Test Suite (Scenarios 1–12)](#13-automated-acceptance-test-suite-scenarios-112)

---

## 1. Platform Overview & Core Concept

When a user taps **"START JOURNEY"**, the system begins collecting live sensor telemetry:
- **High-Accuracy Geolocation**: Latitude, Longitude, Instantaneous Speed, Heading, GPS Accuracy.
- **Device Motion (`DeviceMotionEvent`)**: 3-Axis Acceleration ($X, Y, Z$), Dynamic Acceleration RMS, Jerk ($\text{m/s}^3$).
- **Device Orientation (`DeviceOrientationEvent`)**: Roll ($\alpha$), Pitch ($\beta$), Yaw ($\gamma$) dynamics.
- **Web Bluetooth Proximity (`navigator.bluetooth`)**: Scans for municipal transit BLE beacons and rail gate beacons.
- **Contextual Infrastructure**: Transit corridor overlap, bus stop dwell frequencies, subterranean rail tunnels.

### Strict Sensor Integrity Rule
- Real browser APIs are used when supported.
- If a sensor or permission is unsupported (e.g. desktop browser or restricted WebView), the platform displays `"Unavailable on this device/browser"` and continues gracefully without faking live readings.

---

## 2. Multi-Signal Sensor Fusion Engine

The platform does **not** rely on simple GPS speed thresholds. Instead, an 18-dimensional feature vector is extracted every 5–10 seconds over a sliding time window:

| Feature Dimension | Extracted Kinematic Metric | Mobility Signature Implication |
|---|---|---|
| `gps_speed_avg` | Average velocity ($\text{km/h}$) | Distinguishes pedestrian ($3-6$) vs transit ($20-50$) vs highway ($50+$) |
| `gps_speed_var` | Speed variance over window | Detects stop-and-go bus dwell patterns |
| `accel_rms` | Root Mean Square dynamic acceleration | High for walking impacts ($>1.4\,\text{m/s}^2$), low for motorized cabins ($<0.6\,\text{m/s}^2$) |
| `accel_jerk_mean` | Rate of change of acceleration | Detects human limb movement ($>3.0\,\text{m/s}^3$) vs smooth engine acceleration |
| `accel_peak_freq` | Dominant spectral oscillation | Identifies human walking cadence ($\sim1.8\,\text{Hz}$) and bicycle pedaling ($\sim1.2\,\text{Hz}$) |
| `cadence` | Step / pedal revolutions per minute | Pedestrian ($90-130\,\text{spm}$), Cyclist ($60-90\,\text{rpm}$), Motor vehicle ($0$) |
| `transit_corridor_overlap` | Geospatial alignment ($0.0-1.0$) | Matches municipal bus rapid transit lines or metro rail guideways |
| `dwell_time_ratio` | Dwell time at stops ($0.0-1.0$) | Verified passenger bus stop pickup/dropoff cadence |
| `ble_beacon_proximity` | Bluetooth signal match | Proximity to registered municipal transit beacons |

### Mode Probability Distribution
The Bayesian ensemble outputs exact softmax normalized probabilities across 7 classes:
$$\{ \text{walking}, \text{cycling}, \text{bus}, \text{metro}, \text{car}, \text{scooter}, \text{stationary} \}$$

---

## 3. Anti-Fraud & Attack Detection (Scooter vs. Cycling)

### The Scooter Spoofing Attack Scenario
A user drives a petrol/electric scooter deliberately at **$14-18\,\text{km/h}$** to farm cycling Green Credits:
1. **GPS Speed alone**: Looks identical to a bicycle ($\sim16\,\text{km/h}$).
2. **Sensor Fusion Audit**:
   - Accelerometer: Shows engine micro-vibrations with low human jerk ($\text{Jerk} < 1.8\,\text{m/s}^3$).
   - Cadence: **$0.0\,\text{rpm}$** (absence of physical pedaling).
   - Frequency Spectrum: Lacks human gait or sinusoidal pedaling peaks.
3. **Engine Action**:
   - Classifies mode as **`SCOOTER`**.
   - **Fitness Points = 0**, **Cycling Green Credits = 0**.
   - Increments **Fraud Risk Score** ($+65/100$) and logs a `FraudEvent`.

---

## 4. Public Transport Verification & Reward Locking

### Critical Multi-Leg Demo Scenario: Walking $\to$ Bus $\to$ Walking $\to$ Car
```
[08:00 - 08:10] WALKING (0.8 km) ──────────> VERIFIED (Fitness: +12 FP, Green: +8 GP)
       │
[08:10 - 08:42] BUS (11.4 km) ─────────────> VERIFIED (Transit Rewards ACTIVE: +68 GP)
       │ (User exits bus at transit terminal)
[08:42 - 08:46] WALKING (0.4 km) ──────────> VERIFIED (+6 FP, +4 GP)
       │ (User enters private car: Car confidence > threshold)
[08:46 - 09:05] CAR (14.2 km) ─────────────> PUBLIC TRANSIT REWARD IMMEDIATELY SHUT OFF
                                             Car Green Credits = 0, Car Fitness Points = 0
```

### Reward Locking States
Commuter rewards follow an immutable cryptographic state transition:
$$\text{PENDING} \xrightarrow{\text{Segment AI & Anti-Fraud Verification}} \text{VERIFIED} \xrightarrow{\text{Journey Completion}} \text{RELEASED}$$
- If Fraud Score $> 50$: Status is moved to **`HELD`** or **`REJECTED`** with zero payout.

---

## 5. Project Architecture

```
ev-registration/
├── frontend/                               # React 18 + Vite SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── MobilityMap.jsx             # Leaflet live route & segment map
│   │   │   ├── SensorEvidencePanel.jsx     # Real-time sensor readout & meters
│   │   │   ├── AIExplanationPanel.jsx      # Transparent decision reasoning audit
│   │   │   ├── MultiSignalMatrix.jsx       # 7-mode Bayesian probability distribution
│   │   │   ├── JourneyTimeline.jsx         # Segmented timeline with reward status
│   │   │   ├── BluetoothScannerModal.jsx   # Web Bluetooth beacon scanner & matching
│   │   │   ├── DeveloperTestModeBar.jsx    # Kinematic replay controller for test mode
│   │   │   └── Navbar.jsx                  # Multi-tab navigation
│   │   ├── pages/
│   │   │   ├── MultimodalMobilityVerification.jsx # Core AI Verification Dashboard
│   │   │   ├── EVRegistration.jsx          # EV RC verification & QR Pass
│   │   │   ├── SmartRoutePlanner.jsx       # Fitness-aware multimodal routes
│   │   │   ├── CityTransportNetwork.jsx    # Transit corridors & beacons
│   │   │   └── RewardsMarketplace.jsx      # Dual-economy reward redemption
│   │   ├── services/
│   │   │   ├── sensorManager.js            # Real browser sensor manager
│   │   │   ├── replayDatasets.js           # Multi-modal recorded test datasets
│   │   │   └── api.js                      # REST API client
│   │   └── App.jsx
├── backend/                                # Node.js + Express REST API Server
│   ├── models/
│   │   ├── Journey.js                      # Multi-segment journey schema
│   │   ├── SensorWindow.js                 # 5-second sliding telemetry window
│   │   ├── FraudEvent.js                   # Audit log for spoofing triggers
│   │   ├── TransitBeacon.js                # Registered municipal BLE beacons
│   │   ├── RewardTransaction.js            # Reward lock & release transactions
│   │   ├── User.js                         # Dual-economy wallet (FP & GP)
│   │   └── Vehicle.js                      # Registered EV records
│   ├── services/
│   │   ├── featureExtractor.js             # Statistical & time-series features
│   │   ├── sensorFusionService.js          # Multi-signal Bayesian classifier
│   │   ├── fraudDetectionService.js        # Kinematic limits & spoofing detection
│   │   ├── publicTransportVerification.js  # Transit corridors & BLE matching
│   │   └── rewardEngine.js                 # Reward locking & release engine
│   ├── controllers/
│   │   ├── journeyVerificationController.js # Start, stream, infer, end, delete
│   │   ├── transitController.js            # Transit context & beacon queries
│   │   └── fraudController.js              # Dedicated fraud audit endpoint
│   ├── routes/
│   │   ├── journeyVerificationRoutes.js    # /api/journey/*
│   │   ├── transitRoutes.js                # /api/transit/*
│   │   └── fraudRoutes.js                  # /api/fraud/*
│   └── server.js                           # Express entry point
├── ml/                                     # Machine Learning Pipeline
│   ├── dataset/                            # Labeled CSV datasets for all 7 modes
│   ├── generate_dataset.py                 # Kinematic dataset generator
│   ├── feature_extraction.py               # Feature extraction module
│   ├── model.py                            # Model architectures
│   ├── train.py                            # Random Forest / XGBoost training script
│   ├── evaluate.py                         # Evaluation metrics (Accuracy, F1, Matrix)
│   ├── inference.py                        # Python FastAPI microservice
│   └── model_weights.json                  # Exported decision rules
└── README.md
```

---

## 6. Machine Learning Pipeline (`/ml`)

### Generating Training Data & Training the Model
```bash
# 1. Generate kinematic dataset across all 7 modes
python ml/generate_dataset.py

# 2. Train Random Forest model & export metrics
python ml/train.py

# 3. View evaluation report
python ml/evaluate.py
```

### Running the Python FastAPI Inference Microservice (Optional)
```bash
python ml/inference.py
# Microservice starts on http://localhost:8000
```

---

## 7. Installation & Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MongoDB**: Local instance or MongoDB Atlas URI
- **Python**: 3.9+ (optional, for ML training)

### Backend Installation
```bash
cd backend
npm install
```

### Frontend Installation
```bash
cd frontend
npm install
```

---

## 8. Environment Variables

Create `backend/.env` (based on `backend/.env.example`):
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb://127.0.0.1:27017/green_credits_ev
JWT_SECRET=your_secure_jwt_secret_key_2026
VEHICLE_API_PROVIDER=sandbox
```

---

## 9. Running the Application

### 1. Start Backend Server
```bash
cd backend
npm start
# Server runs on http://localhost:5000
```

### 2. Start Frontend Client
```bash
cd frontend
npm run dev
# Frontend runs on http://localhost:5173
```

---

## 10. REST API Documentation

### Mobility & AI Verification Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/journey/start` | Initiates new multimodal tracking session |
| `POST` | `/api/journey/sensor-data` | Ingests 5s sensor window, runs ML fusion & segment updates |
| `POST` | `/api/journey/inference` | Stateless real-time classification endpoint |
| `POST` | `/api/journey/verify` | Verifies segment status and fraud risk |
| `POST` | `/api/journey/end` | Finalizes journey, locks segments, releases verified rewards |
| `GET` | `/api/journey/:id` | Returns full journey with telemetry & segments |
| `GET` | `/api/journey/:id/segments` | Returns segment breakdown |
| `GET` | `/api/journey/:id/rewards` | Returns reward transaction locking status |
| `DELETE` | `/api/journey/:id` | Privacy endpoint: Permanently deletes journey and sensor data |

### Transit & Intelligence Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/transit/context` | Returns nearby corridors, stops, and active BLE beacons |
| `GET` | `/api/transit/beacons` | Returns registered city transit BLE beacons |
| `POST` | `/api/fraud/analyze` | Evaluates kinematic fraud score (0–100) |

---

## 11. Browser Sensor Permissions & Fallbacks

- **Geolocation**: Uses `navigator.geolocation.watchPosition` with `enableHighAccuracy: true`.
- **Device Motion & Gyroscope**: Listens for `devicemotion` and `deviceorientation`. On iOS 13+, handles explicit `DeviceMotionEvent.requestPermission()` prompt.
- **Web Bluetooth**: Scans for official transit beacon UUIDs where supported.
- **Graceful Diagnostics**: If any sensor is denied or unavailable on the host browser, the UI clearly displays `"Unavailable on this device/browser"` and adjusts inference confidence accordingly.

---

## 12. Developer Test Mode

A dedicated **"DEVELOPER TEST MODE"** switch is integrated into the top of the interface:
- Allows testing on desktop environments or devices without sensors.
- Feeds recorded real-world sensor profiles (`walking`, `cycling`, `bus`, `metro`, `car`, `scooter_fraud_attack`, `bus_to_car_transition`) through the **exact same backend ML inference pipeline**.
- Clearly marked with a prominent `TEST MODE — REPLAYED SENSOR DATA` badge.

---

## 13. Automated Acceptance Test Suite (Scenarios 1–12)

Execute the full automated test suite covering all 12 prompt scenarios:
```bash
cd backend
npm test
```

### Verified Test Matrix:
- [x] **TEST 1**: Walking ($4.5\,\text{km/h}$, $112\,\text{spm}$) $\to$ `WALKING` & Active Fitness Points.
- [x] **TEST 2**: Cycling ($18.2\,\text{km/h}$, $78\,\text{rpm}$) $\to$ `CYCLING` & Active Fitness Points.
- [x] **TEST 3**: Scooter Attack ($16\,\text{km/h}$, $0\,\text{cadence}$, motor vibration) $\to$ `SCOOTER` & $0$ Cycling Points.
- [x] **TEST 4**: Bus Journey (Corridor alignment + stop dwell times) $\to$ `BUS` & Green Credits active.
- [x] **TEST 5**: Metro Journey ($65\,\text{km/h}$, rail track + tunnel degradation handling) $\to$ `METRO`.
- [x] **TEST 6**: Multi-Leg Transition (Walking $\to$ Bus $\to$ Walking $\to$ Car) $\to$ Shuts off transit rewards upon car entry, Car credits = $0$.
- [x] **TEST 7**: Car on Bus Route (High continuous speed without dwell stops) $\to$ `CAR`.
- [x] **TEST 8**: Bluetooth Unavailable $\to$ Continues with remaining evidence without crashing.
- [x] **TEST 9**: Motion Sensor Unavailable $\to$ Falls back to GPS kinematics with diagnostic note.
- [x] **TEST 10**: GPS Permission Denied $\to$ Handled gracefully without fabricating fake coordinates.
- [x] **TEST 11**: Journey Completion $\to$ Segments finalized, verified, and released to MongoDB user wallet.
- [x] **TEST 12**: Anti-Tamper Security $\to$ Malicious client-supplied mode/credit spoofing is rejected by server.
