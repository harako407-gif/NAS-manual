"""Build and serve locally so external GIF files can be fetched by the player."""
import functools
import http.server
import runpy
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if __name__ == '__main__':
    runpy.run_path(str(ROOT / 'tools/build.py'), run_name='__main__')
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(('127.0.0.1', 8765), handler) as server:
        print('http://127.0.0.1:8765/index.html (Ctrl+C to stop)', flush=True)
        webbrowser.open('http://127.0.0.1:8765/index.html')
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
