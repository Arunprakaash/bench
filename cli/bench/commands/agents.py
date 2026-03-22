import sys

import click
import httpx

from bench.display import console, print_agent_detail, print_agents_table
from bench._ctx import make_client


@click.group("agents")
def agents_group():
    """List and inspect agents."""


@agents_group.command("ls")
@click.pass_context
def ls(ctx):
    """List all agents."""
    client = make_client(ctx)
    try:
        items = client.list_agents()
    except httpx.HTTPStatusError as e:
        console.print(f"[red]{e.response.status_code}[/red] {e.response.text}")
        sys.exit(1)
    if not items:
        console.print("[dim]No agents found.[/dim]")
        return
    print_agents_table(items)


@agents_group.command("get")
@click.argument("name_or_id")
@click.pass_context
def get(ctx, name_or_id: str):
    """Show details for an agent."""
    client = make_client(ctx)
    try:
        agent = client.resolve_agent(name_or_id)
    except httpx.HTTPStatusError as e:
        console.print(f"[red]{e.response.status_code}[/red] {e.response.text}")
        sys.exit(1)
    if not agent:
        console.print(f"[red]Not found:[/red] {name_or_id!r}")
        sys.exit(1)
    print_agent_detail(agent)
