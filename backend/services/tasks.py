"""Lightweight background task helpers using FastAPI BackgroundTasks.

This module establishes a simple pattern for deferring non-critical work
without blocking the request/response cycle. It intentionally avoids
external queues; use it for quick follow-up actions (e.g., logging, pings).
"""

from __future__ import annotations

import logging
import time
from typing import Optional

logger = logging.getLogger("quotestack.tasks")


def log_async_message(message: str, delay_seconds: Optional[float] = None) -> None:
    """Example placeholder task that optionally sleeps, then logs a message.

    Keep background tasks lightweight; for heavy/critical work, plan to move
    to a real queue.
    """

    if delay_seconds:
        time.sleep(delay_seconds)
    logger.info("background_task: %s", message)


__all__ = ["log_async_message"]
