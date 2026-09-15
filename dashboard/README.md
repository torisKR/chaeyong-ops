# dashboard/

Go dashboard for browsing the application tracker.

Two UIs share the same parser (`internal/data`) and the same source of truth
(`data/applications.md`, gitignored user data):

| UI | Command | What |
|----|---------|------|
| **Web (localhost)** | `npm run dashboard:web` | Browser board at `http://127.0.0.1:3847` — Korean-first 지원 현황 |
| TUI | `npm run serve:dashboard` | Terminal UI (filter tabs, report viewer, inline status picker) |

The web board is **read-only** and **loopback-only**. It is not a hosted product.
See [docs/DASHBOARD-KR.md](../docs/DASHBOARD-KR.md).

## Purpose

A terminal UI over the application tracker: filter tabs, sort modes,
grouped/flat views, lazy-loaded report previews, and an inline status picker.
It is isolated from the Node core — optional, never required by any other
component.

`--web` serves a small `net/http` page instead of Bubble Tea: status counts,
a filterable table (회사 / 포지션 / 포털 / 점수 / 상태 / 지원일 / 링크), and an
empty state. No extra JS framework.

## Prerequisites and running

Requires Go 1.24+ (`go.mod`). From the repo root:

```bash
npm run dashboard:web      # localhost Korean status board (http://127.0.0.1:3847)
npm run serve:dashboard    # go run . --path .. (TUI against the repo root)
npm run build:dashboard    # build the standalone binary
```

`build-dashboard.mjs` exists because `go build -o career-dashboard .` writes
an extension-less binary on Windows; the wrapper picks the platform-correct
output name (`career-dashboard.exe` on Windows, `career-dashboard` elsewhere).

The binary accepts `--path <dir>` pointing at a career-ops directory
(default `.`). The data loader tries both `{path}/applications.md` and
`{path}/data/applications.md` for layout compatibility.

## Package layout

- `main.go` — entry point, flag parsing (`--web` for the localhost board, otherwise the TUI), top-level Bubble Tea model and view
  state (pipeline / report viewer / progress).
- `open_*.go` — platform-specific "open file/URL" commands (darwin, linux,
  windows, unix, unsupported).
- `internal/data/` — parses `applications.md` (`career.go`), derives
  aggregate metrics (`derive.go`), and resolves generated PDFs (`pdf.go`).
- `internal/webui/` — loopback HTTP status board (`net/http` + HTML template).
- `internal/model/` — the application row model.
- `internal/theme/` — Catppuccin Mocha (dark) and Latte (light) themes;
  `NewTheme("auto")` picks by detected terminal background.
- `internal/ui/screens/` — the pipeline list, report viewer, and progress
  screens.

## Dependencies

External: [Bubble Tea](https://github.com/charmbracelet/bubbletea) (TUI
framework), [Lipgloss](https://github.com/charmbracelet/lipgloss) (styling),
termenv (background detection). The module has no dependency on the Node
side; it only reads the tracker files.

## Tests

Go tests live next to their packages (`*_test.go`). The Node suite builds
the dashboard as part of `node test-all.mjs` (skipped with `--quick`).
CI also runs `go test ./...` in `dashboard/`. Web-board fixtures under
`internal/webui/testdata/` are fictional companies only.
