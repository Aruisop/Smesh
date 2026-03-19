import redis
import json
import time
import uuid
import statistics
import os
from datetime import datetime, timezone

# Connect to Redis
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
pubsub = r.pubsub()

def test_pipeline_latency(num_requests=100):
    print(f"--- Starting End-to-End Latency Benchmark ({num_requests} events) ---")
    print("Testing pipeline: Python ML (Isolation Forest) -> Go (Threat Engine) -> Node (Pub/Sub)")
    
    # Subscribe to the final endpoint of the pipeline
    pubsub.subscribe("sentinel:events")
    
    latencies = []
    
    # Drain any existing messages
    while pubsub.get_message(timeout=0.1): 
        pass

    for i in range(num_requests):
        event_id = str(uuid.uuid4())
        
        # We craft an event that is GUARANTEED to trigger an alert
        # so that it fires out the end of the Threat Engine via Pub/Sub
        iso_timestamp = datetime.now(timezone.utc).isoformat()
        
        test_event = {
            "timestamp": iso_timestamp,
            "src_ip": f"10.0.0.{i % 255}",
            "dst_ip": "192.168.1.100",
            "protocol": "TCP",
            "src_port": 4444,
            "dst_port": 10000 + i, # Unique port for matching
            "packet_size": 1500,
            "event_type": "rogue_basestation",
            "failed_auth": 15,
            "request_rate": 500,
            "cell_id": "gNB-CU-001",
            "ran_context": "macro_cell",
            "benchmark_id": event_id
        }
        
        start_time = time.time()
        
        # 1. Inject into the start of the pipeline
        r.xadd("network_logs", {"data": json.dumps(test_event)})
        
        # 2. Wait for it to exit the end of the pipeline
        received = False
        while not received:
            message = pubsub.get_message(timeout=5.0)
            if message and message['type'] == 'message':
                data = json.loads(message['data'])
                
                # Check if it's our specific event
                # Match by unique dst_port
                if data.get('dst_port') == test_event['dst_port']:
                    end_time = time.time()
                    latencies.append((end_time - start_time) * 1000) # Convert to ms
                    received = True
            
            # Timeout protection
            if time.time() - start_time > 5.0:
                print(f"Timeout on event {i}")
                break
                
        time.sleep(0.01) # Small buffer between requests

    pubsub.unsubscribe()
    
    if len(latencies) == 0:
        print("Failed to measure latency. Are the containers running?")
        return

    print("\n[✔] Benchmark Complete!")
    print(f"Total Events Processed: {len(latencies)}")
    print(f"Average Latency: {statistics.mean(latencies):.2f} ms")
    print(f"Median Latency:  {statistics.median(latencies):.2f} ms")
    print(f"Min Latency:     {min(latencies):.2f} ms")
    print(f"Max Latency:     {max(latencies):.2f} ms")
    print(f"95th Percentile: {statistics.quantiles(latencies, n=100)[94]:.2f} ms")
    print("--------------------------------------------------\n")

if __name__ == "__main__":
    test_pipeline_latency(100)
