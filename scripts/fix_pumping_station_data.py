#!/usr/bin/env python3
"""Apply reference-table fixes to pumping-stations.geojson (no network)."""

from __future__ import annotations

import runpy
from pathlib import Path

if __name__ == "__main__":
    script = Path(__file__).resolve().parent / "apply_master_reference.py"
    runpy.run_path(str(script), run_name="__main__")
