"""Compose platform templates into the four root HTML pages."""
import re
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = ROOT / 'templates'

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
        name = 'index.html' if platform == 'windows' else f'{platform}.html'
        (ROOT / name).write_text(result, encoding='utf-8')
        print(f'Built {name}')
