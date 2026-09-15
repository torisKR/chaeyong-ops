# 채용옵스 시작하기 · Getting started

클론부터 **첫 유용한 스캔**까지. Cursor / Claude Code 사용자를 기준으로 합니다.

영어 요약은 맨 아래 [English](#english) 입니다.

관련 문서: [APPLY-KR.md](APPLY-KR.md) (지원 워크플로) · [NOTICE.md](../NOTICE.md) · [LICENSE](../LICENSE)

> 시스템은 절대 지원서를 제출하지 않습니다 — the system never submits an application.

## 1. 준비물

- Node.js 18+
- git
- Cursor, Claude Code, Codex, 또는 다른 [에이전트 스킬](https://agentskills.io) CLI

## 2. 설치 (약 2분)

```bash
git clone https://github.com/torisKR/chaeyong-ops.git
cd chaeyong-ops
npm install
node setup.mjs --defaults
```

`setup.mjs` 가 **없을 때만** 복사합니다 (기존 개인 파일은 덮어쓰지 않음):

| 복사본 | 출처 |
|--------|------|
| `config/profile.yml` | `config/profile.example.yml` |
| `portals.yml` | `templates/portals-kr.example.yml` |
| `cv.md` | `cv.example.md` |
| `modes/_profile.md` | `modes/_profile.template.md` |

대화형으로 이름·이메일을 넣고 싶으면 TTY에서 `node setup.mjs` (플래그 없음). CI·파이프에서는 `--defaults` 만 쓰세요.

```bash
npm run setup       # = node setup.mjs --defaults
npm run doctor      # 빠진 설정 확인
```

## 3. 프로필에서 고칠 것

`config/profile.yml` 을 엽니다. **예제 이름(`김예시`)을 그대로 두지 마세요.**

| 필드 | 의미 |
|------|------|
| `candidate.full_name` | 본인 이름 |
| `candidate.email` | 본인 이메일 |
| `experience.years` | **본인 경력(년) 숫자** (예: `1.7`). 스캔 제목 필터와 평가 SKIP이 이 값을 읽습니다. 출시 프로젝트는 넣지 마세요. |
| `target_roles.primary` | 지원할 직무 |
| `location.city` | 기본 `서울` |
| `language.output` | 한국 지원이면 `ko` |
| `language.modes_dir` | 한국 시장이면 `modes/ko` |

확인:

```bash
node doctor.mjs
```

`experience.years` 가 없거나 원티드가 꺼져 있으면 한국어 안내가 나옵니다. `onboardingNeeded: false` 가 될 때까지 `cv.md` 도 본인 사실로 고칩니다 (구조는 `cv.example.md` 참고. 없는 숫자를 만들지 마세요).

## 4. 첫 스캔

기본 `portals.yml` 은 **원티드만** `enabled: true` 입니다. 사람인·잡코리아·리멤버는 각 사이트 [이용약관](https://www.wanted.co.kr/)·robots.txt 확인 후에만 켜세요. MIT 라이선스가 채용 사이트 약관을 대체하지 않습니다.

이전 직장처럼 **절대 지원하지 않을 회사**는 `portals.yml` 의 `blocked_companies` 에 적습니다 (예제 이름은 `ExampleCorp` — 실명·개인정보를 예제 파일에 넣지 마세요). 스캔이 해당 회사 공고를 pipeline에 넣지 않습니다. `data/blacklist.md` 도 같은 역할입니다.

```bash
npm run scan:kr          # = node scan.mjs
# 원티드만:
node scan.mjs --company Wanted
```

신규 URL은 `data/pipeline.md` 에 쌓입니다. 클라우드 IP에서 원티드가 403 이면 집 네트워크에서 재시도하거나, 공고 URL을 복사해 다음 단계로 붙입니다. Cloudflare를 우회하지 않습니다.

## 5. Cursor / Claude Code에서 공고 평가

프로젝트 폴더를 연 뒤:

1. 채용 공고 **URL** 또는 JD 텍스트를 채팅에 붙여넣기 → auto-pipeline (평가 + 트래커)
2. 또는 `/chaeyong-ops scan` · `/chaeyong-ops gonggo`
3. Codex는 슬래시가 없을 수 있음: `Evaluate this JD` / `Run chaeyong-ops scan mode` 라고 말하면 됩니다. [CODEX.md](CODEX.md)

**4.0/5 미만이면 지원하지 않는 것을 권장합니다.** 제출 버튼은 항상 사람이 누릅니다. 이어서 [APPLY-KR.md](APPLY-KR.md).

지원 현황 뷰어는 두 가지입니다 (둘 다 Go 1.24+): `npm run dashboard:web` → `http://127.0.0.1:3847` (브라우저), `npm run serve:dashboard` (TUI). [DASHBOARD-KR.md](DASHBOARD-KR.md).

## 6. 커밋하면 안 되는 것

개인 데이터는 **이미 `.gitignore`에 있습니다.** `git add .` 해도 아래는 스테이징되지 않아야 합니다.

| 경로 | 이유 |
|------|------|
| `cv.md` | 실이력서 |
| `config/profile.yml` | 이름·이메일·연봉·연차 |
| `portals.yml` | 개인 검색 설정 |
| `modes/_profile.md`, `modes/_custom.md`, `modes/_brief.md` | 개인 타깃 |
| `config/plugins.yml` | 플러그인 토글 |
| `config/integrations.yml` | 알림 토글 (토큰은 `.env`) |
| `data/*` | 트래커, 스캔 기록, 연락처 |
| `reports/*.md`, `output/*`, `jds/*` | 평가·PDF·공고 원문 |
| `interview-prep/*` (README·`.gitkeep` 제외) | 면접 노트 |
| `.env` | 비밀 |

추적되는 것은 예제뿐입니다: `config/profile.example.yml`, `cv.example.md`, `templates/portals-kr.example.yml`, `config/integrations.example.yml`, `examples/applications.example.md`.

실명 전화번호·개인 이메일을 예제 파일에 넣지 마세요. 개인 검색은 **비공개 저장소**가 안전합니다.

실수로 커밋했다면: `git rm --cached cv.md config/profile.yml` 후 히스토리에서 제거하세요. 이미 push 했다면 해당 비밀은 유출된 것으로 보고 교체하세요.

## 7. 다음에 할 일

```text
setup → experience.years 수정 → scan → gonggo ≥ 4.0 → pdf / jiwon 초안 → 포털에서 직접 제출
```

- [APPLY-KR.md](APPLY-KR.md) — 4.0 필터, PDF, `jiwon`, 트래커
- [DASHBOARD-KR.md](DASHBOARD-KR.md) — localhost 지원 현황 (`npm run dashboard:web`)
- [INTEGRATIONS.md](INTEGRATIONS.md) — Slack / Discord / Telegram 알림 (`node notify.mjs --test`)
- [SETUP.md](SETUP.md) — 업스트림 career-ops 설치 노트
- [CUSTOMIZATION.md](CUSTOMIZATION.md) — 아키타입·키워드

---

## English

Clone, `npm install`, `node setup.mjs --defaults`. Edit `config/profile.yml`: name, email, and `experience.years` (your years of experience as a number). Then `node doctor.mjs` and `npm run scan:kr`. Paste a job URL in Cursor or Claude Code.

Do not commit `cv.md`, `config/profile.yml`, `portals.yml`, or `data/*` — they are gitignored. Wanted is the only board enabled by default; check each site’s terms before enabling others. MIT does not replace job-board ToS. The tool never submits an application.

Application status viewers (Go 1.24+): `npm run dashboard:web` → http://127.0.0.1:3847 (loopback only) or `npm run serve:dashboard` (TUI). See [DASHBOARD-KR.md](DASHBOARD-KR.md).

List companies you will never apply to in `portals.yml` as `blocked_companies` (fictional example: `ExampleCorp` — former employers belong only on your machine). Optional Slack/Discord/Telegram alerts: [INTEGRATIONS.md](INTEGRATIONS.md) (`node notify.mjs --test`).
