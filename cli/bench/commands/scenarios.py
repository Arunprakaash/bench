import sys

import click
import httpx

from bench.display import console, print_scenario_detail, print_scenarios_table
from bench._ctx import make_client


@click.group("scenarios")
def scenarios_group():
    """List, inspect, and delete scenarios."""


@scenarios_group.command("ls")
@click.pass_context
def ls(ctx):
    """List all scenarios."""
    client = make_client(ctx)
    try:
        items = client.list_scenarios()
    except httpx.HTTPStatusError as e:
        console.print(f"[red]{e.response.status_code}[/red] {e.response.text}")
        sys.exit(1)
    if not items:
        console.print("[dim]No scenarios found.[/dim]")
        return
    print_scenarios_table(items)


@scenarios_group.command("get")
@click.argument("name_or_id")
@click.pass_context
def get(ctx, name_or_id: str):
    """Show details for a scenario."""
    client = make_client(ctx)
    try:
        scenario = client.resolve_scenario(name_or_id)
    except httpx.HTTPStatusError as e:
        console.print(f"[red]{e.response.status_code}[/red] {e.response.text}")
        sys.exit(1)
    if not scenario:
        console.print(f"[red]Not found:[/red] {name_or_id!r}")
        sys.exit(1)
    # resolve_scenario from list only returns list fields; fetch full detail
    if "turns" not in scenario:
        scenario = client.get_scenario(scenario["id"])
    print_scenario_detail(scenario)


@scenarios_group.command("delete")
@click.argument("name_or_id")
@click.option("--yes", "-y", is_flag=True, help="Skip confirmation prompt.")
@click.pass_context
def delete(ctx, name_or_id: str, yes: bool):
    """Delete a scenario."""
    client = make_client(ctx)
    try:
        scenario = client.resolve_scenario(name_or_id)
    except httpx.HTTPStatusError as e:
        console.print(f"[red]{e.response.status_code}[/red] {e.response.text}")
        sys.exit(1)
    if not scenario:
        console.print(f"[red]Not found:[/red] {name_or_id!r}")
        sys.exit(1)
    if not yes:
        click.confirm(f"Delete scenario '{scenario['name']}'?", abort=True)
    try:
        client.delete_scenario(scenario["id"])
    except httpx.HTTPStatusError as e:
        console.print(f"[red]{e.response.status_code}[/red] {e.response.text}")
        sys.exit(1)
    console.print(f"[green]Deleted[/green] {scenario['name']}")
