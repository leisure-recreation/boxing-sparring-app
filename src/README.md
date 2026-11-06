# 소스

`index.html`은 이 폴더의 파일을 합쳐 만든 결과물입니다. 수정은 여기서 하고 다시 빌드합니다.

- `python3 build.py` → `matsu.html` 생성 (이걸 상위 폴더 `index.html`로 복사)
- `node test.js` → 로직 테스트
- `python3 e2e.py` 등 → 브라우저 시나리오 (Playwright, 경로는 작업 환경에 맞게 수정)

구성: core(매칭 규칙) · store(시연 데이터·슬롯) · flow(예약·취소·노쇼) · flow2(리포트·레벨·스파링 데이) · flow3(운영자) · ui_*(화면) · boot(시작)
