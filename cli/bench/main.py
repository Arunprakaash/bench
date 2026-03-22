"""bench CLI entry point."""

import sys

import click
import httpx

from bench.client import BenchClient
from bench.config import DEFAULT_URL, load_config, save_config
from bench.display import console, print_run_header, print_summary, print_turn_result
from bench.commands.scenarios import scenarios_group
from bench.commands.agents import agents_group
from bench.commands.suites import suites_group
from bench.commands.runs import runs_group


@click.group()
@click.option("--url", default=None, envvar="BENCH_URL", help="Backend URL override.")
@click.option("--token", default=None, envvar="BENCH_TOKEN", help="API token override.")
@click.pass_context
def cli(ctx, url: str | None, token: str | None):
    """bench — run AI agent scenarios from the terminal."""
    ctx.ensure_object(dict)
    cfg = load_config()
    ctx.obj["url"] = url or cfg.get("url") or DEFAULT_URL
    ctx.obj["token"] = token or cfg.get("token")


cli.add_command(scenarios_group)
cli.add_command(agents_group)
cli.add_command(suites_group)
cli.add_command(runs_group)


@cli.command()
@click.option("--email", required=True, help="Account email.")
@click.option("--password", prompt=True, hide_input=True, help="Account password.")
@click.option("--url", default=DEFAULT_URL, show_default=True, help="Backend URL.")
def login(email: str, password: str, url: str):
    """Authenticate and save credentials to ~/.bench/config.json."""
    try:
        token = BenchClient.login(url, email, password)
    except httpx.HTTPStatusError as e:
        console.print(f"[red]Login failed:[/red] {e.response.status_code} {e.response.text}")
        sys.exit(1)
    except httpx.RequestError as e:
        console.print(f"[red]Could not reach {url}:[/red] {e}")
        sys.exit(1)
    save_config(url, token)
    console.print("[green]Logged in.[/green] Config saved to ~/.bench/config.json")


@cli.command()
@click.option("--scenario", required=True, help="Scenario name or ID.")
@click.pass_context
def run(ctx, scenario: str):
    """Run a scenario and print turn-by-turn results."""
    from bench._ctx import make_client

    client = make_client(ctx)

    try:
        scenario_meta = client.resolve_scenario(scenario)
    except httpx.HTTPStatusError as e:
        console.print(f"[red]{e.response.status_code}[/red] {e.response.text}")
        sys.exit(1)
    except httpx.RequestError as e:
        console.print(f"[red]Could not reach backend:[/red] {e}")
        sys.exit(1)

    if not scenario_meta:
        console.print(f"[red]Scenario not found:[/red] {scenario!r}")
        sys.exit(1)

    turn_count = scenario_meta.get("turn_count", 0)
    endpoint_label = _resolve_endpoint_label(client, scenario_meta)
    print_run_header(scenario_meta["name"], turn_count, endpoint_label)

    try:
        with console.status(""):
            result = client.create_run(scenario_meta["id"])
    except httpx.HTTPStatusError as e:
        console.print(f"[red]Run failed:[/red] {e.response.status_code} {e.response.text}")
        sys.exit(1)
    except httpx.RequestError as e:
        console.print(f"[red]Connection error:[/red] {e}")
        sys.exit(1)

    turn_results = sorted(result.get("turn_results") or [], key=lambda t: t["turn_index"])
    for i, turn in enumerate(turn_results):
        print_turn_result(i, turn)

    print_summary(result, scenario_meta["name"])

    failed = sum(1 for t in turn_results if not t.get("passed"))
    sys.exit(1 if failed else 0)


def _resolve_endpoint_label(client: BenchClient, scenario_meta: dict) -> str:
    agent_id = scenario_meta.get("agent_id")
    if agent_id:
        agent = client.resolve_agent(agent_id)
        if agent and agent.get("name"):
            return agent["name"]
    try:
        full = client.get_scenario(scenario_meta["id"])
        if full.get("llm_model"):
            return full["llm_model"]
    except Exception:
        pass
    return "agent"
