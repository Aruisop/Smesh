"""
Anomaly Detection Service — Main Entry Point.

Consumes logs from Redis Stream 'network_logs',
runs Isolation Forest inference, and publishes results
to Redis Stream 'anomaly_results'.
"""

import json
import os
import time
import numpy as np
import redis

from model import load_model, score_log_entry

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
INPUT_STREAM = "network_logs"
OUTPUT_STREAM = "anomaly_results"
CONSUMER_GROUP = "anomaly_detector_group"
CONSUMER_NAME = "detector_1"

# Mapping from log fields to model feature positions
# The model uses NSL-KDD features; we map our simulated log fields to the closest equivalents
FEATURE_MAPPING = {
    "duration": lambda log: 0,  # simulated logs don't have duration
    "src_bytes": lambda log: log.get("packet_size", 0),
    "dst_bytes": lambda log: log.get("packet_size", 0) // 2,
    "count": lambda log: int(log.get("request_rate", 1)),
    "srv_count": lambda log: int(log.get("request_rate", 1) * 0.8),
    "num_failed_logins": lambda log: log.get("failed_auth", 0),
    "serror_rate": lambda log: 0.8 if log.get("event_type") in ["port_scan", "brute_force"] else 0.02,
    "rerror_rate": lambda log: 0.6 if log.get("event_type") == "port_scan" else 0.01,
    "same_srv_rate": lambda log: 0.1 if log.get("event_type") == "port_scan" else 0.9,
    "diff_srv_rate": lambda log: 0.9 if log.get("event_type") == "port_scan" else 0.1,
    "dst_host_count": lambda log: int(log.get("request_rate", 1) * 2),
    "dst_host_srv_count": lambda log: int(log.get("request_rate", 1)),
    "dst_host_same_srv_rate": lambda log: 0.2 if log.get("event_type") in ["port_scan", "dns_anomaly"] else 0.85,
    "dst_host_diff_srv_rate": lambda log: 0.8 if log.get("event_type") == "port_scan" else 0.15,
    "dst_host_serror_rate": lambda log: 0.7 if log.get("event_type") in ["port_scan", "brute_force"] else 0.03,
    "dst_host_rerror_rate": lambda log: 0.5 if log.get("event_type") == "port_scan" else 0.02,
    "hot": lambda log: 1 if log.get("failed_auth", 0) > 0 else 0,
    "num_compromised": lambda log: min(log.get("failed_auth", 0), 10),
    "protocol_type_encoded": lambda log: {"TCP": 0, "UDP": 1, "ICMP": 2, "DNS": 1}.get(log.get("protocol", "TCP"), 0),
    "service_encoded": lambda log: {22: 0, 53: 1, 80: 2, 443: 3, 3306: 4, 3389: 5, 5432: 6, 8080: 7}.get(log.get("dst_port", 80), 2),
    "flag_encoded": lambda log: 0 if log.get("event_type") == "normal" else 5,
}


def extract_features(log_entry, feature_cols):
    """Extract feature vector from a log entry dict."""
    features = []
    for col in feature_cols:
        mapper = FEATURE_MAPPING.get(col)
        if mapper:
            features.append(float(mapper(log_entry)))
        else:
            features.append(0.0)
    return np.array(features)


def main():
    print("[AnomalyDetector] Loading model...")
    model, scaler, feature_cols = load_model()
    print(f"[AnomalyDetector] Model loaded with {len(feature_cols)} features.")

    print(f"[AnomalyDetector] Connecting to Redis at {REDIS_HOST}:{REDIS_PORT}")
    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

    # Wait for Redis
    while True:
        try:
            r.ping()
            break
        except redis.ConnectionError:
            print("[AnomalyDetector] Waiting for Redis...")
            time.sleep(2)

    # Create consumer group
    try:
        r.xgroup_create(INPUT_STREAM, CONSUMER_GROUP, id="0", mkstream=True)
    except redis.exceptions.ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise

    print(f"[AnomalyDetector] Listening on stream '{INPUT_STREAM}'...")
    processed = 0

    while True:
        try:
            # Read from stream
            messages = r.xreadgroup(
                CONSUMER_GROUP, CONSUMER_NAME,
                {INPUT_STREAM: ">"},
                count=10, block=2000
            )

            if not messages:
                continue

            for stream_name, entries in messages:
                for msg_id, msg_data in entries:
                    try:
                        log_entry = json.loads(msg_data.get("data", "{}"))

                        # Extract features and score
                        features = extract_features(log_entry, feature_cols)
                        anomaly_score, is_anomalous = score_log_entry(model, scaler, features)

                        # Build result
                        result = {
                            **log_entry,
                            "anomaly_score": anomaly_score,
                            "is_anomalous": is_anomalous,
                            "status": "anomalous" if is_anomalous else "normal",
                        }

                        # Publish to output stream
                        r.xadd(OUTPUT_STREAM, {"data": json.dumps(result)}, maxlen=10000)

                        # Acknowledge message
                        r.xack(INPUT_STREAM, CONSUMER_GROUP, msg_id)

                        processed += 1
                        if processed % 20 == 0:
                            print(f"[AnomalyDetector] Processed {processed} logs "
                                  f"(latest: score={anomaly_score}, anomalous={is_anomalous})")

                    except Exception as e:
                        print(f"[AnomalyDetector] Error processing message: {e}")
                        r.xack(INPUT_STREAM, CONSUMER_GROUP, msg_id)

        except Exception as e:
            print(f"[AnomalyDetector] Stream error: {e}")
            time.sleep(2)


if __name__ == "__main__":
    main()
