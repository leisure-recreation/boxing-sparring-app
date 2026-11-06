import re, pathlib
d = pathlib.Path(__file__).parent
def strip_node(src):
    # node 전용 require 분기와 module.exports 줄은 브라우저용 단일 파일에서 제거
    src = re.sub(r"\(typeof require !== 'undefined'\) \? require\('[^']+'\) : (\w+)", r"\1", src)
    src = re.sub(r"if \(typeof module !== 'undefined'\) module\.exports = \w+;\n?", "", src)
    return src
js = "\n".join(strip_node((d / f).read_text(encoding='utf-8')) for f in ['core.js','store.js','flow.js','flow2.js','flow3.js','ui_core.js','ui_a.js','ui_b.js','ui_c.js','ui_d.js','ui_e.js','boot.js'])
css = (d / 'style.css').read_text(encoding='utf-8')
html = f"""<title>맞수</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;500;700&display=swap">
<style>
{css}
</style>
<div class="app" id="app"></div>
<script>
{js}
</script>
"""
out = d / 'matsu.html'; out.write_text(html, encoding='utf-8'); print(out, len(html))
