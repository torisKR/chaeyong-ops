# 모드: pdf — 한국어 ATS 이력서 PDF

JD에 맞춘 이력서 PDF를 생성합니다. **전체 파이프라인·JSON 스키마·ATS 규칙은 `modes/pdf.md`를 따릅니다.** 이 파일은 한국 채용 맥락 오버라이드만 정의합니다.

## 한국 기본값

`config/profile.yml` 예시:

```yaml
language:
  output: ko
  modes_dir: modes/ko

cv:
  template: ko-standard   # templates/cv-template.ko-standard.html
```

| 항목 | 한국 기본 | 비고 |
|------|-----------|------|
| `lang` (JSON payload) | `ko` | 한글 타이포그래피 CSS 활성화 |
| `page_format` | `a4` | 한국·유럽 표준 (US 회사 지원 시 `letter`) |
| 섹션 제목 | 아래 `sections` 객체 | 영문 JD라도 출력 언어는 `language.output` |

## 파이프라인 요약 (`modes/pdf.md` 동일 순서)

1. `cv.md` 읽기 (source of truth)
2. JD 확보 (없으면 URL/텍스트 요청)
3. JD에서 15–20개 keyword 추출
4. **필수:** `jds/{slug}.md` 저장 → `node jd-skill-gap.mjs jds/{slug}.md --summary`
   - `gap` skill은 사용자에게 **먼저** 알리고, CV에 **추가하지 않음**
5. `language.output`로 CV 문장 작성 (기본 `ko`)
6. paper: 한국 지원 → **`a4`**
7. archetype에 맞게 framing
8. (선택) JD 유사도 / reuse 판단 — `npm run jd:similarity`
9. `modes/heuristics/recruiter-side.md` risk map
10–15. Summary·경력 bullet·competency grid — **keyword reformulation only, fabrication 금지**
16. `profile.yml` → candidate slug
17. JSON payload → `/tmp/cv-{candidate}-{company}.json`
18. `node build-cv-html.mjs ... templates/cv-template.ko-standard.html`
19. **Hard gate:** `node verify-cv-facts.mjs {html-path}` — 실패 시 PDF 생성 중단
20. (선택) `--hm-audit` — `modes/pdf/hm-audit.md`
21. `node generate-pdf.mjs {html} {pdf} --format=a4 --report={NNN}`
22. 결과: PDF 경로, 페이지 수, keyword coverage, 미해결 gap

## 한국어 JSON `sections` 예시

`build-cv-html.mjs` payload에 포함:

```json
{
  "lang": "ko",
  "page_format": "a4",
  "sections": {
    "summary": "요약",
    "competencies": "핵심 역량",
    "experience": "경력",
    "projects": "프로젝트",
    "education": "학력",
    "certifications": "자격증",
    "awards": "수상",
    "skills": "기술 스택"
  }
}
```

나머지 필드(`experience[]`, `skills[]` 등)는 `modes/pdf.md` JSON Input Schema와 동일합니다.

## 한국 채용 시장 — CV 작성 규칙

- **사진:** 기본 **미포함** (`candidate.photo` 비움). 일부 대기업·금융권은 사진을 요구할 수 있음 → 사용자가 명시적으로 opt-in할 때만 `profile.yml`에 설정.
- **생년월일·주소·병역:** JD나 지원 폼이 요구할 때만 포함. `cv.md`에 없으면 **추가하지 않음**.
- **희망 연봉:** CV 본문에 넣지 않음 (지원서 필드 또는 `jiwon` 모드에서 처리).
- **영어 JD + 한국어 CV:** JD keyword는 영문 그대로 competency/skill에 **자연스럽게** 반영 (예: `Kubernetes`, `LLM` — 한국 테크 업계 표준).
- **1페이지 vs 2페이지:** 신입·3–7년차는 1페이지 권장 (`--max-pages=1`). 시니어는 2페이지까지 허용.

## 템플릿 선택

```bash
node cv-templates.mjs resolve cv ko-standard
node cv-templates.mjs list cv
```

`config/profile.yml`의 `cv.template: ko-standard`가 없으면 `node cv-templates.mjs resolve cv`로 기본값 확인.

## ATS 검증 (선택)

```bash
node verify-ats.mjs output/cv-{candidate}-{company}.html
```

`modes/ats.md` — advisory only. fact gate(`verify-cv-facts.mjs`)와 별개.

## 출력 언어

모든 사용자 대면 메시지(경로 안내, gap 알림, skill-gap inconclusive 경고)는 **`language.output`** (기본 `ko`)로 작성합니다.

## 관련 모드

- 평가 후 PDF: `modes/ko/auto-pipeline.md` Step 3
- 지원서 작성: `modes/ko/jiwon.md`
- LaTeX 경로: `modes/latex.md` (한국어 전용 tex 템플릿은 별도 — 기본은 HTML/ko-standard)
