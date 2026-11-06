import sys
from playwright.sync_api import sync_playwright
errs=[]; steps=[]
def ok(name, cond, extra=''):
    steps.append(bool(cond)); print(('  ok  ' if cond else 'FAIL  ')+name+(' '+str(extra) if (extra and not cond) else ''))
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = br.new_context(viewport={'width':390,'height':844}, locale='ko-KR')
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'Failed to load resource' not in m.text else None)
    pg.goto('file:///home/claude/build/app/matsu.html'); pg.wait_for_selector('.app .top')
    txt = lambda: pg.inner_text('main')
    tab = lambda n: pg.click(f'.tabs button:has-text("{n}")')
    ok('첫 화면에 다음 스파링·받은 요청이 있다', '민재' in txt() and '은찬' not in txt() and '요청' in txt(), txt()[:200])
    # 받은 요청 수락/거절
    ok('받은 요청 수락 버튼', pg.locator('button[data-act="accept"]').count()==1)
    pg.click('button[data-act="decline"]'); ok('거절 후 할 일 비어 있음', '지금 처리할 일이 없습니다' in txt())
    # 24시간 이상 남은 확정 예약 취소 → 불이익 없음
    tab('일정'); pg.locator('button[data-act="cancelOpen"]').first.click()
    ok('24시간 이상 전 취소 안내(전액 환불)', '전액 환불' in pg.inner_text('.sheet'), pg.inner_text('.sheet')[:120])
    pg.keyboard.press('Escape'); ok('Esc로 시트 닫힘', pg.locator('.sheet').count()==0)
    # 시계를 시작 20분 전으로 → 직전 취소 안내와 제재
    tab('내 정보'); pg.click('button[data-v="t-20"]'); tab('일정'); pg.locator('button[data-act="cancelOpen"]').first.click()
    ok('직전 취소 경고(환불 없음·제재)', '환불되지 않고' in pg.inner_text('.sheet') and '경고 1회' in pg.inner_text('.sheet'), pg.inner_text('.sheet')[:160])
    pg.click('button[data-act="cancelGo"]'); ok('취소 후 지난 목록으로', pg.locator('.chip:has-text("취소")').count()>=1)
    tab('내 정보'); pg.click('button[data-v="tz"]')
    # 지도 스파링 안내 (중급이라 막힘)
    tab('찾기'); pg.click('button[data-v="guided"]'); ok('중급은 지도 스파링 불가 안내', '입문·초급 이용자를 위한' in txt())
    # 레벨 인증 요청 → 심사 중, 매칭 제한
    tab('기록'); pg.click('button[data-act="verOpen"]'); pg.select_option('.sheet select','4'); pg.fill('.sheet textarea','시연용 근거'); pg.click('button[data-act="verGo"]')
    ok('심사 중 표시', '확인 중' in txt(), txt()[:100])
    tab('찾기'); pg.click('button[data-v="match"]'); ok('인증 전에는 매칭 불가 안내', '레벨 인증 전에는 매칭할 수 없습니다' in txt())
    pg.click('.seg button[data-v="console"]'); ok('코치 화면에 요청 도착', '하늘' in txt() and '시연용 근거' in txt(), txt()[:200])
    pg.select_option('select[id^="vl-"]','4'); pg.click('button[data-act="vOk"]')
    pg.click('.seg button[data-v="user"]'); tab('기록'); ok('승인 후 상급으로 변경', '상급' in txt() and '코치 인증' in txt(), txt()[:80])
    # 프로필 검증
    tab('내 정보'); pg.fill('#pf-w','10'); pg.click('button[data-act="saveProf"]'); ok('잘못된 체중 입력 오류', pg.locator('.toast.err').count()==1)
    pg.fill('#pf-w','70'); pg.fill('#pf-nick','<b>x</b>'); pg.click('button[data-act="saveProf"]'); ok('저장 성공', pg.locator('.toast:not(.err)').count()==1)
    tab('홈'); ok('닉네임이 HTML로 해석되지 않음', '<b>x</b>' in pg.inner_text('main') and pg.locator('main h1 b').count()==0, pg.inner_text('main')[:60])
    # 초기화
    tab('내 정보'); pg.click('button[data-act="resetAll"]'); tab('홈'); ok('초기화 후 하늘', '하늘님' in txt())
    # 시트가 길 때 스크롤 위치 유지
    tab('찾기'); pg.locator('button:has-text("스파링 요청")').first.click(); pg.evaluate("document.querySelector('.sheet').scrollTop=300")
    pg.locator('.slots .pick:not([disabled])').first.click(); y = pg.evaluate("document.querySelector('.sheet').scrollTop"); ok('시트 재렌더 후 스크롤 유지', y>100, y)
    pg.screenshot(path='/home/claude/build/shot_sheet.png'); pg.keyboard.press('Escape')
    # 다크, 데스크톱
    ctx2 = br.new_context(viewport={'width':1280,'height':800}, color_scheme='dark', locale='ko-KR'); p2 = ctx2.new_page(); p2.goto('file:///home/claude/build/app/matsu.html'); p2.wait_for_selector('.app .top')
    p2.click('.tabs button:has-text("일정")'); p2.screenshot(path='/home/claude/build/shot_dark.png')
    p2.click('.seg button[data-v="console"]'); p2.click('.ctabs button:has-text("링·대진")'); p2.locator('.dates .pick').nth(2).click(); p2.screenshot(path='/home/claude/build/shot_console.png')
    br.close()
print('오류:', errs if errs else '없음'); print('통과', sum(steps), '/', len(steps)); sys.exit(0 if all(steps) and not errs else 1)
