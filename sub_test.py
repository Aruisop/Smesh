import redis
import json
import time

r = redis.Redis(host='localhost', port=6379, decode_responses=True)
pubsub = r.pubsub()
pubsub.subscribe('sentinel:events')

print("Listening...")
for message in pubsub.listen():
    print(message)
