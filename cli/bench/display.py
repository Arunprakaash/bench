"""Terminal output formatting."""

from datetime import datetime, timezone

from rich.console import Console
from rich.table import Table

console = Console()

PASS_MARK = "[bold green]✔[/bold green]"
FAIL_MARK = "[bold red]✘[/bold red]"

STATUS_STYLE = {
    "passed": "bold green",
    "failed": "bold red",
    "running": "bold yellow",
    "pending": "dim",
    "error": "bold red",
}


def _ago(dt_str: str) -> str:
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        diff = int((datetime.now(timezone.utc) - dt).total_seconds())
        if diff < 60:
            return f"{diff}s ago"
        if diff < 3600:
            return f"{diff // 60}m ago"
        if diff < 86400:
            return f"{diff // 3600}h ago"
        return f"{diff // 86400}d ago"
    except Exception:
        return dt_str[:10] if dt_str else "—"


def _tags(tags: list | None) -> str:
    return ", ".join(tags) if tags else "—"


# ------------------------------------------------------------------
# Run output (bench run / bench suites run)
# ------------------------------------------------------------------

def _turn_label(turn: dict) -> str:
    expectations = turn.get("expectations") or []
    if expectations:
        intent = expectations[0].get("intent")
        if intent:
            return intent
    user_input = turn.get("user_input", "")
    return user_input[:50] + ("…" if len(user_input) > 50 else "")


def _failure_reason(turn: dict) -> str | None:
    for v in (turn.get("judge_verdicts") or []):
        if not v.get("passed") and v.get("reasoning"):
            return v["reasoning"]
    return turn.get("error_message")


def print_run_header(scenario_name: str, turn_count: int, endpoint_label: str) -> None:
    console.print(
        f"Running [bold]{turn_count}[/bold] turn{'s' if turn_count != 1 else ''} "
        f"against [bold]{endpoint_label}[/bold] endpoint..."
    )


def print_turn_result(index: int, turn: dict) -> None:
    label = _turn_label(turn)
    latency = turn.get("latency_ms")
    latency_str = f"[dim]{int(latency)}ms[/dim]" if latency is not None else ""
    n = index + 1
    if turn.get("passed"):
        console.print(f"  {PASS_MARK} T{n} {label}  {latency_str}")
    else:
        reason = _failure_reason(turn)
        suffix = f" [dim]— {reason}[/dim]" if reason else ""
        console.print(f"  {FAIL_MARK} T{n} {label}{suffix}  {latency_str}")


def print_summary(run: dict, scenario_name: str) -> None:
    turn_results = run.get("turn_results") or []
    passed = sum(1 for t in turn_results if t.get("passed"))
    failed = len(turn_results) - passed
    duration_ms = run.get("duration_ms") or 0
    console.print()
    if failed:
        console.print(
            f"  {FAIL_MARK} [bold red]{failed} failed[/bold red]"
            f"  {PASS_MARK} [bold green]{passed} passed[/bold green]"
        )
    else:
        console.print(f"  {PASS_MARK} [bold green]all {passed} passed[/bold green]")
    console.print(f"\n  [dim]1 scenario · {int(duration_ms)}ms[/dim]")


# ------------------------------------------------------------------
# Scenarios
# ------------------------------------------------------------------

def print_scenarios_table(scenarios: list) -> None:
    t = Table(show_header=True, header_style="bold", box=None, pad_edge=False, show_edge=False)
    t.add_column("NAME", min_width=24)
    t.add_column("ID", style="dim", min_width=36)
    t.add_column("TURNS", justify="right", min_width=5)
    t.add_column("TAGS", min_width=16)
    t.add_column("UPDATED", justify="right", min_width=10)
    for s in scenarios:
        t.add_row(
            s["name"],
            s["id"],
            str(s.get("turn_count", "—")),
            _tags(s.get("tags")),
            _ago(s.get("updated_at", "")),
        )
    console.print(t)


def print_scenario_detail(s: dict) -> None:
    console.print(f"[bold]{s['name']}[/bold]  [dim]{s['id']}[/dim]")
    if s.get("description"):
        console.print(f"  {s['description']}")
    console.print()
    rows = [
        ("agent_id", s.get("agent_id") or "—"),
        ("llm_model", s.get("llm_model") or "—"),
        ("judge_model", s.get("judge_model") or "—"),
        ("version", str(s.get("version", "—"))),
        ("tags", _tags(s.get("tags"))),
        ("turns", str(len(s.get("turns") or []))),
    ]
    for key, val in rows:
        console.print(f"  [dim]{key:<14}[/dim] {val}")
    turns = s.get("turns") or []
    if turns:
        console.print()
        console.print("  [bold]Turns[/bold]")
        for turn in sorted(turns, key=lambda x: x.get("turn_index", 0)):
            idx = turn.get("turn_index", 0)
            inp = turn.get("user_input", "")[:60]
            exps = len(turn.get("expectations") or [])
            console.print(f"    T{idx + 1}  {inp}  [dim]({exps} expectation{'s' if exps != 1 else ''})[/dim]")


# ------------------------------------------------------------------
# Agents
# ------------------------------------------------------------------

def print_agents_table(agents: list) -> None:
    t = Table(show_header=True, header_style="bold", box=None, pad_edge=False, show_edge=False)
    t.add_column("NAME", min_width=24)
    t.add_column("ID", style="dim", min_width=36)
    t.add_column("PROVIDER", min_width=12)
    t.add_column("MODEL", min_width=14)
    t.add_column("TAGS", min_width=16)
    t.add_column("UPDATED", justify="right", min_width=10)
    for a in agents:
        t.add_row(
            a["name"],
            a["id"],
            a.get("provider_type") or "—",
            a.get("default_llm_model") or "—",
            _tags(a.get("tags")),
            _ago(a.get("updated_at", "")),
        )
    console.print(t)


def print_agent_detail(a: dict) -> None:
    console.print(f"[bold]{a['name']}[/bold]  [dim]{a['id']}[/dim]")
    if a.get("description"):
        console.print(f"  {a['description']}")
    console.print()
    rows = [
        ("provider_type", a.get("provider_type") or "—"),
        ("module", a.get("module") or "—"),
        ("agent_class", a.get("agent_class") or "—"),
        ("llm_model", a.get("default_llm_model") or "—"),
        ("judge_model", a.get("default_judge_model") or "—"),
        ("tags", _tags(a.get("tags"))),
    ]
    for key, val in rows:
        console.print(f"  [dim]{key:<16}[/dim] {val}")
    if a.get("connection_config"):
        console.print()
        console.print("  [bold]connection_config[/bold]")
        for k, v in a["connection_config"].items():
            console.print(f"    [dim]{k}[/dim]  {v}")


# ------------------------------------------------------------------
# Suites
# ------------------------------------------------------------------

def print_suites_table(suites: list) -> None:
    t = Table(show_header=True, header_style="bold", box=None, pad_edge=False, show_edge=False)
    t.add_column("NAME", min_width=24)
    t.add_column("ID", style="dim", min_width=36)
    t.add_column("SCENARIOS", justify="right", min_width=9)
    t.add_column("UPDATED", justify="right", min_width=10)
    for s in suites:
        t.add_row(
            s["name"],
            s["id"],
            str(s.get("scenario_count", "—")),
            _ago(s.get("updated_at", "")),
        )
    console.print(t)


def print_suite_detail(s: dict) -> None:
    console.print(f"[bold]{s['name']}[/bold]  [dim]{s['id']}[/dim]")
    if s.get("description"):
        console.print(f"  {s['description']}")
    console.print()
    scenarios = s.get("scenarios") or []
    console.print(f"  [dim]{'scenarios':<14}[/dim] {len(scenarios)}")
    if scenarios:
        console.print()
        console.print("  [bold]Scenarios[/bold]")
        for sc in scenarios:
            turns = sc.get("turn_count", "?")
            console.print(
                f"    {sc['name']}  [dim]{sc['id']}  {turns} turn{'s' if turns != 1 else ''}[/dim]"
            )


# ------------------------------------------------------------------
# Runs
# ------------------------------------------------------------------

def _status_cell(status: str) -> str:
    style = STATUS_STYLE.get(status, "")
    return f"[{style}]{status}[/{style}]" if style else status


def print_runs_table(runs: list) -> None:
    t = Table(show_header=True, header_style="bold", box=None, pad_edge=False, show_edge=False)
    t.add_column("ID", style="dim", min_width=36)
    t.add_column("SCENARIO", min_width=22)
    t.add_column("STATUS", min_width=8)
    t.add_column("RESULT", justify="right", min_width=9)
    t.add_column("DURATION", justify="right", min_width=9)
    t.add_column("CREATED", justify="right", min_width=10)
    for r in runs:
        passed = r.get("passed_turns", 0)
        total = r.get("total_turns", 0)
        result_str = f"{passed}/{total}" if total else "—"
        dur = r.get("duration_ms")
        dur_str = f"{int(dur)}ms" if dur else "—"
        t.add_row(
            r["id"],
            r.get("scenario_name") or "—",
            _status_cell(r.get("status", "—")),
            result_str,
            dur_str,
            _ago(r.get("created_at", "")),
        )
    console.print(t)


def print_run_detail(run: dict) -> None:
    console.print(f"[bold]Run[/bold]  [dim]{run['id']}[/dim]")
    console.print()
    status = run.get("status", "—")
    rows = [
        ("status", _status_cell(status)),
        ("scenario_id", run.get("scenario_id") or "—"),
        ("duration", f"{int(run['duration_ms'])}ms" if run.get("duration_ms") else "—"),
    ]
    for key, val in rows:
        console.print(f"  [dim]{key:<14}[/dim] {val}")
    turn_results = sorted(run.get("turn_results") or [], key=lambda t: t.get("turn_index", 0))
    if turn_results:
        console.print()
        console.print("  [bold]Turns[/bold]")
        for i, turn in enumerate(turn_results):
            print_turn_result(i, turn)
