"""
run_local.py - SunSync Local Runner & Developer Launcher

Single-command developer utility to launch the Streamlit dashboard,
FastAPI REST server, or run the automated test suite.

Usage:
    python run_local.py          # Launches Streamlit Web Dashboard (Default)
    python run_local.py --api    # Launches FastAPI REST Backend
    python run_local.py --test   # Executes Automated Test Suite
"""

import sys
import os
import subprocess

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    src_dir = os.path.join(base_dir, "src")
    os.environ["PYTHONPATH"] = src_dir

    arg = sys.argv[1] if len(sys.argv) > 1 else "--dashboard"

    if arg == "--test":
        print("[SunSync] Running Automated Test Suite...")
        cmd = [sys.executable, "-m", "unittest", "discover", "tests"]
        subprocess.run(cmd, cwd=base_dir)

    elif arg == "--api":
        print("[SunSync] Starting FastAPI Backend on http://localhost:8000 ...")
        cmd = [sys.executable, "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
        subprocess.run(cmd, cwd=src_dir)

    else:
        print("[SunSync] Launching Streamlit Dashboard on http://localhost:8501 ...")
        dashboard_path = os.path.join(src_dir, "dashboard.py")
        cmd = [sys.executable, "-m", "streamlit", "run", dashboard_path]
        subprocess.run(cmd, cwd=src_dir)

if __name__ == "__main__":
    main()
