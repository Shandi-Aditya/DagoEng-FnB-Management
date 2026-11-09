#!/usr/bin/env python3
"""
DagoEng F&B Management & Coworking Hub - Local Development Runner
================================================================
A zero-friction, cross-platform runner script to start the local Next.js environment,
verify dependencies, configure .env, generate Prisma clients, and launch the development server.

Usage:
    python3 run.py              # Start dev server on port 3000
    python3 run.py --open       # Start and open browser automatically
    python3 run.py --port 3001  # Run on custom port
    python3 run.py --db-seed    # Seed database before running
    python3 run.py --help       # Show full CLI options
"""

import os
import sys
import shutil
import socket
import argparse
import secrets
import subprocess
import threading
import time
import urllib.request
import urllib.error
import webbrowser
from pathlib import Path

# Base paths
ROOT_DIR = Path(__file__).resolve().parent
ENV_FILE = ROOT_DIR / ".env"
ENV_EXAMPLE = ROOT_DIR / ".env.example"
NODE_MODULES = ROOT_DIR / "node_modules"
PRISMA_CLIENT = NODE_MODULES / "@prisma" / "client"

# ANSI Colors for styled terminal output
class Colors:
    HEADER = "\033[95m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RESET = "\033[0m"

    @classmethod
    def disable(cls):
        cls.HEADER = ""
        cls.BLUE = ""
        cls.CYAN = ""
        cls.GREEN = ""
        cls.YELLOW = ""
        cls.RED = ""
        cls.BOLD = ""
        cls.DIM = ""
        cls.RESET = ""

if not sys.stdout.isatty() or os.getenv("NO_COLOR"):
    Colors.disable()


def log_step(message: str) -> None:
    print(f"{Colors.CYAN}==>{Colors.RESET} {Colors.BOLD}{message}{Colors.RESET}")


def log_success(message: str) -> None:
    print(f" {Colors.GREEN}✔{Colors.RESET} {message}")


def log_warn(message: str) -> None:
    print(f" {Colors.YELLOW}⚠{Colors.RESET} {Colors.YELLOW}{message}{Colors.RESET}")


def log_error(message: str) -> None:
    print(f" {Colors.RED}✖{Colors.RESET} {Colors.RED}{message}{Colors.RESET}")


def print_banner() -> None:
    banner = f"""
{Colors.CYAN}{Colors.BOLD}╔═══════════════════════════════════════════════════════════════════════════════╗
║                 DagoEng F&B Management & Coworking Hub                        ║
║                 Local Development Environment Launcher                        ║
╚═══════════════════════════════════════════════════════════════════════════════╝{Colors.RESET}
"""
    print(banner)


def check_command(cmd: str) -> bool:
    return shutil.which(cmd) is not None


def get_command_version(cmd: list[str]) -> str:
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return res.stdout.strip()
    except Exception:
        return "unknown"


def check_prerequisites() -> None:
    """Verifies that Node.js, npm, and Python are properly installed."""
    log_step("Checking prerequisites...")

    # Python version
    py_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    if sys.version_info < (3, 8):
        log_warn(f"Python version is {py_ver}. Python 3.8+ is recommended.")
    else:
        log_success(f"Python: {Colors.DIM}{py_ver}{Colors.RESET}")

    # Node.js
    if not check_command("node"):
        log_error("Node.js is not installed or not in your PATH.")
        print(f"    Please install Node.js (v18 or higher):")
        print(f"    - macOS: brew install node")
        print(f"    - Linux: https://nodejs.org/en/download/package-manager")
        print(f"    - Windows: https://nodejs.org/en/download/")
        sys.exit(1)
    node_ver = get_command_version(["node", "-v"])
    log_success(f"Node.js: {Colors.DIM}{node_ver}{Colors.RESET}")

    # npm
    if not check_command("npm"):
        log_error("npm is not installed or not in your PATH.")
        sys.exit(1)
    npm_ver = get_command_version(["npm", "-v"])
    log_success(f"npm: {Colors.DIM}v{npm_ver}{Colors.RESET}")


def ensure_env_file() -> dict[str, str]:
    """Ensures that a valid .env file exists. Copies from .env.example if missing."""
    log_step("Checking environment configuration (.env)...")
    env_vars: dict[str, str] = {}

    if not ENV_FILE.exists():
        if ENV_EXAMPLE.exists():
            log_warn(".env not found. Creating a new .env file from .env.example with safe defaults...")
            with open(ENV_EXAMPLE, "r", encoding="utf-8") as f:
                content = f.read()

            # Set sensible dev defaults
            secret = secrets.token_hex(32)
            replacements = {
                'PORT=""': 'PORT="3000"',
                'NODE_ENV=""': 'NODE_ENV="development"',
                'ENABLE_ROLE_SIMULATOR=""': 'ENABLE_ROLE_SIMULATOR="true"',
                'SESSION_SECRET=""': f'SESSION_SECRET="{secret}"',
                'DOKU_SIMULATION_MODE="false"': 'DOKU_SIMULATION_MODE="true"',
            }
            for old, new in replacements.items():
                content = content.replace(old, new)

            with open(ENV_FILE, "w", encoding="utf-8") as f:
                f.write(content)
            log_success("Created .env with development defaults and generated SESSION_SECRET.")
        else:
            log_warn(".env and .env.example not found. Creating minimal .env file...")
            secret = secrets.token_hex(32)
            with open(ENV_FILE, "w", encoding="utf-8") as f:
                f.write(f'PORT="3000"\nNODE_ENV="development"\nENABLE_ROLE_SIMULATOR="true"\nSESSION_SECRET="{secret}"\n')
            log_success("Created minimal .env file.")
    else:
        log_success(".env file detected.")

    # Parse existing .env
    try:
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    val = val.strip().strip('"').strip("'")
                    env_vars[key.strip()] = val
    except Exception as e:
        log_warn(f"Failed to parse .env file: {e}")

    return env_vars


def check_port_open(port: int, host: str = "127.0.0.1") -> bool:
    """Returns True if the port is currently accepting connections (in use)."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


def ensure_dependencies(force: bool = False) -> None:
    """Installs npm dependencies if node_modules is missing or force=True."""
    if force or not NODE_MODULES.exists():
        log_step("Installing project dependencies (npm install)...")
        res = subprocess.run(["npm", "install"], cwd=ROOT_DIR)
        if res.returncode != 0:
            log_error("npm install failed. Please inspect the output above.")
            sys.exit(res.returncode)
        log_success("Dependencies installed successfully.")
    else:
        log_success("Dependencies (node_modules) found.")


def ensure_prisma_client() -> None:
    """Generates Prisma Client if not already built."""
    if not PRISMA_CLIENT.exists():
        log_step("Generating Prisma ORM Client (npx prisma generate)...")
        res = subprocess.run(["npx", "prisma", "generate"], cwd=ROOT_DIR)
        if res.returncode != 0:
            log_error("Prisma client generation failed.")
            sys.exit(res.returncode)
        log_success("Prisma Client generated.")
    else:
        log_success("Prisma Client is ready.")


def run_db_push() -> None:
    """Pushes schema directly to configured database."""
    log_step("Pushing Prisma schema to database (npx prisma db push)...")
    res = subprocess.run(["npx", "prisma", "db", "push"], cwd=ROOT_DIR)
    if res.returncode != 0:
        log_error("Prisma db push failed. Ensure your DATABASE_URL in .env is correct and reachable.")
        sys.exit(res.returncode)
    log_success("Database schema synchronized.")


def run_db_seed() -> None:
    """Seeds the database with initial personas and demo catalog."""
    log_step("Seeding database (npm run db:seed)...")
    res = subprocess.run(["npm", "run", "db:seed"], cwd=ROOT_DIR)
    if res.returncode != 0:
        log_error("Database seeding failed.")
        sys.exit(res.returncode)
    log_success("Database seeded successfully with demo personas and catalog.")


def run_tests() -> None:
    """Runs the Vitest test suite."""
    log_step("Running automated tests (npm test)...")
    res = subprocess.run(["npm", "test"], cwd=ROOT_DIR)
    sys.exit(res.returncode)


def wait_for_server_and_open_browser(url: str, open_browser: bool = False) -> None:
    """Polls the local server until it responds, then prints direct access links."""
    start_time = time.time()
    ready = False
    
    # Wait up to 60 seconds
    while time.time() - start_time < 60:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "DagoEng-Runner/1.0"})
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                if resp.status in (200, 301, 302, 307, 308):
                    ready = True
                    break
        except Exception:
            time.sleep(0.5)

    if ready:
        elapsed = round(time.time() - start_time, 1)
        print("\n" + f"{Colors.GREEN}{Colors.BOLD}✨ DagoEng Management is ONLINE (ready in {elapsed}s)!{Colors.RESET}")
        print(f"{Colors.BOLD}┌─────────────────────────────────────────────────────────────────────────────┐{Colors.RESET}")
        print(f"{Colors.BOLD}│ Direct Navigation Shortcuts:                                                │{Colors.RESET}")
        print(f"{Colors.BOLD}├─────────────────────────────────────────────────────────────────────────────┤{Colors.RESET}")
        print(f"│ 🌐 Landing Page:          {Colors.CYAN}{url}/{Colors.RESET}")
        print(f"│ 🔐 Persona Quick Login:   {Colors.CYAN}{url}/login{Colors.RESET}")
        print(f"│ 📊 Executive Dashboard:   {Colors.CYAN}{url}/dashboard{Colors.RESET}")
        print(f"│ ☕ POS Kasir & Bills:     {Colors.CYAN}{url}/pos{Colors.RESET}")
        print(f"│ 🍳 Kitchen Display (KDS): {Colors.CYAN}{url}/kitchen{Colors.RESET}")
        print(f"│ 💻 Coworking Hub Space:   {Colors.CYAN}{url}/coworking{Colors.RESET}")
        print(f"│ 🎪 Events Marketplace:    {Colors.CYAN}{url}/events{Colors.RESET}")
        print(f"│ 📱 Mobile Guest Portal:   {Colors.CYAN}{url}/customer{Colors.RESET}")
        print(f"│ 📱 Mobile Waiter Portal:  {Colors.CYAN}{url}/waiter{Colors.RESET}")
        print(f"{Colors.BOLD}└─────────────────────────────────────────────────────────────────────────────┘{Colors.RESET}")
        print(f"{Colors.DIM}Press Ctrl+C at any time to shut down the server.{Colors.RESET}\n")

        if open_browser:
            try:
                webbrowser.open(url)
            except Exception:
                pass


def main() -> None:
    parser = argparse.ArgumentParser(
        description="DagoEng F&B Management & Coworking Hub - Local Development Runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 run.py                 # Start dev server on http://localhost:3000
  python3 run.py --open          # Start dev server and launch default browser
  python3 run.py -p 3005         # Start on port 3005
  python3 run.py --db-push       # Sync Prisma models with DB before running
  python3 run.py --db-seed       # Seed mock personas & products into DB
  python3 run.py --test          # Run full test suite
  python3 run.py --check         # Check dependencies & environment without starting
        """
    )
    parser.add_argument("-p", "--port", type=int, help="Port to run the server on (default: from .env or 3000)")
    parser.add_argument("-H", "--host", type=str, default="localhost", help="Host address to bind (default: localhost)")
    parser.add_argument("-o", "--open", action="store_true", help="Automatically open web browser when server starts")
    parser.add_argument("--prod", action="store_true", help="Build and start in production mode instead of dev")
    parser.add_argument("--install", action="store_true", help="Force run npm install before starting")
    parser.add_argument("--db-push", action="store_true", help="Run npx prisma db push before starting")
    parser.add_argument("--db-seed", action="store_true", help="Run npm run db:seed before starting")
    parser.add_argument("--test", action="store_true", help="Run the test suite and exit")
    parser.add_argument("--check", action="store_true", help="Run environment checks only and exit")

    args = parser.parse_args()

    print_banner()

    # Step 1: Pre-flight checks
    check_prerequisites()

    # Step 2: Environment setup
    env_vars = ensure_env_file()

    # Determine port
    port = args.port or int(env_vars.get("PORT", "3000"))
    host = args.host

    # Step 3: Dependencies
    ensure_dependencies(force=args.install)

    # Step 4: Prisma Client
    ensure_prisma_client()

    # Handle --test flag
    if args.test:
        run_tests()
        return

    # Handle database operations if requested
    if args.db_push:
        run_db_push()

    if args.db_seed:
        run_db_seed()

    # Handle --check flag
    if args.check:
        log_success("All environment checks passed! Project is ready to run.")
        print(f"\nRun {Colors.BOLD}python3 run.py{Colors.RESET} to start the server.")
        return

    # Check port collision
    if check_port_open(port, host if host != "0.0.0.0" else "127.0.0.1"):
        log_warn(f"Port {port} appears to be in use already.")
        print(f"    You can specify a different port with: {Colors.CYAN}python3 run.py --port {port + 1}{Colors.RESET}")
        try:
            choice = input(f"    Continue anyway? [y/N]: ").strip().lower()
            if choice not in ("y", "yes"):
                print("Aborting.")
                sys.exit(0)
        except (KeyboardInterrupt, EOFError):
            print("\nAborting.")
            sys.exit(0)

    # Prepare server command
    app_url = f"http://{host}:{port}"
    env = os.environ.copy()
    env["PORT"] = str(port)

    # Launch background thread to announce links and optionally open browser
    listener_thread = threading.Thread(
        target=wait_for_server_and_open_browser,
        args=(app_url, args.open),
        daemon=True
    )
    listener_thread.start()

    if args.prod:
        log_step(f"Building application for production...")
        build_res = subprocess.run(["npm", "run", "build"], cwd=ROOT_DIR, env=env)
        if build_res.returncode != 0:
            log_error("Production build failed.")
            sys.exit(build_res.returncode)
        log_step(f"Starting Next.js in production mode on {app_url}...")
        server_cmd = ["npx", "next", "start", "-p", str(port), "-H", host]
    else:
        log_step(f"Starting Next.js development server on {app_url}...")
        server_cmd = ["npx", "next", "dev", "-p", str(port), "-H", host]

    try:
        proc = subprocess.Popen(server_cmd, cwd=ROOT_DIR, env=env)
        proc.wait()
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Shutting down server gracefully...{Colors.RESET}")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        print(f"{Colors.GREEN}✔ Server stopped cleanly. Have a great day! 👋{Colors.RESET}")
    except Exception as e:
        log_error(f"Server encountered an error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
