"""
SentinelMesh Log Generator v3.0

Generates both traditional network security logs AND O-RAN/telecom-specific
telemetry events including:
- Standard: brute_force, port_scan, dns_anomaly, packet_spike
- Telecom: rogue_basestation, handover_hijack, ran_dos, signaling_storm,
           imsi_catcher, unauthorized_slice_access

Publishes to Redis Streams for consumption by the anomaly detection pipeline.
Publishes O1 telemetry counters separately for the RAN health monitor.
"""

import json
import time
import random
import os
import math
from datetime import datetime, timezone

import redis

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
STREAM_NAME = "network_logs"
O1_TELEMETRY_KEY = "o1_telemetry"
RAN_CELLS_KEY = "ran_cells"
LOG_INTERVAL = float(os.getenv("LOG_INTERVAL", 0.5))

PROTOCOLS = ["TCP", "UDP", "ICMP", "DNS"]
COMMON_PORTS = [22, 53, 80, 443, 3306, 3389, 5432, 8080, 8443]
ATTACK_PORTS = [22, 23, 3389, 445, 1433, 5900]

INTERNAL_IPS = [f"192.168.1.{i}" for i in range(1, 50)] + \
               [f"10.0.0.{i}" for i in range(1, 30)]
EXTERNAL_IPS = [f"172.16.{random.randint(0,255)}.{random.randint(1,254)}" for _ in range(40)] + \
               [f"203.0.113.{random.randint(1,254)}" for _ in range(20)]

ATTACKER_IPS = [
    "192.168.1.24", "10.0.0.12", "172.16.5.10",
    "203.0.113.42", "172.16.99.7", "192.168.1.100",
]

# ─── O-RAN Cell Configuration ───
RAN_CELLS = [
    {"cell_id": "gNB-CU-001", "cell_name": "Macro-Urban-01", "band": "n78", "sector": 1, "location": "Downtown Core"},
    {"cell_id": "gNB-CU-002", "cell_name": "Macro-Urban-02", "band": "n78", "sector": 2, "location": "Downtown Core"},
    {"cell_id": "gNB-CU-003", "cell_name": "Macro-Urban-03", "band": "n78", "sector": 3, "location": "Downtown Core"},
    {"cell_id": "gNB-DU-101", "cell_name": "Small-Cell-Mall", "band": "n258", "sector": 1, "location": "Westfield Mall"},
    {"cell_id": "gNB-DU-102", "cell_name": "Small-Cell-Stadium", "band": "n258", "sector": 1, "location": "City Stadium"},
    {"cell_id": "gNB-DU-103", "cell_name": "Small-Cell-Hospital", "band": "n77", "sector": 1, "location": "Central Hospital"},
    {"cell_id": "gNB-CU-004", "cell_name": "Rural-Site-A", "band": "n41", "sector": 1, "location": "Highway A1"},
    {"cell_id": "gNB-CU-005", "cell_name": "Rural-Site-B", "band": "n41", "sector": 2, "location": "Highway A1"},
]

NETWORK_SLICES = [
    {"slice_id": "SLICE-eMBB-01", "sst": 1, "sd": "0x010001", "name": "Enhanced Mobile Broadband"},
    {"slice_id": "SLICE-URLLC-01", "sst": 2, "sd": "0x020001", "name": "Ultra-Reliable Low Latency"},
    {"slice_id": "SLICE-mMTC-01", "sst": 3, "sd": "0x030001", "name": "Massive Machine Type Comm"},
    {"slice_id": "SLICE-EMRG-01", "sst": 5, "sd": "0x050001", "name": "Emergency Services"},
]


# ─── Standard Network Log Generators ───

def generate_normal_log():
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "src_ip": random.choice(INTERNAL_IPS + EXTERNAL_IPS),
        "dst_ip": random.choice(INTERNAL_IPS),
        "protocol": random.choice(PROTOCOLS),
        "packet_size": random.randint(64, 1500),
        "src_port": random.randint(1024, 65535),
        "dst_port": random.choice(COMMON_PORTS),
        "failed_auth": 0,
        "request_rate": round(random.uniform(0.1, 5.0), 2),
        "ip_entropy": round(random.uniform(0.1, 0.5), 4),
        "event_type": "normal",
    }


def generate_brute_force_log():
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "src_ip": random.choice(ATTACKER_IPS),
        "dst_ip": random.choice(INTERNAL_IPS[:10]),
        "protocol": "TCP",
        "packet_size": random.randint(64, 256),
        "src_port": random.randint(1024, 65535),
        "dst_port": random.choice([22, 3389, 23]),
        "failed_auth": random.randint(5, 50),
        "request_rate": round(random.uniform(20.0, 100.0), 2),
        "ip_entropy": round(random.uniform(0.1, 0.3), 4),
        "event_type": "brute_force",
    }


def generate_port_scan_log():
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "src_ip": random.choice(ATTACKER_IPS),
        "dst_ip": random.choice(INTERNAL_IPS),
        "protocol": "TCP",
        "packet_size": random.randint(40, 64),
        "src_port": random.randint(1024, 65535),
        "dst_port": random.randint(1, 65535),
        "failed_auth": 0,
        "request_rate": round(random.uniform(50.0, 200.0), 2),
        "ip_entropy": round(random.uniform(0.7, 1.0), 4),
        "event_type": "port_scan",
    }


def generate_dns_anomaly_log():
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "src_ip": random.choice(ATTACKER_IPS),
        "dst_ip": random.choice(INTERNAL_IPS),
        "protocol": "DNS",
        "packet_size": random.randint(200, 4096),
        "src_port": random.randint(1024, 65535),
        "dst_port": 53,
        "failed_auth": 0,
        "request_rate": round(random.uniform(30.0, 150.0), 2),
        "ip_entropy": round(random.uniform(0.6, 0.9), 4),
        "event_type": "dns_anomaly",
    }


def generate_packet_spike_log():
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "src_ip": random.choice(ATTACKER_IPS + EXTERNAL_IPS[:5]),
        "dst_ip": random.choice(INTERNAL_IPS[:5]),
        "protocol": random.choice(["TCP", "UDP"]),
        "packet_size": random.randint(1200, 9000),
        "src_port": random.randint(1024, 65535),
        "dst_port": random.choice([80, 443, 8080]),
        "failed_auth": 0,
        "request_rate": round(random.uniform(100.0, 500.0), 2),
        "ip_entropy": round(random.uniform(0.5, 0.8), 4),
        "event_type": "packet_spike",
    }


# ─── O-RAN / Telecom-specific Attack Generators ───

def generate_rogue_basestation_log():
    """Simulate rogue gNB/eNB attempting to impersonate legitimate cell."""
    cell = random.choice(RAN_CELLS)
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "src_ip": random.choice(ATTACKER_IPS),
        "dst_ip": random.choice(INTERNAL_IPS[:5]),
        "protocol": "SCTP",
        "packet_size": random.randint(200, 800),
        "src_port": random.randint(30000, 40000),
        "dst_port": 38412,  # NGAP port
        "failed_auth": random.randint(3, 15),
        "request_rate": round(random.uniform(10.0, 50.0), 2),
        "ip_entropy": round(random.uniform(0.6, 0.9), 4),
        "event_type": "rogue_basestation",
        "cell_id": cell["cell_id"],
        "ran_context": {
            "spoofed_cell": cell["cell_id"],
            "signal_strength": round(random.uniform(-40, -20), 1),
            "legitimate_rsrp": round(random.uniform(-90, -70), 1),
        },
    }


def generate_handover_hijack_log():
    """Simulate unauthorized handover forcing UEs to rogue cell."""
    src_cell = random.choice(RAN_CELLS[:3])
    dst_cell = random.choice(RAN_CELLS[3:])
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "src_ip": random.choice(ATTACKER_IPS),
        "dst_ip": random.choice(INTERNAL_IPS[:5]),
        "protocol": "SCTP",
        "packet_size": random.randint(300, 600),
        "src_port": random.randint(30000, 40000),
        "dst_port": 36421,  # X2-AP port
        "failed_auth": 0,
        "request_rate": round(random.uniform(40.0, 120.0), 2),
        "ip_entropy": round(random.uniform(0.5, 0.8), 4),
        "event_type": "handover_hijack",
        "cell_id": src_cell["cell_id"],
        "ran_context": {
            "source_cell": src_cell["cell_id"],
            "target_cell": dst_cell["cell_id"],
            "handover_cause": "Forced-A3-Event",
            "affected_ues": random.randint(5, 50),
        },
    }


def generate_signaling_storm_log():
    """Simulate NAS/RRC signaling storm overwhelming AMF/gNB."""
    cell = random.choice(RAN_CELLS)
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "src_ip": random.choice(ATTACKER_IPS),
        "dst_ip": random.choice(INTERNAL_IPS[:3]),
        "protocol": "SCTP",
        "packet_size": random.randint(100, 400),
        "src_port": random.randint(30000, 40000),
        "dst_port": 38412,
        "failed_auth": random.randint(0, 5),
        "request_rate": round(random.uniform(200.0, 1000.0), 2),
        "ip_entropy": round(random.uniform(0.3, 0.6), 4),
        "event_type": "signaling_storm",
        "cell_id": cell["cell_id"],
        "ran_context": {
            "target_cell": cell["cell_id"],
            "msg_type": random.choice(["RRC-Setup-Request", "NAS-Attach", "Service-Request"]),
            "rate_per_sec": random.randint(500, 5000),
        },
    }


def generate_unauthorized_slice_access_log():
    """Simulate unauthorized access to critical network slice (e.g., URLLC/Emergency)."""
    target_slice = random.choice(NETWORK_SLICES[1:])  # not eMBB
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "src_ip": random.choice(ATTACKER_IPS),
        "dst_ip": random.choice(INTERNAL_IPS[:5]),
        "protocol": "TCP",
        "packet_size": random.randint(200, 600),
        "src_port": random.randint(1024, 65535),
        "dst_port": 443,
        "failed_auth": random.randint(2, 10),
        "request_rate": round(random.uniform(5.0, 30.0), 2),
        "ip_entropy": round(random.uniform(0.4, 0.7), 4),
        "event_type": "unauthorized_slice_access",
        "ran_context": {
            "target_slice": target_slice["slice_id"],
            "slice_type": target_slice["name"],
            "sst": target_slice["sst"],
        },
    }


def generate_imsi_catcher_log():
    """Simulate IMSI catcher / fake base station attempting identity capture."""
    cell = random.choice(RAN_CELLS[:3])
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "src_ip": random.choice(ATTACKER_IPS),
        "dst_ip": random.choice(INTERNAL_IPS[:5]),
        "protocol": "SCTP",
        "packet_size": random.randint(150, 500),
        "src_port": random.randint(30000, 40000),
        "dst_port": 38412,
        "failed_auth": random.randint(5, 20),
        "request_rate": round(random.uniform(15.0, 60.0), 2),
        "ip_entropy": round(random.uniform(0.7, 1.0), 4),
        "event_type": "imsi_catcher",
        "cell_id": cell["cell_id"],
        "ran_context": {
            "near_cell": cell["cell_id"],
            "identity_requests": random.randint(20, 200),
            "downgrade_attempt": random.choice([True, False]),
        },
    }


# ─── O1 Telemetry / PM Counter Generation ───

def generate_o1_telemetry(r):
    """Generate O1 Performance Management counters for all RAN cells."""
    telemetry = []
    for cell in RAN_CELLS:
        is_under_attack = random.random() < 0.15
        pm_counters = {
            "cell_id": cell["cell_id"],
            "cell_name": cell["cell_name"],
            "band": cell["band"],
            "location": cell["location"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            # TS 28.552 PM Counters
            "prb_utilization": round(random.uniform(20, 95) if is_under_attack else random.uniform(15, 65), 1),
            "active_ues": random.randint(50, 500) if is_under_attack else random.randint(10, 200),
            "rrc_setup_success_rate": round(random.uniform(60, 85) if is_under_attack else random.uniform(95, 99.9), 2),
            "rrc_setup_failure_count": random.randint(20, 200) if is_under_attack else random.randint(0, 5),
            "handover_success_rate": round(random.uniform(50, 75) if is_under_attack else random.uniform(90, 99), 2),
            "handover_failure_count": random.randint(10, 80) if is_under_attack else random.randint(0, 3),
            "throughput_dl_mbps": round(random.uniform(10, 100) if is_under_attack else random.uniform(80, 500), 1),
            "throughput_ul_mbps": round(random.uniform(5, 30) if is_under_attack else random.uniform(20, 150), 1),
            "latency_avg_ms": round(random.uniform(20, 100) if is_under_attack else random.uniform(1, 10), 2),
            "packet_loss_rate": round(random.uniform(2, 15) if is_under_attack else random.uniform(0, 0.5), 3),
            "rsrp_avg_dbm": round(random.uniform(-110, -85) if is_under_attack else random.uniform(-85, -60), 1),
            "sinr_avg_db": round(random.uniform(-5, 10) if is_under_attack else random.uniform(10, 30), 1),
            "cqi_avg": round(random.uniform(3, 8) if is_under_attack else random.uniform(8, 15), 1),
            "security_events": random.randint(5, 50) if is_under_attack else random.randint(0, 2),
            "status": "degraded" if is_under_attack else "operational",
        }
        telemetry.append(pm_counters)

    # Store in Redis
    r.set(O1_TELEMETRY_KEY, json.dumps(telemetry))
    r.set(RAN_CELLS_KEY, json.dumps([c["cell_id"] for c in RAN_CELLS]))
    return telemetry


# ─── Aggregated Generators ───

STANDARD_GENERATORS = [
    generate_brute_force_log,
    generate_port_scan_log,
    generate_dns_anomaly_log,
    generate_packet_spike_log,
]

TELECOM_GENERATORS = [
    generate_rogue_basestation_log,
    generate_handover_hijack_log,
    generate_signaling_storm_log,
    generate_unauthorized_slice_access_log,
    generate_imsi_catcher_log,
]


def generate_log():
    """Generate a single log entry. ~60% normal, ~25% standard attack, ~15% telecom attack."""
    roll = random.random()
    if roll < 0.15:
        return random.choice(TELECOM_GENERATORS)()
    elif roll < 0.40:
        return random.choice(STANDARD_GENERATORS)()
    return generate_normal_log()


def main():
    print("[LogGenerator v3.0] Connecting to Redis at {}:{}".format(REDIS_HOST, REDIS_PORT))
    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

    while True:
        try:
            r.ping()
            break
        except redis.ConnectionError:
            print("[LogGenerator] Waiting for Redis...")
            time.sleep(2)

    print("[LogGenerator] Connected. Generating network + O-RAN telemetry to '{}'".format(STREAM_NAME))

    # Store initial A1 policies and network slices
    a1_policies = [
        {
            "policy_id": "A1-POL-001", "policy_type": "A1-P (Traffic Steering)",
            "scope": {"cell_ids": ["gNB-CU-001", "gNB-CU-002"]},
            "statement": {"objective": "Load balance PRB across sectors", "threshold": 70},
            "status": "ACTIVE", "risk_score": 0.12,
        },
        {
            "policy_id": "A1-POL-002", "policy_type": "A1-P (QoS Optimization)",
            "scope": {"slice_id": "SLICE-URLLC-01"},
            "statement": {"objective": "Maintain <5ms latency for URLLC", "threshold": 5},
            "status": "ACTIVE", "risk_score": 0.08,
        },
        {
            "policy_id": "A1-POL-003", "policy_type": "A1-P (Energy Saving)",
            "scope": {"cell_ids": ["gNB-CU-004", "gNB-CU-005"]},
            "statement": {"objective": "Reduce TX power during off-peak", "threshold": 30},
            "status": "AUDIT_REQUIRED", "risk_score": 0.65,
            "audit_flags": ["May impact Emergency Services coverage in rural area"],
        },
        {
            "policy_id": "A1-POL-004", "policy_type": "A1-P (Handover Control)",
            "scope": {"cell_ids": ["gNB-DU-101", "gNB-DU-102"]},
            "statement": {"objective": "Optimize inter-cell handover A3 offset", "threshold": 3},
            "status": "ACTIVE", "risk_score": 0.35,
        },
        {
            "policy_id": "A1-POL-005", "policy_type": "A1-P (Security)",
            "scope": {"cell_ids": ["gNB-CU-001", "gNB-CU-002", "gNB-CU-003"]},
            "statement": {"objective": "Block unverified X2 handover requests", "threshold": 0},
            "status": "ACTIVE", "risk_score": 0.05,
        },
    ]
    r.set("a1_policies", json.dumps(a1_policies))
    r.set("network_slices", json.dumps([{**s, "status": "ACTIVE", "ue_count": random.randint(50, 500)} for s in NETWORK_SLICES]))

    count = 0
    telemetry_tick = 0

    while True:
        log_entry = generate_log()
        r.xadd(STREAM_NAME, {"data": json.dumps(log_entry)}, maxlen=10000)
        count += 1

        # Generate O1 telemetry every 10 logs
        telemetry_tick += 1
        if telemetry_tick >= 10:
            generate_o1_telemetry(r)
            # Update slice status
            slices = [
                {**s, "status": "ACTIVE", "ue_count": random.randint(50, 500)}
                for s in NETWORK_SLICES
            ]
            r.set("network_slices", json.dumps(slices))
            telemetry_tick = 0

        if count % 20 == 0:
            print("[LogGenerator] Published {} logs (latest: {} from {})".format(
                count, log_entry["event_type"], log_entry["src_ip"]))
        time.sleep(LOG_INTERVAL)


if __name__ == "__main__":
    main()
