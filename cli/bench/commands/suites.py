import sys
import time

import click
import httpx

from bench.display import (
    FAIL_MARK,
    PASS_MARK,
    STATUS_STYLE,
    console,
    print_suite_detail,
    print_suites_table,
)
from bench._ctx import make_client


@click.group("suites")
def suites_group():
    """List, inspect, delete, and run suites."""


@suites_group.command("ls")
@click.pass_context
def ls(ctx):
    """List all suites."""
    client = make_client(ctx)
    try:
        items = client.list_suites()
    except httpx.HTTPStatusError as e:
        console.print(f"[red]{e.response.status_code}[/red] {e.response.text}")
        sys.exit(1)
    if not items:
        console.print("[dim]No suites found.[/dim]")
        return
    print_suites_table(items)


@suites_group.command("get")
@click.argument("name_or_id")
@click.pass_context
def get(ctx, name_or_id: str):
    """Show details for a suite."""
    client = make_client(ctx)
    try:
        suite = client.resolve_suite(name_or_id)
    except httpx.HTTPStatusError as e:
        console.print(f"[red]{e.response.status_code}[/red] {e.response.text}")
        sys.exit(1)
    if not suite:
        console.print(f"[red]Not found:[/red] {name_or_id!r}")
        sys.exit(1)
    print_suite_detail(suite)


@suites_group.command("delete")
@click.argument("name_or_id")
@click.option("--yes", "-y", is_flag=True, help="Skip confirmation prompt.")
@click.pass_context
def delete(ctx, name_or_id: str, yes: bool):
    """Delete a suite."""
    client = make_client(ctx)
    try:
        suite = client.resolve_suite(name_or_id)
    except httpx.HTTPStatusError as e:
        console.print(f"[red]{e.response.status_code}[/red] {e.response.text}")
        sys.exit(1)
    if not suite:
        console.print(f"[red]Not found:[/red] {name_or_id!r}")
        sys.exit(1)
    if not yes:
        click.confirm(f"Delete suite '{suite['name']}'?", abort=True)
    try:
        client.delete_suite(suite["id"])
    except httpx.HTTPStatusError as e:
        console.print(f"[red]{e.response.status_code}[/red] {e.response.text}")
        sys.exit(1)
    console.print(f"[green]Deleted[/green] {suite['name']}")


@suites_group.command("run")
@click.argument("name_or_id")
@click.pass_context
def run(ctx, name_or_id: str):
    """Run all scenarios in a suite and stream results."""
    client = make_client(ctx)
    try:
        suite = client.resolve_suite(name_or_id)
    except httpx.HTTPStatusError as e:
        console.print(f"[red]{e.response.status_code}[/red] {e.response.text}")
        sys.exit(1)
    if not suite:
        console.print(f"[red]Not found:[/red] {name_or_id!r}")
        sys.exit(1)

    scenarios = suite.get("scenarios") or []
    console.print(
        f"Running [bold]{len(scenarios)}[/bold] scenario{'s' if len(scenarios) != 1 else ''} "
        f"in suite [bold]{suite['name']}[/bold]..."
    )

    try:
        pending_runs = client.run_suite(suite["id"])
    except httpx.HTTPStatusError as e:
        console.print(f"[red]{e.response.status_code}[/red] {e.response.text}")
        sys.exit(1)

    # Poll each run until complete, printing as they finish.
    run_ids = [r["id"] for r in pending_runs]
    scenario_names = {r["id"]: r.get("scenario_name") or "?" for r in pending_runs}
    done: set[str] = set()
    all_passed = True
    suite_start = time.monotonic()

    while len(done) < len(run_ids):
        time.sleep(2)
        for run_id in run_ids:
            if run_id in done:
                continue
            try:
                r = client.get_run(run_id)
            except httpx.HTTPStatusError:
                continue
            status = r.get("status", "pending")
            if status in ("passed", "failed", "error"):
                done.add(run_id)
                passed = r.get("passed_turns", 0)  # not on list response; may be 0
                # Use turn_results if available
                turn_results = r.get("turn_results") or []
                if turn_results:
                    passed = sum(1 for t in turn_results if t.get("passed"))
                total = len(turn_results) or r.get("total_turns", 0)
                dur = r.get("duration_ms")
                dur_str = f"[dim]{int(dur)}ms[/dim]" if dur else ""
                mark = PASS_MARK if status == "passed" else FAIL_MARK
                if status != "passed":
                    all_passed = False
                console.print(
                    f"  {mark} {scenario_names[run_id]}  "
                    f"[dim]{passed}/{total} turns[/dim]  {dur_str}"
                )

    total_ms = int((time.monotonic() - suite_start) * 1000)
    total = len(run_ids)
    failed_count = sum(1 for r in pending_runs if r["id"] not in done or not all_passed)
    passed_count = total - failed_count

    console.print()
    if all_passed:
        console.print(f"  {PASS_MARK} [bold green]all {total} passed[/bold green]")
    else:
        console.print(
            f"  {FAIL_MARK} [bold red]{failed_count} failed[/bold red]"
            f"  {PASS_MARK} [bold green]{passed_count} passed[/bold green]"
        )
    console.print(f"\n  [dim]{total} scenario{'s' if total != 1 else ''} · {total_ms}ms[/dim]")

    sys.exit(0 if all_passed else 1)
