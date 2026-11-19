import time
from collections import defaultdict, deque


class SlidingWindowRateLimiter:
    def __init__(self, max_requests: int = 120, window_seconds: float = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > self.window_seconds:
            hits.popleft()
        if len(hits) >= self.max_requests:
            return False
        hits.append(now)
        if len(self._hits) > 10000:
            self._cleanup(now)
        return True

    def _cleanup(self, now: float) -> None:
        for k in list(self._hits):
            dq = self._hits[k]
            while dq and now - dq[0] > self.window_seconds:
                dq.popleft()
            if not dq:
                del self._hits[k]
