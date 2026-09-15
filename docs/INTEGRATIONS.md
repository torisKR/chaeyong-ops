# Integrations — hiring-ops alerts

Optional Slack, Discord, Telegram pings when a scan finds new jobs, plus a CLI to test the connection. Notion and Jira are documented stubs (MCP / REST). **Secrets never go in git** — only `.env` (copy from `.env.example`).

채용 스캔·평가 알림용 선택 연동. 토큰은 `.env` 에만 넣고 커밋하지 마세요.

> The tool never submits an application. Alerts are notifications only.

## Quick start · 빠른 시작

```bash
cp .env.example .env          # then fill webhook / bot values
# optional:
cp config/integrations.example.yml config/integrations.yml

node notify.mjs --status      # which channels look configured (no secrets printed)
node notify.mjs --test --dry-run
node notify.mjs --test        # sends a short "connection OK" ping
node doctor.mjs               # Integrations: slack=yes discord=off …
```

`config/integrations.yml` is gitignored. If you skip it, **a set env var is enough**. The YAML is for `score_threshold`, `on_new_jobs`, and turning a channel off without deleting the secret.

스캔이 신규 공고를 저장한 뒤, 채널이 설정되어 있으면 `scan.mjs` 가 자동으로 알림을 보냅니다. 설정이 없으면 기존과 동일합니다 (네트워크 호출 없음).

## Slack

1. Slack → Apps → Incoming Webhooks → add to a channel.
2. Copy the URL (`https://hooks.slack.com/services/…`) into `.env`:

```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ
```

## Discord

1. Channel → Edit → Integrations → Webhooks → New Webhook.
2. Copy the URL:

```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/ID/TOKEN
```

## Telegram

1. Talk to [@BotFather](https://t.me/BotFather) → `/newbot` → copy the token.
2. Message your bot (or add it to a group). Get `chat_id` from `https://api.telegram.org/bot<token>/getUpdates` (look at `"chat":{"id": …}`).
3. `.env`:

```
TELEGRAM_BOT_TOKEN=123456:ABC-DEF
TELEGRAM_CHAT_ID=123456789
```

Never log or commit the token. It is part of the request URL.

## Events · 이벤트

| Event | When | Command |
|-------|------|---------|
| `scan` | After `scan.mjs` saves new pipeline rows (`on_new_jobs`) | automatic, or `node notify.mjs --event scan --jobs-json '[...]'` |
| `high-score` | Evaluation ≥ `score_threshold` (default 4.0) | `node notify.mjs --event high-score --company ExampleCorp --role Backend --score 4.2 --url https://…` |
| `reminder` | Apply reminder (draft ready; **you** submit) | `node notify.mjs --event reminder --company ExampleCorp --role Backend` |
| `tracker` | Tracker status note | `node notify.mjs --event tracker --company ExampleCorp --note Applied` |
| `test` | Connection check | `node notify.mjs --test` |

Scan itself **does not score** postings. New-job alerts list whatever just landed. Use `high-score` after `gonggo` / auto-pipeline when a report is ≥ 4.0/5.

스캔은 점수를 매기지 않습니다. 신규 공고 알림은 방금 쌓인 목록입니다. 4.0 이상 평가는 `--event high-score` 로 보냅니다.

## Notion (stub + MCP)

`notify.mjs` does **not** create Notion pages. Two supported paths:

1. **Cursor Notion MCP** — connect Notion in Cursor, then ask the agent to create a page from a scan digest or report. Skills: `create-page`, `create-database-row`.
2. **Bundled plugin** — tracker mirror, not alerts. See [NOTION_SETUP.md](NOTION_SETUP.md):

```
NOTION_ACCESS_TOKEN=ntn_…
NOTION_PARENT_PAGE_ID=…
# alias also accepted:
NOTION_TOKEN=ntn_…
```

```bash
node plugins.mjs run notion export --dry-run
```

`doctor.mjs` reports `notion=stub` when a token is present so you can see the env is set without implying a webhook fire.

## Jira (stub)

Issue creation needs a project key plus:

```
JIRA_BASE_URL=https://example.atlassian.net
JIRA_EMAIL=you.example@example.com
JIRA_API_TOKEN=…
```

Create an issue yourself (or via an agent) with `POST {JIRA_BASE_URL}/rest/api/3/issue` and Basic auth `email:api_token`. This repo does not POST to Jira from `notify.mjs` yet. Use a webhook-style channel (Slack/Discord/Telegram) for alerts, and open Jira tickets from that digest.

## Company blocklist (related)

스캔에서 회사를 빼려면 `portals.yml`:

```yaml
blocked_companies:
  - ExampleCorp          # fictional — use your own former employers locally
```

See [GETTING-STARTED-KR.md](GETTING-STARTED-KR.md) and [APPLY-KR.md](APPLY-KR.md). `data/blacklist.md` still works; both lists are unioned.

## Privacy

- Tokens: `.env` only (gitignored).
- `node notify.mjs --status` and `doctor.mjs --json` → `{ configured, enabled, stub }` — never URL/token values.
- Job titles/companies in an alert are whatever the public posting said.
