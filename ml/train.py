"""
Training & Evaluation Pipeline for Green Credit AI Multimodal Mobility Verification.
Trains a Random Forest classifier, logs performance metrics, and exports weights.
"""

import os
import sys
import json
import csv
import numpy as np

# Ensure dataset exists
from generate_dataset import main as gen_data, LABELS, HEADER

try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
    import joblib
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

def export_trees_to_json(rf_model, feature_names, class_names, output_path):
    """Serialize scikit-learn random forest trees to pure JSON for high-speed JS/Node execution."""
    forest_data = {
        "feature_names": feature_names,
        "classes": class_names,
        "n_estimators": len(rf_model.estimators_),
        "trees": []
    }
    
    for estimator in rf_model.estimators_:
        tree = estimator.tree_
        tree_dict = {
            "children_left": tree.children_left.tolist(),
            "children_right": tree.children_right.tolist(),
            "feature": tree.feature.tolist(),
            "threshold": [round(float(t), 4) for t in tree.threshold],
            "value": [v[0].tolist() for v in tree.value]
        }
        forest_data["trees"].append(tree_dict)
        
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(forest_data, f, indent=2)
    print(f"[ML Pipeline] Exported zero-dependency tree model to {output_path}")

def train_and_evaluate():
    dataset_dir = os.path.join(os.path.dirname(__file__), "dataset")
    combined_csv = os.path.join(dataset_dir, "mobility_training_dataset.csv")
    
    if not os.path.exists(combined_csv):
        print("[ML Pipeline] Dataset not found, generating dataset...")
        gen_data()
        
    # Read dataset
    X = []
    y = []
    with open(combined_csv, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
        feature_names = header[:-1]
        for row in reader:
            if not row:
                continue
            feats = [float(val) for val in row[:-1]]
            label = row[-1]
            X.append(feats)
            y.append(label)
            
    X = np.array(X)
    y = np.array(y)
    
    print(f"[ML Pipeline] Loaded dataset with shape {X.shape} across {len(LABELS)} classes.")
    
    if not SKLEARN_AVAILABLE:
        print("[ML Pipeline Warning] scikit-learn is not installed in current Python environment.")
        print("[ML Pipeline] Generating rule-based fallback decision weights.")
        fallback_weights = {
            "feature_names": feature_names,
            "classes": LABELS,
            "rule_based": True,
            "version": "1.0.0"
        }
        weights_path = os.path.join(os.path.dirname(__file__), "model_weights.json")
        with open(weights_path, "w", encoding="utf-8") as f:
            json.dump(fallback_weights, f, indent=2)
        return
        
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )
    
    rf = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        random_state=42,
        class_weight="balanced"
    )
    
    print("[ML Pipeline] Training Random Forest Classifier...")
    rf.fit(X_train, y_train)
    
    y_pred = rf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    report = classification_report(y_test, y_pred, target_names=LABELS, output_dict=True)
    conf_matrix = confusion_matrix(y_test, y_pred, labels=LABELS).tolist()
    
    print(f"\n========================================================")
    print(f"  MODEL EVALUATION RESULTS (Test Set Accuracy: {acc*100:.2f}%)")
    print(f"========================================================")
    print(classification_report(y_test, y_pred, target_names=LABELS))
    
    metrics_path = os.path.join(os.path.dirname(__file__), "evaluation_report.json")
    evaluation_output = {
        "accuracy": round(float(acc), 4),
        "classes": LABELS,
        "classification_report": report,
        "confusion_matrix": conf_matrix,
        "feature_importances": {
            name: round(float(imp), 4)
            for name, imp in zip(feature_names, rf.feature_importances_)
        }
    }
    
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(evaluation_output, f, indent=2)
    print(f"[ML Pipeline] Saved evaluation metrics to {metrics_path}")
    
    # Save joblib model for Python microservice
    model_path = os.path.join(os.path.dirname(__file__), "mobility_model.joblib")
    joblib.dump(rf, model_path)
    print(f"[ML Pipeline] Saved joblib model to {model_path}")
    
    # Save JSON weights for Node.js native server inference
    json_weights_path = os.path.join(os.path.dirname(__file__), "model_weights.json")
    export_trees_to_json(rf, feature_names, LABELS, json_weights_path)

if __name__ == "__main__":
    train_and_evaluate()
