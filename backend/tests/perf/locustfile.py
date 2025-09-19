# backend/tests/perf/locustfile.py
from locust import HttpUser, task, between, events
import os

P95_MS = int(os.getenv("P95_MS", "1200"))
MAX_FAIL_RATIO = float(os.getenv("MAX_FAIL_RATIO", "0.02"))

API_BASE     = os.getenv("API_BASE", "").rstrip("/")
HOME_PATH    = os.getenv("HOME_PATH", "/")
HEALTH_PATH  = os.getenv("HEALTH_PATH", "/health")

class WebUser(HttpUser):
    wait_time = between(0.5, 1.5)

    @task(3)
    def home(self):
        path = HOME_PATH if HOME_PATH.startswith("/") else f"/{HOME_PATH}"
        self.client.get(path if API_BASE == "" else f"{API_BASE}{path}", name="/home")

    @task(1)
    def health(self):
        if not HEALTH_PATH:
            return
        path = HEALTH_PATH if HEALTH_PATH.startswith("/") else f"/{HEALTH_PATH}"
        with self.client.get(
            path if API_BASE == "" else f"{API_BASE}{path}",
            name="/health",
            catch_response=True
        ) as resp:
            if resp.status_code in (200, 204):
                resp.success()
            else:
                resp.failure(f"Unexpected status {resp.status_code}")

@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    stats = environment.stats.total
    p95 = stats.get_response_time_percentile(0.95)
    fails = stats.fail_ratio
    ok = (p95 <= P95_MS) and (fails <= MAX_FAIL_RATIO)
    if not ok:
        print(f"[THRESHOLDS NOT MET] p95={p95:.0f}ms (<= {P95_MS}) | fail_ratio={fails:.2%} (<= {MAX_FAIL_RATIO:.2%})")
        environment.process_exit_code = 1
