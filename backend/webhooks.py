import time
import requests
from redis import Redis
import uuid

from config import REDIS_URL

redis = Redis.from_url(REDIS_URL, decode_responses=True)

WEBHOOK_SET = "webhook_ids"

def get_all_webhooks():
    ids = redis.smembers(WEBHOOK_SET)
    hooks = []

    for wid in ids:
        data = redis.hgetall(f"webhook:{wid}")
        if data:
            hooks.append({ "id": wid, **data })

    return hooks


def trigger_event(event_name, payload):
    """
    Send webhook POST requests for hooks subscribed to event_name
    """
    hooks = get_all_webhooks()

    for hook in hooks:
        if hook.get("enabled") != "true":
            continue

        events = hook.get("events", "").split(",")
        if event_name not in events:
            continue

        # fire webhook async-like (non-blocking)
        try:
            requests.post(
                hook["url"],
                json={
                    "event": event_name,
                    "timestamp": int(time.time()),
                    **payload
                },
                timeout=3
            )
        except Exception as e:
            # Store failure info but do NOT break CSV job
            print("Webhook failed:", e)
