"""Rebuild SVG sources and portable outlines. Requires Python fontTools.
Run from any directory, then run node brand-assets/tools/export-png.mjs.
"""
from pathlib import Path
from html import escape
import json
import shutil
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT.parent
for folder in ['logos/originals', 'logos/exports', 'templates/originals',
               'social/exports', 'social/images', 'guidelines', 'colors-and-type']:
    (ROOT / folder).mkdir(parents=True, exist_ok=True)
FONTS = {weight: TTFont(ROOT / f'colors-and-type/fonts/Geist-{weight}.ttf')
         for weight in ['Regular', 'Bold']}
INK, GREEN, MINT, LIME, CREAM = '#102E2A', '#123F38', '#DFF4EB', '#C9F27C', '#F7F5EE'
SKYLINE = 'M8 35.5h4.25v-5.25h3V23.5h2.5v-3.25h2.5v3.25h2.5v8.75h3v-4.5c0-4.2 2.35-7.75 5.25-8.85v-2.4h2v2.4c2.9 1.1 5.25 4.65 5.25 8.85v4.5h2.5V25h2.5v10.5H47v4H8v-4Z'
WATER = 'M8 42c5-1.55 9.7-1.55 14.1 0 4.45 1.55 9.1 1.55 13.95 0 3.65-1.2 7.3-1.4 10.95-.55'

def icon(x, y, size, mono=None):
    return f'<g transform="translate({x} {y}) scale({size/48})"><rect x="1" y="1" width="46" height="46" rx="13" fill="{mono or GREEN}"/><circle cx="13.5" cy="13.5" r="3" fill="{CREAM if mono else LIME}"/><path d="{SKYLINE}" fill="#FBFCF9"/><path d="{WATER}" fill="none" stroke="{CREAM if mono else "#9ED8C7"}" stroke-width="1.7" stroke-linecap="round"/></g>'

def text(value, x, y, size, color=INK, bold=False, outlined=False, tracking=0):
    weight = 'Bold' if bold else 'Regular'
    if not outlined:
        return f'<text x="{x}" y="{y}" font-family="Geist" font-size="{size}" font-weight="{700 if bold else 400}" letter-spacing="{tracking}" fill="{color}">{escape(value)}</text>'
    font = FONTS[weight]
    glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
    upem = font['head'].unitsPerEm
    scale = size / upem
    paths, cursor = [], 0
    for char in value:
        name = cmap.get(ord(char), '.notdef')
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(pen)
        paths.append(f'<path d="{pen.getCommands()}" transform="translate({cursor} 0)"/>')
        cursor += glyphs[name].width + tracking / scale
    return f'<g aria-label="{escape(value)}" fill="{color}" transform="translate({x} {y}) scale({scale} {-scale})">' + ''.join(paths) + '</g>'

def logo(x, y, size, outlined, light=False):
    return icon(x, y, size) + text('Ownly Malta', x+size*1.26, y+size*.72, size*.54, CREAM if light else INK, True, outlined, -size*.02)

def svg(w, h, content, label):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="{escape(label)}"><title>{escape(label)}</title>{content}</svg>'

def save(path, content):
    (ROOT / path).write_text(content, encoding='utf-8')

shutil.copy2(PROJECT / 'public/favicon.svg', ROOT / 'logos/originals/ownly-icon.svg')
shutil.copy2(PROJECT / 'public/favicon.svg', ROOT / 'logos/exports/ownly-icon.svg')
shutil.copy2(PROJECT / 'public/valletta-mark.png', ROOT / 'social/images/valletta-mark-original.png')
for name, light, mono in [('primary', False, None), ('reverse', True, None), ('one-color', False, GREEN)]:
    for outlines in [False, True]:
        # Reverse logo has a green backing plate for reliable visibility.
        backing = f'<rect width="560" height="128" rx="20" fill="{GREEN}"/>' if light else ''
        if mono:
            # True single-ink lockup: negative spaces reveal the background.
            mark = f'<g transform="translate(20 20) scale(1.833333)"><defs><mask id="cut"><rect width="48" height="48" fill="white"/><circle cx="13.5" cy="13.5" r="3" fill="black"/><path d="{SKYLINE}" fill="black"/><path d="{WATER}" fill="none" stroke="black" stroke-width="1.7"/></mask></defs><rect x="1" y="1" width="46" height="46" rx="13" fill="{GREEN}" mask="url(#cut)"/></g>'
            content = mark + text('Ownly Malta', 131, 83.36, 47.52, INK, True, outlines, -1.76)
            content = content.replace(f'fill="{INK}"', f'fill="{GREEN}"')
        else:
            content = backing + logo(20, 20, 88, outlines, light)
        save(f'logos/{"exports" if outlines else "originals"}/ownly-logo-{name}.svg', svg(560, 128, content, f'Ownly Malta — {name}'))

def post(w, h, outlined):
    story = h > 1500
    top = 210 if story else 80
    title_y = top + 210
    body = f'<rect width="{w}" height="{h}" fill="{CREAM}"/>'
    body += logo(80, top, 66, outlined)
    body += text('PROPERTY CLARITY. MADE FOR MALTA.', 80, title_y-100, 18, GREEN, True, outlined, 2)
    for i, line in enumerate(['Know what your', 'property is', 'really earning.']):
        body += text(line, 76, title_y+i*101, 88, GREEN, True, outlined, -3)
    by = title_y+266
    body += text('Income, expenses and cash flow.', 80, by, 29, INK, False, outlined, -.5)
    body += text('One clear view of your property.', 80, by+43, 29, INK, False, outlined, -.5)
    card_y = by+100
    card_h = 200 if h == 1080 else 300
    if story:
        card_h = 360
    body += f'<rect x="80" y="{card_y}" width="920" height="{card_h}" rx="28" fill="{GREEN}"/>'
    body += text('THE CASH FLOW EQUATION', 116, card_y+47, 17, MINT, True, outlined, 2)
    labels = [('Income', LIME), ('Expenses', MINT), ('Cash flow', CREAM)]
    for i, (label, color) in enumerate(labels):
        x = 116+i*300
        body += f'<rect x="{x}" y="{card_y+78}" width="{145 if i==0 else 104 if i==1 else 185}" height="8" rx="4" fill="{color}"/>'
        body += text(label, x, card_y+133, 30, CREAM, True, outlined, -.8)
        if i < 2:
            body += text('−' if i==0 else '=', x+238, card_y+133, 30, MINT, False, outlined)
    if card_h >= 300:
        body += f'<path d="M116 {card_y+185}H964" stroke="#41665E"/>'
        body += text('See the whole picture.', 116, card_y+242, 35, LIME, True, outlined, -1)
    footer_y = h-(230 if story else 65)
    body += text('ownlymalta.com', 80, footer_y, 25, GREEN, True, outlined, -.6)
    body += text('PROPERTY PERFORMANCE, MADE CLEAR.', 80, footer_y-48, 15, GREEN, True, outlined, 1.6)
    return svg(w, h, body, 'Ownly Malta — introductory Facebook post')

for name, w, h in [('post-square',1080,1080), ('post-portrait',1080,1350), ('story',1080,1920)]:
    save(f'templates/originals/{name}.svg', post(w,h,False))
    save(f'social/exports/{name}.svg', post(w,h,True))

avatar = f'<rect width="1080" height="1080" fill="{GREEN}"/>'+icon(240,240,600)
save('social/exports/facebook-profile.svg', svg(1080,1080,avatar,'Ownly Malta profile icon'))
save('templates/originals/facebook-profile.svg', svg(1080,1080,avatar,'Ownly Malta profile icon'))
for outline in [False, True]:
    content = f'<rect width="1640" height="720" fill="{GREEN}"/><circle cx="1440" cy="140" r="270" fill="#1B5146"/><path d="M0 647 Q410 580 820 647 T1640 647" fill="none" stroke="#416D5F" stroke-width="2"/>'
    content += logo(350,150,78,outline,True)
    content += text('Know what your property',350,350,64,CREAM,True,outline,-2)
    content += text('is really earning.',350,430,64,LIME,True,outline,-2)
    content += text('ownlymalta.com',350,510,26,MINT,False,outline)
    save(f'{"social/exports" if outline else "templates/originals"}/facebook-cover.svg',svg(1640,720,content,'Ownly Malta Facebook cover'))

palette = {'ink': INK, 'green': GREEN, 'mint': MINT, 'lime': LIME, 'cream': CREAM,
           'background': '#FBFCF9', 'line': '#DFE5DF', 'water': '#9ED8C7'}
save('colors-and-type/palette.json', json.dumps(palette, indent=2)+'\n')
save('colors-and-type/palette.css', ':root {\n'+''.join(f'  --ownly-{key}: {value};\n' for key,value in palette.items())+'}\n')
swatches = '<rect width="1200" height="700" fill="#FBFCF9"/>'+text('Ownly Malta / Colour palette',60,85,38,INK,True,True,-1)
for i,(name,color) in enumerate(list(palette.items())[:5]):
    x=60+i*224
    swatches += f'<rect x="{x}" y="150" width="200" height="340" rx="18" fill="{color}" stroke="#DFE5DF"/>'
    swatches += text(name.upper(),x,540,19,INK,True,True,1)+text(color,x,581,26,INK,False,True)
save('colors-and-type/palette.svg',svg(1200,700,swatches,'Ownly Malta colour palette'))
print('Brand SVG kit generated.')
