"""
FastAPI Microservice for Multimodal Mobility ML Inference.
Provides a REST endpoint POST /predict for real-time feature window classification.
"""

import os
import json
from typing import List, Optional

try:
    from fastapi import FastAPI, HTTPException
    from pydantic import BaseModel
    import joblib
    import numpy as np
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False

if FASTAPI_AVAILABLE:
    app = FastAPI(
        title="Green Credit AI Multimodal Mobility Inference Service",
        description="Real-time multi-signal sensor fusion classifier",
        version="1.0.0"
    )

    class FeatureWindow(BaseModel):
        gps_speed_avg: float
        gps_speed_var: float
        gps_speed_max: float
        gps_accel_rms: float
        heading_change_rate: float
        stop_frequency: float
        accel_magnitude_mean: float
        accel_magnitude_var: float
        accel_rms: float
        accel_jerk_mean: float
        accel_peak_freq: float
        gyro_magnitude_mean: float
        gyro_magnitude_var: float
        gyro_rms: float
        cadence_steps_per_min: float
        transit_corridor_overlap: float
        dwell_time_ratio: float
        ble_beacon_proximity: float

    # Load model
    model_path = os.path.join(os.path.dirname(__file__), "mobility_model.joblib")
    model = None
    if os.path.exists(model_path):
        model = joblib.load(model_path)

    LABELS = ["walking", "cycling", "bus", "metro", "car", "scooter", "stationary"]

    @app.get("/health")
    def health_check():
        return {
            "status": "healthy",
            "model_loaded": model is not None,
            "classes": LABELS
        }

    @app.post("/predict")
    def predict_mode(window: FeatureWindow):
        features = [
            window.gps_speed_avg,
            window.gps_speed_var,
            window.gps_speed_max,
            window.gps_accel_rms,
            window.heading_change_rate,
            window.stop_frequency,
            window.accel_magnitude_mean,
            window.accel_magnitude_var,
            window.accel_rms,
            window.accel_jerk_mean,
            window.accel_peak_freq,
            window.gyro_magnitude_mean,
            window.gyro_magnitude_var,
            window.gyro_rms,
            window.cadence_steps_per_min,
            window.transit_corridor_overlap,
            window.dwell_time_ratio,
            window.ble_beacon_proximity
        ]

        if model is not None:
            proba = model.predict_proba([features])[0]
            pred_idx = np.argmax(proba)
            pred_mode = LABELS[pred_idx]
            conf = float(proba[pred_idx])
            prob_dict = {label: float(round(p, 4)) for label, p in zip(LABELS, proba)}
        else:
            # Fallback heuristic if model not fitted
            prob_dict = {
                "walking": 0.0,
                "cycling": 0.0,
                "bus": 0.0,
                "metro": 0.0,
                "car": 0.0,
                "scooter": 0.0,
                "stationary": 0.0
            }
            if window.gps_speed_avg < 1.0:
                pred_mode = "stationary"
                conf = 0.95
            elif window.gps_speed_avg < 7.0 and window.cadence_steps_per_min > 70:
                pred_mode = "walking"
                conf = 0.94
            elif window.cadence_steps_per_min > 40 and window.gps_speed_avg <= 28:
                pred_mode = "cycling"
                conf = 0.92
            elif window.cadence_steps_per_min == 0 and window.accel_jerk_mean < 2.5 and window.gps_speed_avg <= 35:
                pred_mode = "scooter"
                conf = 0.89
            elif window.transit_corridor_overlap > 0.6 and window.stop_frequency > 0.2:
                pred_mode = "bus"
                conf = 0.91
            elif window.gps_speed_avg > 40:
                pred_mode = "metro"
                conf = 0.93
            else:
                pred_mode = "car"
                conf = 0.88
            prob_dict[pred_mode] = conf

        return {
            "predicted_mode": pred_mode,
            "confidence": conf,
            "probabilities": prob_dict
        }

if __name__ == "__main__":
    if FASTAPI_AVAILABLE:
        import uvicorn
        uvicorn.run("inference:app", host="0.0.0.0", port=8000, reload=True)
    else:
        print("[Inference Service] Install fastapi and uvicorn to run microservice.")
