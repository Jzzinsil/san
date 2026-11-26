# SAN — 모든 작업자(사람 · Claude)가 지켜야 할 것

## 1. 방문 집계 코드는 절대 지우지 않는다 (주인 지시, 2026-11-26)

`index.html` · `en/index.html` · `ja/index.html`의 `<head>`에 있는 방문 집계 코드는 **지우거나, 끄거나, 조건을 바꾸지 않는다.** 바꿔야 할 이유가 있으면 먼저 주인에게 묻는다.

지켜야 하는 것:
- GA4 로더: `https://www.googletagmanager.com/gtag/js?id=G-L7QPQ5GGL7`와 `gtag('config', 'G-L7QPQ5GGL7', …)`.
- Vercel Web Analytics 로더: `/_vercel/insights/script.js`.
- 두 로더를 붙이는 운영 주소 조건: `sanissan.vercel.app`, `jzzinsil.github.io`.

알아 둘 것:
- `/_vercel/insights/script.js`는 이 저장소에 없는 파일이다. Vercel이 배포할 때 자동으로 내어 준다. 로컬이나 github.io에서 404가 나는 것은 정상이다.
  - **"없는 파일을 부른다"는 이유로 지우지 말 것.** v3.37.1에서 이렇게 잘못 지워져 방문 수가 집계되지 않았고, v3.39.2에서 되살렸다.
- 운영 주소 조건이 있는 이유: 미리보기 · 테스트(file:// · localhost)에서는 아무것도 밖으로 보내지 않게 하기 위해서다. 조건은 그대로 두고, 운영 주소를 더할 때만 주인 허락을 받아 늘린다.
- 이 저장소의 git `pre-commit` 훅(`.githooks/pre-commit`)이 위 코드가 빠진 커밋을 막는다. 훅을 끄거나(`--no-verify`) 고쳐서 우회하지 않는다.
  - 새로 받은 저장소에서는 `git config core.hooksPath .githooks`를 한 번 실행하면 훅이 켜진다.

### 배포 전후 집계 확인 (매번)
- **배포 전:** 커밋하면 `pre-commit` 훅이 세 입구 파일(`index.html` · `en/index.html` · `ja/index.html`)에 GA4 · Vercel 로더가 다 있는지 확인한다. 빠지면 커밋이 멈춘다.
- **배포 후:** 푸시하고 두 주소에 새 판이 뜬 뒤 `node tools/check-analytics-live.mjs`를 돌린다.
  - 결과가 `ANALYTICS OK`여야 한다. 두 운영 주소의 세 입구에서 GA 집계 요청이 나가고, `sanissan.vercel.app`에서는 Vercel 집계 요청도 나간다는 뜻이다.
  - 이 검사는 집계 요청을 보내기 직전에 막아서, 시험 방문이 통계에 섞이지 않는다.
  - `FAIL`이 나오면 그 배포를 그대로 두지 말고 바로 고치거나 되돌린다.
- **시험 도구:** 로컬 테스트용 브라우저 드라이버는 GA를 막고 쓴다. 테스트 방문이 집계되지 않게 하기 위해서다.
  - Vercel 스크립트는 자동화 브라우저(`navigator.webdriver`, 'Headless' 사용자 에이전트)를 스스로 세지 않는다. 그래서 헤드리스 시험에서 Vercel 요청이 안 보여도 실제 방문은 집계된다. 확인은 위 검사로 한다.

## 2. 배포

- 주인이 허락하기 전에는 커밋 · 푸시(배포)하지 않는다.
- `en/index.html` · `ja/index.html` · `how/` · `en/how/` · `ja/how/` · `sitemap.xml` · `og-*-1.png`는 사이트 빌드 스크립트가 `index.html`에서 만든다. 손으로 고치면 다음 배포 때 덮어쓰인다.
- 개인 정보(실제 사람의 이름 · 생년월일)는 코드 · 테스트 · 커밋 어디에도 넣지 않는다. 시험에는 지어낸 인물만 쓴다.
