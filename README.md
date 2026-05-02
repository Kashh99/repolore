# opsmem — operational memory for engineering teams

> AI that remembers how your team solved problems

## What it does

- Fetches issues and pull requests from any GitHub repo and summarizes them using AI
- Surfaces recurring patterns across incidents so you can spot systemic problems at a glance
- Caches everything locally so you can search your team's history without hitting GitHub or an LLM again

## Quick demo

```bash
$ opsmem analyze https://github.com/sindresorhus/ora

  Fetching sindresorhus/ora from GitHub...
  Using Claude (claude-haiku-4-5-20251001)
  Summarizing 30/30...

  Recurring Patterns
  ┌────────────────┬───────┬──────────────────────────────────────────────────┐
  │ Keyword        │ Count │ Related Items                                    │
  ├────────────────┼───────┼──────────────────────────────────────────────────┤
  │ terminal       │   4   │ #253 Ctrl+C not working while ora is spinning…   │
  │                │       │ #198 Output corrupted in non-TTY environments…   │
  ├────────────────┼───────┼──────────────────────────────────────────────────┤
  │ stdin          │   3   │ #211 Spinner breaks piped output…                │
  │                │       │ #187 Raw mode errors on Windows…                 │
  └────────────────┴───────┴──────────────────────────────────────────────────┘

  Issues
  ┌──────┬──────────────────────────────────────────┬───────────┬─────────────┐
  │ #    │ Summary                                  │ Status    │ Fix         │
  ├──────┼──────────────────────────────────────────┼───────────┼─────────────┤
  │ #253 │ Ctrl+C kills process but leaves terminal │ resolved  │ #255        │
  │      │ in broken state during spinner           │           │             │
  └──────┴──────────────────────────────────────────┴───────────┴─────────────┘
```

```bash
$ opsmem query "ctrl+c"

  Query results for: "ctrl+c"
  sindresorhus/ora — 3 matching issues
```

```bash
$ opsmem history

  Analyzed Repos
  ┌─────────────────────────┬──────────────────────────┐
  │ Repository              │ Cached At                │
  ├─────────────────────────┼──────────────────────────┤
  │ sindresorhus/ora        │ 5/2/2026, 11:30:00 AM    │
  └─────────────────────────┴──────────────────────────┘
```

## Installation

```bash
npm install -g opsmem
```

Create `~/.opsmem/.env`:

```env
GITHUB_TOKEN=your_github_personal_access_token

# Optional — uses Claude Haiku instead of local Ollama (much faster)
ANTHROPIC_API_KEY=your_anthropic_api_key
```

Your GitHub token needs `repo` read scope. Generate one at github.com/settings/tokens.

If you skip `ANTHROPIC_API_KEY`, opsmem falls back to [Ollama](https://ollama.ai) running locally:

```bash
ollama pull mistral
```

## Usage

```bash
# Fetch and summarize a repo's incidents
opsmem analyze https://github.com/owner/repo

# Skip AI summarization — instant raw view for demos or testing
opsmem analyze https://github.com/owner/repo --no-ai

# Force re-fetch (ignore cache)
opsmem analyze https://github.com/owner/repo --refresh

# Search everything you've analyzed
opsmem query "memory leak"

# List all analyzed repos and when they were cached
opsmem history
```

## How it works

1. Fetches the last 50 issues (with comments) and 30 PRs from GitHub via the REST API
2. Sends each item to an LLM with a structured prompt asking for a one-line summary, status, contributors, and linked fix
3. Stores the raw GitHub data in `~/.opsmem/cache/` as JSON — subsequent runs use the cache, not GitHub
4. Groups summaries by shared keywords to surface recurring patterns
5. Lets you search the raw cached data by keyword without touching an LLM again

## Stack

| Piece | What |
|---|---|
| [Commander](https://github.com/tj/commander.js) | CLI commands and flags |
| [@octokit/rest](https://github.com/octokit/rest.js) | GitHub API client |
| [@anthropic-ai/sdk](https://github.com/anthropic/anthropic-sdk-node) | Claude Haiku summarization |
| [Ollama](https://ollama.ai) | Local LLM fallback (mistral) |
| [p-limit](https://github.com/sindresorhus/p-limit) | Concurrency control (10 parallel requests) |
| [chalk](https://github.com/chalk/chalk) + [cli-table3](https://github.com/cli-table/cli-table3) | Terminal output |

## Roadmap

- [ ] `opsmem export` — dump summaries to Markdown or JSON for sharing in runbooks
- [ ] Per-repo summary caching so re-analyzing doesn't call the LLM again
- [ ] `opsmem compare <repo-a> <repo-b>` — find shared failure patterns across two repos
- [ ] GitHub Actions integration to auto-analyze on incident close

## License

MIT
