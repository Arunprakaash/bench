"""Shared helpers for reading CLI context and building the API client."""

import sys

import click

from bench.client import BenchClient
from bench.config import load_config
from bench.display import console


def make_client(ctx: click.Context) -> BenchClient:
    """Build a BenchClient from context obj (set in main) or from saved config."""
    obj = ctx.find_object(dict) or {}
    base_url = obj.get("url")
    token = obj.get("token")

    if not base_url or not token:
        cfg = load_config()
        base_url = base_url or cfg.get("url")
        token = token or cfg.get("token")

    if not token:
        console.print("[red]No auth token.[/red] Run [bold]bench login[/bold] or set BENCH_TOKEN.")
        sys.exit(1)

    return BenchClient(base_url, token)
