"""
NSL-KDD Dataset Downloader & Preprocessor.

Downloads the NSL-KDD dataset from the official UNB repository,
cleans and preprocesses it for use with the Isolation Forest model.
"""

import os
import urllib.request
import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder, MinMaxScaler
import joblib

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")

# NSL-KDD column names (41 features + label + difficulty)
NSL_KDD_COLUMNS = [
    "duration", "protocol_type", "service", "flag", "src_bytes", "dst_bytes",
    "land", "wrong_fragment", "urgent", "hot", "num_failed_logins", "logged_in",
    "num_compromised", "root_shell", "su_attempted", "num_root",
    "num_file_creations", "num_shells", "num_access_files", "num_outbound_cmds",
    "is_host_login", "is_guest_login", "count", "srv_count", "serror_rate",
    "srv_serror_rate", "rerror_rate", "srv_rerror_rate", "same_srv_rate",
    "diff_srv_rate", "srv_diff_host_rate", "dst_host_count", "dst_host_srv_count",
    "dst_host_same_srv_rate", "dst_host_diff_srv_rate", "dst_host_same_src_port_rate",
    "dst_host_srv_diff_host_rate", "dst_host_serror_rate", "dst_host_srv_serror_rate",
    "dst_host_rerror_rate", "dst_host_srv_rerror_rate", "label", "difficulty"
]

# Features selected for our anomaly detection (mapped to SentinelMesh domain)
SELECTED_FEATURES = [
    "duration", "src_bytes", "dst_bytes", "count", "srv_count",
    "num_failed_logins", "serror_rate", "rerror_rate",
    "same_srv_rate", "diff_srv_rate", "dst_host_count",
    "dst_host_srv_count", "dst_host_same_srv_rate",
    "dst_host_diff_srv_rate", "dst_host_serror_rate",
    "dst_host_rerror_rate", "hot", "num_compromised",
    "protocol_type_encoded", "service_encoded", "flag_encoded"
]

TRAIN_URL = "https://raw.githubusercontent.com/defcom17/NSL_KDD/master/KDDTrain+.txt"
TEST_URL = "https://raw.githubusercontent.com/defcom17/NSL_KDD/master/KDDTest+.txt"


def download_dataset():
    """Download NSL-KDD dataset if not already present."""
    os.makedirs(DATA_DIR, exist_ok=True)

    train_path = os.path.join(DATA_DIR, "KDDTrain+.txt")
    test_path = os.path.join(DATA_DIR, "KDDTest+.txt")

    if not os.path.exists(train_path):
        print("[Dataset] Downloading NSL-KDD training data...")
        urllib.request.urlretrieve(TRAIN_URL, train_path)
        print("[Dataset] Training data downloaded.")

    if not os.path.exists(test_path):
        print("[Dataset] Downloading NSL-KDD test data...")
        urllib.request.urlretrieve(TEST_URL, test_path)
        print("[Dataset] Test data downloaded.")

    return train_path, test_path


def load_and_preprocess(filepath):
    """Load and preprocess NSL-KDD data."""
    df = pd.read_csv(filepath, names=NSL_KDD_COLUMNS, header=None)

    # Drop the difficulty column
    df = df.drop(columns=["difficulty"], errors="ignore")

    # Create binary label: 0 = normal, 1 = attack
    df["is_attack"] = (df["label"] != "normal").astype(int)

    # Encode categorical features
    label_encoders = {}
    for col in ["protocol_type", "service", "flag"]:
        le = LabelEncoder()
        df[f"{col}_encoded"] = le.fit_transform(df[col])
        label_encoders[col] = le

    # Drop original categorical and label columns
    df = df.drop(columns=["protocol_type", "service", "flag", "label"])

    # Handle infinities and NaN
    df = df.replace([np.inf, -np.inf], np.nan)
    df = df.fillna(0)

    return df, label_encoders


def preprocess_and_scale(train_path, test_path):
    """Full preprocessing pipeline: load, clean, scale, save."""
    os.makedirs(MODEL_DIR, exist_ok=True)

    print("[Preprocessing] Loading training data...")
    train_df, label_encoders = load_and_preprocess(train_path)

    print("[Preprocessing] Loading test data...")
    test_df, _ = load_and_preprocess(test_path)

    # Select features
    feature_cols = [c for c in SELECTED_FEATURES if c in train_df.columns]

    X_train = train_df[feature_cols].values
    y_train = train_df["is_attack"].values
    X_test = test_df[feature_cols].values
    y_test = test_df["is_attack"].values

    # Normalize with MinMaxScaler
    scaler = MinMaxScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Save scaler and encoders
    joblib.dump(scaler, os.path.join(MODEL_DIR, "scaler.joblib"))
    joblib.dump(label_encoders, os.path.join(MODEL_DIR, "label_encoders.joblib"))
    joblib.dump(feature_cols, os.path.join(MODEL_DIR, "feature_cols.joblib"))

    print(f"[Preprocessing] Training samples: {len(X_train_scaled)} | Test samples: {len(X_test_scaled)}")
    print(f"[Preprocessing] Features used: {len(feature_cols)}")
    print(f"[Preprocessing] Attack ratio (train): {y_train.mean():.2%}")

    return X_train_scaled, y_train, X_test_scaled, y_test, feature_cols


if __name__ == "__main__":
    train_path, test_path = download_dataset()
    X_train, y_train, X_test, y_test, features = preprocess_and_scale(train_path, test_path)
    print("[Preprocessing] Done. Scaler and encoders saved to models/")
