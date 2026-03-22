import sys

import click
import httpx

from bench.display import console, print_run_detail, print_runs_table
from bench._ctx import make_client


@click.group("runs")
def runs_group():
    """List, inspect, and delete runs."""


@runs_group.command("ls")
@click.option("--scenario", default=None, help="Filter by scenario name or ID.")
@click.option(
    "--status",
    default=None,
    type=click.Choice(["pending", "running", "passed", "failed", "error"], case_sensitive=False),
    help="Filter by status.",
)
@click.pass_context
def ls(ctx, scenario: str | None, status: str | None):
    """List recent runs."""
    client = make_client(ctx)

    scenario_id = None
    if scenario:
        try:
            s = client.resolve_scenario(scenario)
        except httpx.HTTPStatusError as e:
            console.print(f"[red]{e.response.status_code}[/red] {e.response.text}")
            sys.exit(1)
        if not s:
            console.print(f"[red]Scenario not found:[/red] {scenario!r}")
            sys.exit(1)
        scenario_id = s["id"]

    try:
        items = client.list_runs(scenario_id=scenario_id, status=status)
    except httpx.HTTPStatusError as e:
        console.print(f"[red]{e.response.status_code}[/red] {e.response.text}")
        sys.exit(1)
    if not items:
        console.print("[dim]No runs found.[/dim]")
        return
    print_runs_table(items)


@runs_group.command("get")
@click.argument("run_id")
@click.pass_context
def get(ctx, run_id: str):
    """Show full details for a run including turn results."""
    client = make_client(ctx)
    try:
        run = client.get_run(run_id)
    except httpx.HTTPStatusError as e:
        console.print(f"[red]{e.response.status_code}[/red] {e.response.text}")
        sys.exit(1)
    print_run_detail(run)


@runs_group.command("delete")
@click.argument("run_id")
@click.option("--yes", "-y", is_flag=True, help="Skip confirmation prompt.")
@click.pass_context
def delete(ctx, run_id: str, yes: bool):
    """Delete a run."""
    client = make_client(ctx)
    if not yes:
        click.confirm(f"Delete run '{run_id}'?", abort=True)
    try:
        client.delete_run(run_id)
    except httpx.HTTPStatusError as e:
        console.print(f"[red]{e.response.status_code}[/red] {e.response.text}")
        sys.exit(1)
    console.print(f"[green]Deleted[/green] {run_id}")
