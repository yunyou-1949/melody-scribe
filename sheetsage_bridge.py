#!/usr/bin/env python3
"""Run an installed SheetSage2 WebUI with CORS enabled.

Usage:
  runtime\\python\\python.exe sheetsage_bridge.py <SheetSage2 root> [port]

The original SheetSage2 server has no CORS headers, so the Melody Scribe
WebView cannot call it from file://. This wrapper imports its FastAPI app,
adds CORS, and serves it on the same port.
"""
import os
import sys


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: sheetsage_bridge.py <sheetsage-root> [port]", file=sys.stderr)
        return 2
    root = os.path.abspath(sys.argv[1])
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8777
    if not os.path.isdir(os.path.join(root, "app")):
        print("SheetSage2 app folder not found: " + root, file=sys.stderr)
        return 2

    os.chdir(root)
    sys.path.insert(0, root)

    from fastapi.middleware.cors import CORSMiddleware
    from app.server import app

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
        allow_credentials=False,
    )

    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
