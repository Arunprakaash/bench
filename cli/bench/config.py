"""
Config management for bench CLI.

Reads from (in priority order):
  1. Explicit CLI flags
  2. Environment variables: BENCH_TOKEN, BENCH_URL
  3. ~/.bench/config.json
"""

import json
import os
from pathlib import Path

CONFIG_DIR = Path.home() / ".bench"
CONFIG_FILE = CONFIG_DIR / "config.json"
DEFAULT_URL = "http://localhost:8000"


def load_config() -> dict:
    config = {"url": DEFAULT_URL, "token": None}

    if CONFIG_FILE.exists():
        try:
            saved = json.loads(CONFIG_FILE.read_text())
            config.update(saved)
        except Exception:
            pass

    if url := os.environ.get("BENCH_URL"):
        config["url"] = url
    if token := os.environ.get("BENCH_TOKEN"):
        config["token"] = token

    return config


def save_config(url: str, token: str) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps({"url": url, "token": token}, indent=2))
