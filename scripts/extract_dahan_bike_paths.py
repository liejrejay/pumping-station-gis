#!/usr/bin/env python3
"""相容舊指令：轉呼叫 scripts/build_waterfront_paths.py。"""

import runpy
from pathlib import Path

if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).with_name("build_waterfront_paths.py")), run_name="__main__")
