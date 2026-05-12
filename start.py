import subprocess
import os
import sys

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    server_dir = os.path.join(root_dir, 'server')
    web_dir = os.path.join(root_dir, 'web')

    # Determine python executable (prefer venv)
    venv_python = os.path.join(root_dir, 'venv', 'Scripts', 'python.exe') if os.name == 'nt' else os.path.join(root_dir, 'venv', 'bin', 'python')
    python_cmd = venv_python if os.path.exists(venv_python) else sys.executable

    # Start FastAPI server
    print("Starting FastAPI Server...")
    server_process = subprocess.Popen(
        [python_cmd, "-m", "uvicorn", "main:app", "--port", "8111"],
        cwd=server_dir
    )

    # Start React Web Client
    print("Starting React Web Client...")
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    
    # Auto-install npm dependencies if missing
    if not os.path.exists(os.path.join(web_dir, "node_modules")):
        print("node_modules not found. Running 'npm install'...")
        subprocess.run([npm_cmd, "install"], cwd=web_dir)

    web_process = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=web_dir
    )

    try:
        server_process.wait()
        web_process.wait()
    except KeyboardInterrupt:
        print("\nShutting down servers...")
        server_process.terminate()
        web_process.terminate()
        server_process.wait()
        web_process.wait()
        print("Shutdown complete.")

if __name__ == "__main__":
    main()
