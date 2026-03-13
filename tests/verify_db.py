import urllib.request
import json
import sys
import socket

def check_db():
    try:
        # Check socket connection to zulu-pocketbase
        # gracefully fallback to localhost mapped ports
        host = 'zulu-pocketbase'
        port = 8090
        try:
            socket.gethostbyname(host)
            url = f"http://{host}:{port}/api/collections/kanban_tasks/records"
        except socket.gaierror:
            # We must be running locally where docker isn't running or the domain isn't resolved
            # PocketBase container port 8090 is mapped to 8092 locally, but might just run directly on 8090
            host = '127.0.0.1'
            port = 8090
            url = f"http://{host}:{port}/api/collections/kanban_tasks/records"
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as response:
                    pass
            except Exception:
                # fallback to docker port
                port = 8092
                url = f"http://{host}:{port}/api/collections/kanban_tasks/records"

        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            print("Successfully connected to PocketBase.")
            print(f"Total Kanban Tasks: {data.get('totalItems', 0)}")
            sys.exit(0)
    except Exception as e:
        print(f"Failed to connect to PocketBase: {e}")
        sys.exit(1)

if __name__ == "__main__":
    check_db()
