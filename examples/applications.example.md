# Applications Tracker (example)

Fictional rows for the two local viewers — **not real applications**:

- `npm run dashboard:web` → http://127.0.0.1:3847 (read-only web board)
- `npm run serve:dashboard` → terminal TUI (`--path ..` reads this layout at `data/applications.md`)

Copy into `data/applications.md` only for a local demo. That path is gitignored; do not commit a live tracker.

Canonical **Status** values are English ids from `templates/states.yml` (exactly one per row — no bold, no dates in the cell). Display labels on the Korean web/TUI:

| Status | 화면 라벨 | When |
|--------|-----------|------|
| Evaluated | 평가완료 | Report done, pending decision (웹 헤더: 보류) |
| Applied | 지원완료 | Application submitted |
| Responded | 서류통과 | Company responded, not yet interview |
| Interview | 면접 | Interview in progress |
| Offer | 합격 | Offer received |
| Hired | 입사 | Offer accepted (웹 헤더: 합격) |
| Rejected | 불합격 | Rejected by the company |
| Discarded | 폐기 | Candidate dropped the role, or the posting closed (웹 헤더: 보류) |
| SKIP | 스킵 | Does not fit — do not apply (웹 헤더: 보류) |

| # | Date | Company | Via | Role | Score | Status | PDF | Report | Notes | URL |
|---|------|---------|-----|------|-------|--------|-----|--------|-------|-----|
| 1 | 2026-03-02 | 예시테크 | 원티드 | 백엔드 개발자 | 4.2/5 | Applied | ❌ | — | 허구 예시 | https://www.wanted.co.kr/wd/00001 |
| 2 | 2026-03-04 | 가상소프트 | 사람인 | 풀스택 개발자 | 4.5/5 | Responded | ❌ | — | 허구 예시 | https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=1 |
| 3 | 2026-03-08 | 샘플랩 | 잡코리아 | Node.js 개발자 | 4.1/5 | Interview | ❌ | — | 허구 예시 | https://www.jobkorea.co.kr/Recruit/GI_Read/1 |
| 4 | 2026-03-11 | 페이크클라우드 | 리멤버 | 백엔드 엔지니어 | 4.7/5 | Offer | ❌ | — | 허구 예시 | https://career.rememberapp.co.kr/job/postings/1 |
| 5 | 2026-03-12 | 데모핀테크 | | 서버 개발자 | 3.6/5 | Rejected | ❌ | — | listing via=원티드 | https://www.wanted.co.kr/wd/00002 |
| 6 | 2026-03-15 | 테스트커머스 | | 웹 개발자 | 3.9/5 | Evaluated | ❌ | — | 보류 예시 | https://www.example.com/jobs/web |
| 7 | 2026-03-18 | 모의뱅크 | 원티드 | 백엔드 개발자 | 4.8/5 | Hired | ❌ | — | 허구 입사 예시 | https://www.wanted.co.kr/wd/00003 |
| 8 | 2026-03-20 | 허구커머스 | | 프론트엔드 개발자 | 3.2/5 | SKIP | ❌ | — | 연차 밴드 불일치 | https://www.example.com/jobs/fe |
| 9 | 2026-03-22 | 더미소프트 | | 풀스택 개발자 | 4.0/5 | Discarded | ❌ | — | 공고 마감 | https://www.example.com/jobs/closed |
