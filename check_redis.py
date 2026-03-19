import redis
import json
import os

r = redis.Redis(host=os.getenv("REDIS_HOST", "localhost"), port=int(os.getenv("REDIS_PORT", 6379)), decode_responses=True)

print("Checking anomaly_results stream...")
res = r.xrevrange("anomaly_results", max="+", min="-", count=1)
if res:
    print(res)
else:
    print("No messages in anomaly_results")

print("Checking threat_alerts stream...")
res = r.xrevrange("threat_alerts", max="+", min="-", count=1)
if res:
    print(res)
else:
    print("No messages in threat_alerts")

print("Done.")
