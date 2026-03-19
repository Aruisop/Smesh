package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"os"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// AnomalyResult represents a scored log from the anomaly detector
type AnomalyResult struct {
	Timestamp    string  `json:"timestamp"`
	SrcIP        string  `json:"src_ip"`
	DstIP        string  `json:"dst_ip"`
	Protocol     string  `json:"protocol"`
	PacketSize   int     `json:"packet_size"`
	SrcPort      int     `json:"src_port"`
	DstPort      int     `json:"dst_port"`
	FailedAuth   int     `json:"failed_auth"`
	RequestRate  float64 `json:"request_rate"`
	IPEntropy    float64 `json:"ip_entropy"`
	EventType    string  `json:"event_type"`
	AnomalyScore float64 `json:"anomaly_score"`
	IsAnomalous  bool    `json:"is_anomalous"`
	Status       string  `json:"status"`
	// O-RAN fields (optional)
	CellID     string                 `json:"cell_id,omitempty"`
	RANContext map[string]interface{} `json:"ran_context,omitempty"`
}

// ThreatAlert is the final scored alert
type ThreatAlert struct {
	ID             string                 `json:"id"`
	Timestamp      string                 `json:"timestamp"`
	SrcIP          string                 `json:"src_ip"`
	DstIP          string                 `json:"dst_ip"`
	Protocol       string                 `json:"protocol"`
	DstPort        int                    `json:"dst_port"`
	EventType      string                 `json:"event_type"`
	AnomalyScore   float64                `json:"anomaly_score"`
	ThreatScore    float64                `json:"threat_score"`
	Severity       string                 `json:"severity"`
	AlertType      string                 `json:"alert_type"`
	FailedAttempts int                    `json:"failed_attempts"`
	Description    string                 `json:"description"`
	CellID         string                 `json:"cell_id,omitempty"`
	RANContext     map[string]interface{} `json:"ran_context,omitempty"`
	Domain         string                 `json:"domain"` // "network" or "telecom"
}

const (
	inputStream     = "anomaly_results"
	outputStream    = "threat_alerts"
	consumerGroup   = "threat_engine_group"
	consumerName    = "engine_1"
	alertsSortedSet = "alerts_by_score"
	attackerHashKey = "attacker_ips"
	trafficListKey  = "recent_traffic"
	statsHashKey    = "dashboard_stats"
)

var ctx = context.Background()

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return fallback
}

func classifySeverity(score float64) string {
	switch {
	case score >= 0.8:
		return "HIGH"
	case score >= 0.6:
		return "MEDIUM"
	case score >= 0.3:
		return "SUSPICIOUS"
	default:
		return "NORMAL"
	}
}

// classifyAlertType — supports both standard and O-RAN telecom events
func classifyAlertType(result AnomalyResult) string {
	switch result.EventType {
	case "brute_force":
		return "Brute Force Attempt"
	case "port_scan":
		return "Port Scanning Detected"
	case "dns_anomaly":
		return "Unusual DNS Activity"
	case "packet_spike":
		return "Abnormal Traffic Spike"
	// O-RAN / Telecom-specific event types
	case "rogue_basestation":
		return "Rogue gNB Detection"
	case "handover_hijack":
		return "Unauthorized Handover Manipulation"
	case "signaling_storm":
		return "NAS/RRC Signaling Storm"
	case "unauthorized_slice_access":
		return "Unauthorized Network Slice Access"
	case "imsi_catcher":
		return "IMSI Catcher / Fake Cell Activity"
	default:
		if result.IsAnomalous {
			return "Anomalous Network Activity"
		}
		return "Normal Traffic"
	}
}

// getDomain — determines if event is network or telecom domain
func getDomain(eventType string) string {
	switch eventType {
	case "rogue_basestation", "handover_hijack", "signaling_storm",
		"unauthorized_slice_access", "imsi_catcher":
		return "telecom"
	default:
		return "network"
	}
}

func generateDescription(alert ThreatAlert) string {
	switch alert.AlertType {
	case "Brute Force Attempt":
		return fmt.Sprintf("Possible brute force attack detected from %s. Failed login attempts: %d",
			alert.SrcIP, alert.FailedAttempts)
	case "Port Scanning Detected":
		return fmt.Sprintf("Port scanning activity detected from %s targeting port %d",
			alert.SrcIP, alert.DstPort)
	case "Unusual DNS Activity":
		return fmt.Sprintf("Unusual DNS query volume detected from %s",
			alert.SrcIP)
	case "Abnormal Traffic Spike":
		return fmt.Sprintf("Abnormal packet frequency detected from %s (anomaly score: %.2f)",
			alert.SrcIP, alert.AnomalyScore)
	// O-RAN descriptions
	case "Rogue gNB Detection":
		cellID := alert.CellID
		if cellID == "" {
			cellID = "unknown"
		}
		return fmt.Sprintf("Rogue base station attempting to impersonate cell %s. Source: %s. Potential MITM attack on RAN infrastructure.",
			cellID, alert.SrcIP)
	case "Unauthorized Handover Manipulation":
		return fmt.Sprintf("Unauthorized X2/Xn handover manipulation from %s forcing UE migration. A3 event offset tampering suspected.",
			alert.SrcIP)
	case "NAS/RRC Signaling Storm":
		return fmt.Sprintf("Signaling storm detected from %s overwhelming AMF. Excessive RRC Setup/NAS Attach requests at %.0f req/s.",
			alert.SrcIP, alert.ThreatScore*1000)
	case "Unauthorized Network Slice Access":
		return fmt.Sprintf("Unauthorized access attempt to protected network slice from %s. Failed authentication on S-NSSAI boundary.",
			alert.SrcIP)
	case "IMSI Catcher / Fake Cell Activity":
		return fmt.Sprintf("IMSI catcher activity near cell %s from %s. Identity capture and potential 5G → 4G downgrade attack.",
			alert.CellID, alert.SrcIP)
	default:
		return fmt.Sprintf("Network activity from %s scored %.2f",
			alert.SrcIP, alert.ThreatScore)
	}
}

func calculateThreatScore(result AnomalyResult) float64 {
	score := result.AnomalyScore

	// Standard threat boosting
	if result.FailedAuth > 5 {
		score = math.Min(1.0, score+float64(result.FailedAuth)*0.005)
	}
	if result.RequestRate > 50 {
		score = math.Min(1.0, score+0.1)
	}
	if result.EventType == "brute_force" || result.EventType == "port_scan" {
		score = math.Min(1.0, score+0.15)
	}
	if result.IPEntropy > 0.7 {
		score = math.Min(1.0, score+0.05)
	}

	// O-RAN/Telecom event boosting — these are inherently high-severity
	switch result.EventType {
	case "rogue_basestation":
		score = math.Min(1.0, score+0.30) // Critical: physical layer attack
	case "handover_hijack":
		score = math.Min(1.0, score+0.25) // High: session hijacking
	case "signaling_storm":
		score = math.Min(1.0, score+0.20) // DoS on control plane
	case "unauthorized_slice_access":
		score = math.Min(1.0, score+0.22) // Isolation breach
	case "imsi_catcher":
		score = math.Min(1.0, score+0.28) // Privacy/identity theft
	}

	return math.Round(score*10000) / 10000
}

func main() {
	redisHost := getEnv("REDIS_HOST", "localhost")
	redisPort := getEnv("REDIS_PORT", "6379")
	redisAddr := fmt.Sprintf("%s:%s", redisHost, redisPort)

	log.Printf("[ThreatEngine v3.0] Connecting to Redis at %s", redisAddr)

	rdb := redis.NewClient(&redis.Options{
		Addr:         redisAddr,
		DB:           0,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
	})

	// Wait for Redis
	for {
		if err := rdb.Ping(ctx).Err(); err != nil {
			log.Printf("[ThreatEngine] Waiting for Redis... (%v)", err)
			time.Sleep(2 * time.Second)
			continue
		}
		break
	}
	log.Println("[ThreatEngine] Connected to Redis.")

	// Create consumer group
	err := rdb.XGroupCreateMkStream(ctx, inputStream, consumerGroup, "0").Err()
	if err != nil && !strings.Contains(err.Error(), "BUSYGROUP") {
		log.Printf("[ThreatEngine] Warning creating consumer group: %v", err)
	}

	log.Printf("[ThreatEngine] Listening on stream '%s' (network + O-RAN events)...", inputStream)

	processed := 0
	alertCounter := 0

	for {
		streams, err := rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    consumerGroup,
			Consumer: consumerName,
			Streams:  []string{inputStream, ">"},
			Count:    10,
			Block:    2 * time.Second,
		}).Result()

		if err != nil {
			if err != redis.Nil {
				log.Printf("[ThreatEngine] Read error: %v", err)
				time.Sleep(2 * time.Second)
			}
			continue
		}

		for _, stream := range streams {
			for _, msg := range stream.Messages {
				data, ok := msg.Values["data"].(string)
				if !ok {
					rdb.XAck(ctx, inputStream, consumerGroup, msg.ID)
					continue
				}

				var result AnomalyResult
				if err := json.Unmarshal([]byte(data), &result); err != nil {
					log.Printf("[ThreatEngine] JSON parse error: %v", err)
					rdb.XAck(ctx, inputStream, consumerGroup, msg.ID)
					continue
				}

				// Calculate threat score
				threatScore := calculateThreatScore(result)
				severity := classifySeverity(threatScore)
				alertType := classifyAlertType(result)
				domain := getDomain(result.EventType)

				alertCounter++
				alert := ThreatAlert{
					ID:             fmt.Sprintf("ALERT-%06d", alertCounter),
					Timestamp:      result.Timestamp,
					SrcIP:          result.SrcIP,
					DstIP:          result.DstIP,
					Protocol:       result.Protocol,
					DstPort:        result.DstPort,
					EventType:      result.EventType,
					AnomalyScore:   result.AnomalyScore,
					ThreatScore:    threatScore,
					Severity:       severity,
					AlertType:      alertType,
					FailedAttempts: result.FailedAuth,
					CellID:         result.CellID,
					RANContext:     result.RANContext,
					Domain:         domain,
				}
				alert.Description = generateDescription(alert)

				// Only publish alerts for suspicious+ activity
				if severity != "NORMAL" {
					alertJSON, _ := json.Marshal(alert)

					// Publish to threat_alerts stream
					rdb.XAdd(ctx, &redis.XAddArgs{
						Stream: outputStream,
						MaxLen: 5000,
						Values: map[string]interface{}{"data": string(alertJSON)},
					})

					// Publish to Pub/Sub to trigger real-time WebSocket events in Node.js
					rdb.Publish(ctx, "sentinel:events", string(alertJSON))

					// Store in sorted set for API queries
					rdb.ZAdd(ctx, alertsSortedSet, redis.Z{
						Score:  threatScore,
						Member: string(alertJSON),
					})

					// Trim sorted set
					count, _ := rdb.ZCard(ctx, alertsSortedSet).Result()
					if count > 1000 {
						rdb.ZRemRangeByRank(ctx, alertsSortedSet, 0, count-1001)
					}

					// Track attacker IPs
					rdb.ZIncrBy(ctx, attackerHashKey, threatScore, result.SrcIP)

					// Track telecom-specific stats
					if domain == "telecom" {
						rdb.HIncrBy(ctx, statsHashKey, "telecom_threats", 1)
					}
				}

				// Store recent traffic for timeline
				trafficEntry, _ := json.Marshal(map[string]interface{}{
					"timestamp":    result.Timestamp,
					"src_ip":       result.SrcIP,
					"packet_size":  result.PacketSize,
					"protocol":     result.Protocol,
					"event_type":   result.EventType,
					"anomaly_score": result.AnomalyScore,
					"threat_score":  threatScore,
					"severity":     severity,
					"domain":       domain,
				})
				rdb.LPush(ctx, trafficListKey, string(trafficEntry))
				rdb.LTrim(ctx, trafficListKey, 0, 999)

				// Update dashboard stats
				rdb.HIncrBy(ctx, statsHashKey, "total_events", 1)
				if severity != "NORMAL" {
					rdb.HIncrBy(ctx, statsHashKey, "total_alerts", 1)
				}
				if severity == "HIGH" {
					rdb.HIncrBy(ctx, statsHashKey, "high_threats", 1)
				}

				rdb.XAck(ctx, inputStream, consumerGroup, msg.ID)

				processed++
				if processed%20 == 0 {
					log.Printf("[ThreatEngine] Processed %d events (latest: %s [%s], score=%.3f, severity=%s)",
						processed, alert.AlertType, domain, threatScore, severity)
				}
			}
		}
	}
}
