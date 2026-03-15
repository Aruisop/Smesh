"""
Anomaly Detection Model — Isolation Forest trained on NSL-KDD.

Trains, evaluates, and exports the model for use by the anomaly detection service.
"""

import os
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.metrics import classification_report, roc_auc_score
import joblib

from dataset import download_dataset, preprocess_and_scale

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")


def train_model():
    """Train Isolation Forest on NSL-KDD data."""
    os.makedirs(MODEL_DIR, exist_ok=True)

    # Download and preprocess
    train_path, test_path = download_dataset()
    X_train, y_train, X_test, y_test, feature_cols = preprocess_and_scale(train_path, test_path)

    # Train only on normal traffic to learn "normal" pattern
    normal_mask = y_train == 0
    X_train_normal = X_train[normal_mask]

    print(f"[Model] Training Isolation Forest on {len(X_train_normal)} normal samples...")

    model = IsolationForest(
        n_estimators=200,
        max_samples=min(10000, len(X_train_normal)),
        contamination=0.1,
        max_features=0.8,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train_normal)

    # Save model
    model_path = os.path.join(MODEL_DIR, "isolation_forest.joblib")
    joblib.dump(model, model_path)
    print(f"[Model] Model saved to {model_path}")

    # Evaluate on test set
    evaluate_model(model, X_test, y_test)

    return model


def evaluate_model(model, X_test, y_test):
    """Evaluate model on test data."""
    # Isolation Forest: -1 = anomaly, 1 = normal
    raw_predictions = model.predict(X_test)
    # Convert: anomaly=-1 -> 1 (attack), normal=1 -> 0 (normal)
    predictions = (raw_predictions == -1).astype(int)

    # Anomaly scores (lower = more anomalous in sklearn)
    raw_scores = model.decision_function(X_test)
    # Convert to 0-1 range where higher = more anomalous
    anomaly_scores = 1 - (raw_scores - raw_scores.min()) / (raw_scores.max() - raw_scores.min())

    print("\n[Model] === Evaluation Results ===")
    print(classification_report(y_test, predictions, target_names=["Normal", "Attack"]))

    try:
        auc = roc_auc_score(y_test, anomaly_scores)
        print(f"[Model] ROC AUC Score: {auc:.4f}")
    except Exception as e:
        print(f"[Model] Could not compute AUC: {e}")


def load_model():
    """Load trained model, scaler, and feature columns."""
    model_path = os.path.join(MODEL_DIR, "isolation_forest.joblib")
    scaler_path = os.path.join(MODEL_DIR, "scaler.joblib")
    features_path = os.path.join(MODEL_DIR, "feature_cols.joblib")

    if not os.path.exists(model_path):
        print("[Model] No trained model found. Training now...")
        train_model()

    model = joblib.load(model_path)
    scaler = joblib.load(scaler_path)
    feature_cols = joblib.load(features_path)

    return model, scaler, feature_cols


def score_log_entry(model, scaler, log_features):
    """
    Score a single log entry.

    Args:
        model: Trained Isolation Forest
        scaler: Fitted MinMaxScaler
        log_features: numpy array of feature values (already in correct order)

    Returns:
        anomaly_score: float between 0 and 1 (higher = more anomalous)
        is_anomalous: bool
    """
    features_scaled = scaler.transform(log_features.reshape(1, -1))
    raw_score = model.decision_function(features_scaled)[0]
    prediction = model.predict(features_scaled)[0]

    # Convert decision_function to 0-1 scale
    # Isolation Forest: more negative = more anomalous
    # We map to [0, 1] where 1 = most anomalous
    anomaly_score = max(0.0, min(1.0, 0.5 - raw_score))

    is_anomalous = bool(prediction == -1)

    return round(anomaly_score, 4), is_anomalous


if __name__ == "__main__":
    train_model()
