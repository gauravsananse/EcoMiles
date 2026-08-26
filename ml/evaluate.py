"""
Evaluation script to test accuracy, precision, recall, F1, and confusion matrix.
"""

import os
import json
import csv

def evaluate():
    metrics_path = os.path.join(os.path.dirname(__file__), "evaluation_report.json")
    if os.path.exists(metrics_path):
        with open(metrics_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        print("=== EVALUATION REPORT ===")
        print(json.dumps(data, indent=2))
    else:
        print("[Evaluate] Please run train.py first to generate the full evaluation report.")

if __name__ == "__main__":
    evaluate()
