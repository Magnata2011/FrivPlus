import os

def s(path):
    size = os.path.getsize(path)
    if size <= 19 * 1024 * 1024:
        return

    with open(path, "rb") as f:
        i = 1
        while True:
            chunk = f.read(19 * 1024 * 1024)
            if not chunk:
                break

            with open(f"{path}.{i:03d}", "wb") as p:
                p.write(chunk)

            i += 1

base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Build")

if os.path.exists(base):
    for f in os.listdir(base):
        if f.endswith((".data", ".wasm")):
            s(os.path.join(base, f))