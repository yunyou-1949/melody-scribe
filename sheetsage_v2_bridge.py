#!/usr/bin/env python3
"""Start SheetSage2 Studio V2 with CORS and without the browser-only guard.

Usage:
  <SheetSage2>\\.venv\\Scripts\\python.exe sheetsage_v2_bridge.py <SheetSage2 root> [port]

The original V2 server is protected against arbitrary local web pages. Melody
Scribe is a local WebView app, so this wrapper disables that guard and adds CORS
for its own `file://`/localhost page.
"""
import os
import sys


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: sheetsage_v2_bridge.py <sheetsage-root> [port]", file=sys.stderr)
        return 2
    root = os.path.abspath(sys.argv[1])
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8000
    src = os.path.join(root, "src")
    if not os.path.isdir(os.path.join(src, "sheetsage2_webui")):
        print("SheetSage2 V2 source folder not found: " + src, file=sys.stderr)
        return 2

    os.chdir(root)
    sys.path.insert(0, src)
    os.environ.setdefault("SHEETSAGE_NO_BROWSER", "1")

    from fastapi.middleware.cors import CORSMiddleware
    import sheetsage2_webui.webui.__main__ as entry

    original_create_app = entry.create_app

    def patched_create_app(*args, **kwargs):
        kwargs["loopback_guard"] = False
        kwargs["require_token"] = False
        app = original_create_app(*args, **kwargs)
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["*"],
            allow_headers=["*"],
            expose_headers=["*"],
            allow_credentials=False,
        )
        return app

    entry.create_app = patched_create_app
    sys.argv = ["sheetsage2_webui", "--host", "127.0.0.1", "--port", str(port)]
    entry.main()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
