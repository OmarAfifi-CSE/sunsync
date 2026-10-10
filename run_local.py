"""
run_local.py - SunSync Local Runner & Developer Launcher

Single-command developer utility to launch the high-performance SunSync web app
or run the automated test suite.

Usage:
    python run_local.py          # Launches High-Speed Web Dashboard on http://localhost:8000
    python run_local.py --test   # Executes Automated Test Suite
"""

import sys
import os
import subprocess

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    src_dir = os.path.join(base_dir, "src")
    os.environ["PYTHONPATH"] = src_dir

    arg = sys.argv[1] if len(sys.argv) > 1 else "--web"

    if arg == "--test":
        print("[SunSync] Running Automated Test Suite...")
        cmd = [sys.executable, "-m", "unittest", "discover", "tests"]
        subprocess.run(cmd, cwd=base_dir)

    else:
        print("[SunSync] Launching High-Speed Web Engine on http://localhost:8000 ...")
        cmd = [sys.executable, "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
        subprocess.run(cmd, cwd=src_dir)

if __name__ == "__main__":
    main()
