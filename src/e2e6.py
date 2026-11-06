# 예전 버전(v1) 데이터가 브라우저에 남아 있어도 처음 상태로 시작하는지
from playwright.sync_api import sync_playwright
res=[]
def ok(n,c,x=''): res.append(bool(c)); print(('  ok  ' if c else 'FAIL  ')+n+('' if c else ' '+str(x)[:200]))
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = br.new_context(viewport={'width':390,'height':844}); pg = ctx.new_page()
    pg.goto('file:///home/claude/build/app/matsu.html'); pg.wait_for_selector('.top')
    # 예전 버전 저장 데이터를 흉내: 오늘 날짜의 예시 데이터를 v1 키에 넣는다
    pg.evaluate("""()=>{const s=JSON.parse(localStorage.getItem('matsu-proto-v2'));s.st.users.find(u=>u.id==='me').nick='하늘';s.st.users.find(u=>u.id==='me').profileDone=true;localStorage.setItem('matsu-proto-v1',JSON.stringify(s));localStorage.removeItem('matsu-proto-v2');}""")
    pg.reload(); pg.wait_for_selector('.top')
    ok('예전 데이터가 있어도 처음 상태로 시작', '처음 오셨네요' in pg.inner_text('main'))
    ok('예전 데이터는 지워짐', pg.evaluate("localStorage.getItem('matsu-proto-v1')") is None)
    pg.click('.tabs button:has-text("내 정보")'); pg.click('button[data-act="resetAll"][data-v="example"]'); pg.reload(); pg.wait_for_selector('.top')
    ok('새 버전에서 고른 상태는 새로고침해도 유지', '하늘님' in pg.inner_text('main'))
    br.close()
print(f'통과 {sum(res)} / {len(res)}')
