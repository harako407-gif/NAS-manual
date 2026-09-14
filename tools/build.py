"""Compose platform templates and copy deployment assets into dist/."""
import re
import hashlib
import shutil
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = ROOT / 'templates'
DIST = ROOT / 'dist'

def render(path, stack=()):
    path = path.resolve()
    if not path.is_relative_to(TEMPLATES.resolve()) or path in stack:
        raise ValueError(f'Invalid or circular template include: {path}')
    text = path.read_text(encoding='utf-8')
    return re.sub(
        r'^([ \t]*)\{\{include:([^}]+)\}\}',
        lambda match: textwrap.indent(
            render(TEMPLATES / match[2], (*stack, path)).rstrip('\n'), match[1]
        ),
        text,
        flags=re.MULTILINE,
    )

if __name__ == '__main__':
    DIST.mkdir(exist_ok=True)
    shell = render(TEMPLATES / 'page.html')
    for platform in ('windows', 'android', 'ios', 'mac'):
        content = render(TEMPLATES / 'platforms' / f'{platform}.html').rstrip('\n')
        result = re.sub(
            r'^([ \t]*)\{\{platform-content\}\}',
            lambda match: textwrap.indent(content, match[1]),
            shell,
            flags=re.MULTILINE,
        )
        result = re.sub(r'\{\{active:([^}]+)\}\}', lambda m: 'aria-current="page"' if m[1] == platform else '', result)
        # A changed stylesheet/script must bypass an older browser cache entry.
        result = re.sub(
            r'(?P<attr>href|src)="(?P<path>assets/(?:css|js)/[^"?]+\.(?:css|js))"',
            lambda match: (
                f'{match["attr"]}="{match["path"]}?v='
                f'{hashlib.sha256((ROOT / match["path"]).read_bytes()).hexdigest()[:12]}"'
            ),
            result,
        )
        name = 'index.html' if platform == 'windows' else f'{platform}.html'
        (DIST / name).write_text(result, encoding='utf-8')
        print(f'Built dist/{name}')
    shutil.copytree(ROOT / 'assets', DIST / 'assets', dirs_exist_ok=True)
    # Remove obsolete asset files after a source rename, within dist/assets only.
    asset_output = (DIST / 'assets').resolve()
    if not asset_output.is_relative_to(DIST.resolve()):
        raise ValueError('Asset output must stay inside dist')
    for path in asset_output.rglob('*'):
        if path.is_file() and path.resolve().is_relative_to(asset_output):
            if not (ROOT / 'assets' / path.relative_to(asset_output)).is_file():
                path.unlink()
    print('Copied assets to dist/assets')
