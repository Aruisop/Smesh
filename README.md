# 🛡️ SentinelMesh — AI-Powered Network & O-RAN Security Platform

<div align="center">

**Real-time threat detection, MITRE ATT&CK + FiGHT classification, and Zero-Trust A1 policy auditing for enterprise network and Open RAN environments.**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Go](https://img.shields.io/badge/Go-1.21%2B-00ADD8?style=flat-square&logo=go)](https://golang.org/)
[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?style=flat-square&logo=python)](https://python.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)](https://docs.docker.com/compose/)
[![Redis Streams](https://img.shields.io/badge/Redis-Streams-DC382D?style=flat-square&logo=redis)](https://redis.io/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?style=flat-square&logo=socket.io)](https://socket.io/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

</div>

---

## 📸 Platform Interface

### Interactive SOC Dashboard
<img width="100%" alt="SOC Dashboard Main View" src="https://github.com/user-attachments/assets/86ef13f3-6654-4077-af2e-8cfe5d5b3b6e" />

### Anomaly Detection & Threat Mapping
<img width="100%" alt="Threat Topology" src="https://github.com/user-attachments/assets/68987c50-2f1b-4fa1-bb48-ff24abbc90bb" />
<img width="100%" alt="Security Analytics" src="https://github.com/user-attachments/assets/5c627838-92c0-459f-a9dc-d2af740ac035" />
<img width="100%" alt="MITRE Framework" src="https://github.com/user-attachments/assets/8ae1f80c-909f-40d1-8fb1-0c5cc71f91be" />

### Zero-Trust O-RAN Policy Audit
<img width="100%" alt="O-RAN Audit Rules" src="https://github.com/user-attachments/assets/e5a63efc-6856-427c-8b21-5ddc43271836" />

### Secure GitHub OAuth Login
<img width="100%" alt="Authentication Portal" src="https://github.com/user-attachments/assets/2db4d4cd-a6d5-4854-8fbd-a542e7e96e0e" />

---

## 📡 Overview

SentinelMesh is a polyglot microservices platform that performs **real-time network intrusion detection** and **O-RAN (Open RAN) security assurance**. It combines ML-based anomaly detection (Isolation Forest), a Go threat scoring engine, and a React SOC dashboard with real-time WebSocket updates.

### What Makes This Enterprise-Grade

| Feature | Implementation |
|---------|---------------|
| **MITRE ATT&CK + FiGHT** | 11 threat classifications (5 network + 5 telecom + normal) mapped to MITRE techniques |
| **O-RAN Security** | A1 policy audit engine, O1 PM telemetry, RAN cell health monitoring |
| **Zero-Trust Policy Audit** | Validates A1 policies against O-RAN TS 803, 3GPP TS 33.501, NIST SP 800-187 |
| **Real-time Streaming** | Socket.IO bidirectional events + Redis Streams message bus |
| **ML Pipeline** | Isolation Forest anomaly detection with feature engineering |
| **Security Posture** | Aggregated risk score across 6 compliance areas |
| **Observability** | Prometheus metrics, structured logging (Pino), health endpoints |
| **Authentication** | GitHub OAuth 2.0 + JWT sessions + rate limiting |

---

## 🏗️ Architecture

```mermaid
graph TD
    classDef frontend fill:#3b82f6,stroke:#1e40af,stroke-width:2px,color:#fff;
    classDef backend fill:#10b981,stroke:#047857,stroke-width:2px,color:#fff;
    classDef data fill:#ef4444,stroke:#b91c1c,stroke-width:2px,color:#fff;
    classDef external fill:#8b5cf6,stroke:#5b21b6,stroke-width:2px,color:#fff;

    User((SOC Analyst)):::external
    GH[GitHub OAuth]:::external

    subgraph "Frontend Layer"
        UI[React + Vite Dashboard]:::frontend
    end

    subgraph "Backend Services"
        AGW[API Gateway<br/>Node.js + Express]:::backend
        TE[Threat Engine<br/>Golang]:::backend
        AD[Anomaly Detector<br/>Python + scikit-learn]:::backend
        LG[Telemetry Generator<br/>Python]:::backend
    end

    subgraph "State & Messaging"
        R[(Redis Cluster<br/>Streams, Pub/Sub, Hash)]:::data
    end

    User <-->|HTTPS / WebSockets| UI
    UI <-->|REST API + Socket.IO| AGW
    UI -.->|SSO Authentication| GH
    AGW -.->|Token Verification| GH

    AGW <-->|Read Data / Subscribe Events| R
    TE <-->|Read/Write Streams / Publish| R
    AD <-->|Read/Write Streams| R
    LG -->|Write Streams| R
```

### Event-Driven Data Flow
```mermaid
sequenceDiagram
    participant LG as Log Generator (Python)
    participant R as Redis (Streams & Pub/Sub)
    participant AD as ML Detector (Python)
    participant TE as Threat Engine (Go)
    participant AGW as API Gateway (Node.js)
    participant UI as React App

    LG->>R: 1. Push Raw JSON to 'network_logs' Stream
    R-->>AD: 2. XREADGROUP Consumer Fetch
    
    rect rgb(236, 253, 245)
        Note over AD: 3. Feature Mapping (21-columns)<br/>Isolation Forest Inference
    end
    
    AD->>R: 4. Push Scored Log to 'anomaly_results' Stream
    R-->>TE: 5. XREADGROUP Consumer Fetch
    
    rect rgb(254, 252, 232)
        Note over TE: 6. Apply Domain Rules (MITRE FiGHT)<br/>Calculate Final Threat Score
    end
    
    TE->>R: 7. Store to ZSET 'alerts_by_score'
    TE-xR: 8. Publish to 'sentinel:events' Pub/Sub
    
    R--xAGW: 9. Node.js Catch Pub/Sub Event
    AGW--xUI: 10. Emit Websocket 'threat:new'
    UI->>UI: 11. Re-render Dashboard Instantly

```
 
### O-RAN (Open RAN) Security Integration Model
```mermaid
flowchart LR

classDef telco fill:#f59e0b,stroke:#b45309,stroke-width:2px,color:#fff;
classDef model fill:#6366f1,stroke:#4338ca,stroke-width:2px,color:#fff;
classDef dash fill:#10b981,stroke:#047857,stroke-width:2px,color:#fff;
classDef invis fill:none,stroke:none;

subgraph Modeled_5G_ORAN["Modeled 5G / O-RAN Infrastructure"]
direction TB
    spacer1[" "]:::invis
    gNB["gNodeB / Cell Tower<br/>PRB & RRC"]:::telco
    AMF["Core AMF<br/>Signaling Protocols"]:::telco
    RIC["Non-RT RIC<br/>rApp Publisher"]:::telco
end

subgraph SentinelMesh_Domain["SentinelMesh Domain"]
direction TB
    spacer2[" "]:::invis
    O1["O1 PM Telemetry<br/>Health Monitor"]:::model
    A1["A1 Policy Auditor<br/>Zero-Trust Rules"]:::model
    ML["Volumetric Threat<br/>Detection"]:::model
end

Dashboard["SOC Security Dashboard"]:::dash

gNB -.->|TS 28.552 PM Counters| O1
AMF -.->|NAS / RRC Session Data| ML
RIC -.->|Intent-based Traffic Policies| A1
A1 -.->|Verification & Audit Status| RIC

O1 --> Dashboard
A1 --> Dashboard
ML --> Dashboard
```

### GitOps CI/CD Pipeline Flow
```mermaid
flowchart TD
    classDef action fill:#1f2937,stroke:#111827,stroke-width:2px,color:#fff;
    classDef registry fill:#ec4899,stroke:#be185d,stroke-width:2px,color:#fff;

    DEV((Developer)) -->|git push origin main| GHA[GitHub Actions]:::action
    
    subgraph "Continuous Integration"
        GHA --> B1[Build Threat-Engine]:::action
        GHA --> B2[Build Anomaly-Detector]:::action
        GHA --> B3[Build API-Gateway]:::action
        GHA --> B4[Build React Frontend]:::action
    end

    B1 --> GHCR[(GitHub Container<br/>Registry / GHCR)]:::registry
    B2 --> GHCR
    B3 --> GHCR
    B4 --> GHCR
```

---

## 🚀 Key Features

### 🔐 Network Security
- **ML Anomaly Detection** — Isolation Forest model trained on network traffic features
- **Real-time Threat Feed** — Socket.IO push for instant alert visibility
- **Threat Intelligence Map** — SVG geo-visualization of attack origins
- **Protocol Analysis** — TCP/UDP/ICMP/DNS distribution + port targeting

### 📡 O-RAN Security Assurance
- **5 Telecom Attack Types** — Rogue gNB, handover hijack, signaling storm, slice access violation, IMSI catcher
- **O1 PM Counters** — PRB utilization, RRC setup rate, handover success, RSRP/SINR/CQI, throughput, latency
- **A1 Policy Audit** — Zero-trust validation against O-RAN TS 803, 3GPP TS 33.501, NIST SP 800-187
- **Security Posture Score** — 0-100 aggregated risk assessment across 6 compliance areas
- **Network Slice Monitoring** — eMBB, URLLC, mMTC, Emergency slice status
- **8 Simulated gNB Cells** — CU/DU architecture with n77/n78/n258/n41 bands

### 📊 MITRE Classification
- **ATT&CK Framework** — T1110 (Brute Force), T1046 (Discovery), T1071 (C2), T1498 (DoS)
- **FiGHT Framework** — FGT1583 (Rogue BS), FGT1599 (Handover Hijack), FGT1498 (Signaling DoS), FGT1562 (Slice Bypass), FGT1040 (IMSI Intercept)
- **Mitigations** — 3GPP TS 33.501, O-RAN WG11, NIST SP 800-187 mapped

### 🖥️ SOC Dashboard
- **12-column responsive grid** with glassmorphism design
- **Animated stat counters** with delta trend indicators
- **Severity donut chart** (pure SVG, no chart library)
- **Threat heatmap** (hour × day matrix)
- **System health monitor** showing all 6 microservices
- **Investigation panel** with O-RAN context and MITRE chain visualization
- **Sidebar navigation** with Overview and O-RAN dedicated views

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + Vite | SOC dashboard SPA |
| **UI** | Custom CSS + Lucide Icons + Recharts | Enterprise SOC theme |
| **API** | Express.js + Socket.IO | REST API + real-time events |
| **ML Service** | Python + scikit-learn | Isolation Forest anomaly detection |
| **Threat Engine** | Go | High-performance scoring & classification |
| **Data Generator** | Python | Network + O-RAN event simulation |
| **Message Bus** | Redis Streams | Async microservice communication |
| **Cache** | Redis | Stats aggregation, sorted sets, lists |
| **Auth** | GitHub OAuth 2.0 + JWT | Identity + session management |
| **Logging** | Pino (structured) | JSON logging with correlation |
| **Metrics** | Prometheus-compatible | `/api/metrics` endpoint |
| **Infra** | Docker Compose | Multi-container orchestration |

---

## 💻 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local dev)
- Go 1.21+ (for local dev)
- Python 3.11+ (for local dev)

### Docker (Recommended)

```bash
git clone https://github.com/yourusername/sentinelmesh.git
cd sentinelmesh

# Copy and configure environment
cp .env.example .env

# Launch all services
docker compose up --build
```

### Local Development

```bash
# Terminal 1: Redis
docker run -p 6379:6379 redis:7-alpine

# Terminal 2: Log Generator
cd services/log-generator && pip install redis && python main.py

# Terminal 3: Anomaly Detector
cd services/anomaly-detector && pip install redis scikit-learn numpy && python main.py

# Terminal 4: Threat Engine
cd services/threat-engine && go run main.go

# Terminal 5: API Gateway
cd services/api-gateway && npm install && node server.js

# Terminal 6: Dashboard
cd frontend/dashboard && npm install && npm run dev
```

### Access
- **Dashboard**: http://localhost:5173
- **API Gateway**: http://localhost:3001
- **Health Check**: http://localhost:3001/api/health
- **Metrics**: http://localhost:3001/api/metrics

---

## 📂 Repository Structure

```
sentinelmesh/
├── services/
│   ├── log-generator/         # Python — Network + O-RAN event simulation
│   │   └── main.py            # 10 event types + O1 telemetry + A1 policies
│   ├── anomaly-detector/      # Python — ML anomaly detection pipeline
│   │   └── main.py            # Isolation Forest with feature engineering
│   ├── threat-engine/         # Go — High-performance threat scoring
│   │   └── main.go            # Network + telecom classification
│   └── api-gateway/           # Node.js — REST/WebSocket API
│       └── server.js          # OAuth, MITRE, O-RAN endpoints
├── frontend/
│   └── dashboard/             # React 18 — SOC Dashboard
│       └── src/
│           ├── components/    # 14 visualization components
│           ├── pages/         # Dashboard, Login, AuthCallback
│           └── context/       # AuthContext with Socket.IO
├── infra/
│   └── docker-compose.yml     # Multi-container orchestration
├── .env.example               # Environment configuration
└── README.md                  # This file
```

---

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/github` | Initiate GitHub OAuth flow |
| GET | `/auth/github/callback` | OAuth callback handler |
| POST | `/auth/demo` | Demo login (no OAuth needed) |
| GET | `/auth/verify` | Verify JWT token |

### Security Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/alerts` | Threat alerts (sorted by score) |
| GET | `/api/attackers` | Top attacker IPs |
| GET | `/api/traffic` | Recent traffic entries |
| GET | `/api/anomalies` | Anomaly timeline data |
| GET | `/api/topology` | Network topology nodes/edges |
| GET | `/api/mitre` | MITRE ATT&CK + FiGHT mappings |

### O-RAN
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/oran/telemetry` | O1 PM counters for all gNB cells |
| GET | `/api/oran/policies` | A1 policies with risk scoring |
| POST | `/api/oran/policies/audit` | Zero-trust policy validation |
| GET | `/api/oran/slices` | Network slice status |
| GET | `/api/oran/posture` | Security posture score |

### Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check (no auth) |
| GET | `/api/metrics` | Prometheus metrics (no auth) |

---

## 📡 O-RAN Domain Details

### Simulated RAN Infrastructure
| Cell ID | Type | Band | Location |
|---------|------|------|----------|
| gNB-CU-001 | Macro | n78 | Downtown Core Sector 1 |
| gNB-CU-002 | Macro | n78 | Downtown Core Sector 2 |
| gNB-CU-003 | Macro | n78 | Downtown Core Sector 3 |
| gNB-DU-101 | Small Cell | n258 | Westfield Mall |
| gNB-DU-102 | Small Cell | n258 | City Stadium |
| gNB-DU-103 | Small Cell | n77 | Central Hospital |
| gNB-CU-004 | Rural | n41 | Highway A1 Sector 1 |
| gNB-CU-005 | Rural | n41 | Highway A1 Sector 2 |

### Network Slices
| Slice | SST | Purpose |
|-------|-----|---------|
| SLICE-eMBB-01 | 1 | Enhanced Mobile Broadband |
| SLICE-URLLC-01 | 2 | Ultra-Reliable Low Latency |
| SLICE-mMTC-01 | 3 | Massive Machine Type Comm |
| SLICE-EMRG-01 | 5 | Emergency Services |

### Telecom Attack Classifications

| Event Type | MITRE FiGHT | Description |
|-----------|-------------|-------------|
| `rogue_basestation` | FGT1583.501 | Fake gNB impersonation → MITM |
| `handover_hijack` | FGT1599.001 | A3-Event offset manipulation |
| `signaling_storm` | FGT1498.502 | NAS/RRC flooding on AMF |
| `unauthorized_slice_access` | FGT1562.501 | S-NSSAI boundary violation |
| `imsi_catcher` | FGT1040.501 | 5G→4G downgrade + SUPI capture |

### Policy Audit Standards
- **O-RAN TS 803** — Security Requirements (Zero-Trust)
- **3GPP TS 33.501** — 5G System Security Architecture
- **3GPP TS 33.813** — Network Slice Security
- **NIST SP 800-187** — 5G Cybersecurity
- **O-RAN WG11** — Security Threat Modeling

---

## 🧪 Development

### Run Tests
```bash
# Backend tests (when available)
cd services/anomaly-detector && pytest tests/

# Frontend lint
cd frontend/dashboard && npm run lint
```

### Environment Variables
```env
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secret-key
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=http://localhost:3001/auth/github/callback
FRONTEND_URL=http://localhost:5173
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with ❤️ for enterprise security operations**

*SentinelMesh demonstrates proficiency in microservice architecture, real-time data streaming, ML-based threat detection, O-RAN security assurance, and production-grade DevOps practices.*

</div>
