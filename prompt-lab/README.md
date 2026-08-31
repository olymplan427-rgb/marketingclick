# 프롬프트 테스트실 (로컬 전용)

`js/blog.js`가 실제로 쓰는 프롬프트를 그대로 불러와서, 구글시트/사용량 등 운영 데이터를 전혀
건드리지 않고 로컬 `claude`/`codex` CLI로 대표 주제들을 일괄 생성 → 자동 검사 → (선택) 정성평가까지
해보는 도구. 매번 실제 블로그 글을 발행용으로 만들어보며 점검할 필요를 없애기 위한 것.

## 사용법

```bash
cd marketingtool/prompt-lab
node run.js                 # topics.json 전체 실행, 규칙 검사만
node run.js edu-column      # 특정 주제(id)만
node run.js --grade         # 규칙 검사 + claude(+codex) 정성평가까지
```

Node 외 별도 설치(`npm install`) 불필요 — 내장 모듈만 사용. `claude` CLI만 있으면 규칙 검사까지는
바로 실행 가능하고, `codex` CLI도 PATH에 있으면 정성평가가 자동으로 교차검증(둘 다 채점)으로 바뀐다.

## 구조

- `topics.json` — 대표 시험 주제 8개(기존 7개 글 유형 각 1개 + 분량 스케일링 확인용 1개 추가)
- `sandbox.js` — `js/blog.js`를 Node vm으로 그대로 로드(document/localStorage만 더미로 채움).
  프롬프트가 바뀌면 이 폴더는 손댈 필요 없이 자동으로 최신 프롬프트를 씀.
- `local-ai.js` — `blogCall`(원래는 구글시트 사용량을 쓰는 백엔드 호출)을 로컬 `claude -p` CLI
  호출로 대체. 정성평가용 `codex exec` 호출도 여기 있음.
- `checks.js` — 코드로 즉시 판단 가능한 항목(분량, 제목 길이, 금지어, HTML 엔티티, 마크다운,
  AI 상투구, 반복 표현, 종결어미 반복, 문단 길이, 연락처 블록, 썸네일/본문이미지 정책)
- `grader.js` — 기계적으로 못 잡는 항목(제목-본문 일치, 문체 자연스러움, 반복 설명, 유형/분위기
  부합, 홍보 과도 여부)을 claude/codex 각각에 독립적으로 채점시킴. 브랜드 톤 기준은 `blog.js`의
  `BLOG_DRAFT_STYLE_DEFAULT`를 그대로 씀 — 분량/구조처럼 자주 바뀌는 지시가 아니라 비교적 고정된
  브랜드 톤 기준으로 "잘 쓴 글인지"만 본다.
- `run.js` — 위 조각들을 순서대로 실행하는 진입점. 결과는 `results/run-<시각>.json`에 저장(gitignore).

## 사용량

주제 하나당 초안 1회 + 최종본 1회, `--grade` 옵션 켜면 채점 1~2회(claude/codex) 추가.
전부 로컬 CLI 로그인 세션을 쓰므로 별도 API 키나 구글시트 사용량 소진이 없다.

## 반영 방법

여러 주제에서 **반복적으로** 걸리는 문제만 `js/blog.js`의 프롬프트를 수동으로 고친다(한 번 나온
표현을 바로 프롬프트에 추가하지 않음). 고치는 방식은 상황에 따라:
- 프롬프트 규칙 문구 자체를 더 명확하게 수정
- `checks.js`에 검증 규칙 추가(반복되면 자동으로 걸러지게)
- 유형별(`BLOG_TYPE_RULES`) 조건부 규칙으로 분리(모든 유형에 적용하면 안 되는 경우)

고친 뒤 다시 `node run.js --grade`로 같은 주제들을 재실행해서 점수/실패 항목이 실제로 개선됐는지
확인한다.

## codex CLI

이 PC에는 아직 `codex`가 설치돼 있지 않아 `codex exec` 호출 부분은 실제로 검증하지 못했다.
설치 후 `codex exec --help`로 정확한 비대화형 실행 플래그를 확인하고, 다르면 `local-ai.js`의
`runCodex()` 인자만 맞추면 된다. 없어도 `run.js`는 claude 단독으로 정상 동작한다.
