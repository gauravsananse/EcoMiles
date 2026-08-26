"""
Model definition and wrapper for Multimodal Mobility Classifier.
"""

try:
    from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

class MultimodalMobilityClassifier:
    def __init__(self, n_estimators=100, max_depth=12, random_state=42):
        self.labels = ["walking", "cycling", "bus", "metro", "car", "scooter", "stationary"]
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.random_state = random_state
        if SKLEARN_AVAILABLE:
            self.model = RandomForestClassifier(
                n_estimators=self.n_estimators,
                max_depth=self.max_depth,
                random_state=self.random_state,
                class_weight="balanced"
            )
        else:
            self.model = None

    def fit(self, X, y):
        if self.model is not None:
            return self.model.fit(X, y)
        raise RuntimeError("scikit-learn is required to fit the model.")

    def predict(self, X):
        if self.model is not None:
            return self.model.predict(X)
        raise RuntimeError("scikit-learn is required for predict.")

    def predict_proba(self, X):
        if self.model is not None:
            return self.model.predict_proba(X)
        raise RuntimeError("scikit-learn is required for predict_proba.")
