# 운영자 화면: 전환, 처리할 일, 입점 승인, 신고 처리, 개인정보 요청, 사고 열람 기록, 공지, 정산, 이용자 쪽 신고·요청
from playwright.sync_api import sync_playwright
errs=[]; res=[]
def ok(n,c,x=''): res.append(bool(c)); print(('  ok  ' if c else 'FAIL  ')+n+('' if c else ' '+str(x)[:200]))
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = br.new_page(viewport={'width':390,'height':844})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'fonts' not in m.text and 'Failed to load resource' not in m.text else None)
    pg.goto('file:///home/claude/build/app/matsu.html'); pg.wait_for_selector('.top')
    pg.click('.tabs button:has-text("내 정보")'); pg.click('button[data-act="resetAll"][data-v="example"]')  # 기존 시나리오는 예시 데이터 기준
    txt = lambda: pg.inner_text('main')
    tab = lambda t: pg.click(f'.tabs button:has-text("{t}")')
    atab = lambda t: pg.click(f'.ctabs button:has-text("{t}")')
    # 이용자: 신고, 열람 요청
    tab('기록'); pg.locator('button[data-act="cmpOpen"]').first.click(); ok('신고 시트', '상대 신고' in pg.inner_text('.sheet'))
    pg.click('button[data-act="cmpGo"]'); ok('사유 없이 신고 불가', pg.locator('.toast.err').count()==1)
    pg.locator('button[data-act="cmpR"]').nth(2).click(); pg.click('button[data-act="cmpGo"]'); ok('신고 접수', '신고를 접수' in pg.inner_text('.toast'))
    tab('내 정보'); pg.click('button[data-act="privReq"][data-v="access"]'); ok('열람 요청', '열람을 요청' in pg.inner_text('.toast'))
    # 운영자 전환
    pg.click('.top button[data-v="admin"]'); ok('운영자 전환', '운영 현황' in txt() and pg.locator('.tabs').count()==0)
    t=txt(); ok('처리할 일 표시', '체육관 입점 신청' in t and '회원 신고' in t)
    ok('가로 스크롤 없음(현황)', pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
    pg.reload(); pg.wait_for_selector('.top'); ok('새로고침 후 운영자 화면 유지', '운영 현황' in txt())
    # 공지
    pg.fill('textarea[data-bind="ui.notice"]','11월 20일 21시 서버 점검 안내'); pg.click('button[data-act="aNotice"]'); ok('공지 발송', '명에게 보냈습니다' in pg.inner_text('.toast'))
    # 입점 승인
    atab('체육관·심판'); pg.click('button[data-act="aApp"][data-v="1"]'); ok('입점 승인 후 목록에 추가', '마장 예시복싱' in txt() and '대기 중인 입점 신청이 없습니다' in txt())
    pg.locator('button[data-act="aGym"]').first.click(); ok('운영 중지 표시', '운영 중지' in txt())
    pg.locator('button[data-act="aGym"]').first.click(); ok('운영 재개', pg.locator('.chip:has-text("운영 중지")').count()==0)
    pg.fill('input[data-bind="ui.refName"]','D'); pg.click('button[data-act="aRefAdd"]'); ok('지역 없이 심판 등록 불가', pg.locator('.toast.err').count()==1)
    pg.check('input[data-bind="ui.refReg.광진"]'); pg.click('button[data-act="aRefAdd"]'); ok('심판 등록', '주심 D' in txt())
    # 신고 처리
    atab('회원·신고'); ok('신고 2건(시드+내 신고)', '신고 2건' in txt(), txt()[:80])
    pg.locator('button[data-act="aCmp"][data-v="warn"]').first.click(); ok('처리 사유 없으면 불가', pg.locator('.toast.err').count()==1)
    pg.locator('input[data-bind^="ui.cm."]').first.fill('체육관 코치 확인 결과 사실'); pg.locator('button[data-act="aCmp"][data-v="warn"]').first.click()
    ok('경고 처리', '신고 1건' in txt() and '경고' in txt())
    pg.fill('input[data-bind="ui.mq"]','라온'); pg.press('input[data-bind="ui.mq"]','Tab'); ok('회원 검색', '라온' in txt())
    # 개인정보
    atab('개인정보·안전'); ok('요청 3건', '열람·삭제 요청 3건' in txt(), txt()[:60])
    pg.locator('button[data-act="aPriv"]').first.click(); ok('요청 처리', pg.locator('.toast').count()==1)
    ok('접근 기록 남음', '개인정보' in txt() and '운영자 (시연)' in txt())
    # 사고 열람: 이용자 리포트로 사고 만들기
    pg.click('.top button[data-v="user"]'); tab('내 정보'); pg.click('button[data-v="t-20"]'); pg.click('button[data-v="theirCI"]')
    tab('일정'); pg.locator('button:has-text("체크인")').first.click(); tab('내 정보'); pg.click('button[data-v="end"]')
    tab('일정'); pg.locator('button[data-act="reportOpen"]').first.click()
    for k,v in [('manner','5'),('control','4'),('intensityFelt','2')]: pg.click(f'button[data-act="repSet"][data-k="{k}"][data-v="{v}"]')
    pg.click('button[data-act="repSet"][data-k="skill"][data-v="same"]'); pg.click('button[data-act="repInj"][data-v="1"]')
    pg.check('input[data-bind="ui.sheet.sensitiveNow"]'); pg.fill('#injnote','턱 타박'); pg.click('button[data-act="repGo"]')
    pg.click('.top button[data-v="admin"]'); atab('개인정보·안전'); t=txt()
    ok('사고 내용은 가려짐', '턱 타박' not in t and '부상 내용 보기' in t)
    pg.click('button[data-act="aSee"]'); t=txt(); ok('열람 시 내용 표시 + 기록', '턱 타박' in t and '사고 기록(건강정보) 열람' in t)
    atab('정산'); ok('정산 표시', '앱 수수료 수입' in txt() and '왕십리 예시복싱' in txt())
    pg.click('button[data-act="help"]'); ok('운영자 안내부터 열림', '운영팀(본사)' in pg.inner_text('.sheet'))
    pg.click('button[data-act="close"]')
    for t_ in ['현황','체육관·심판','회원·신고','개인정보·안전','정산']:
        atab(t_); ok(f'가로 스크롤 없음({t_})', pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
    br.close()
print('오류:', errs or '없음'); print(f'통과 {sum(res)} / {len(res)}')
