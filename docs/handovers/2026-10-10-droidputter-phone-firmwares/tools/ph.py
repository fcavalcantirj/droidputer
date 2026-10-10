#!/usr/bin/env python3
"""Drive the Droidputter app on Felipe's phone over wireless ADB (throwaway test driver).
  ph.py dump                     -> labeled nodes (text|desc, bounds)
  ph.py tap <label> [nth]        -> tap the centre of the nth node whose text/desc equals <label> (case-insensitive)
  ph.py tapsub <substring>       -> tap the first node whose text/desc contains <substring>
  ph.py keys <k1> <k2> ...       -> tap on-screen ESP keyboard keys by label
  ph.py shot <name>              -> screenshot to <dir>/<name>.png (+ a 900 px copy)
  ph.py wait <substring> [secs]  -> poll the UI until a node contains <substring>; prints it
  ph.py texts                    -> every text on screen, one per line
"""
import os, re, subprocess, sys, time, xml.etree.ElementTree as ET

DEV = "192.168.0.169:36483"
DIR = os.path.dirname(os.path.abspath(__file__))
ENV = dict(os.environ, ADB_MDNS_OPENSCREEN="0")


def adb(*args, timeout=40, binary=False):
    r = subprocess.run(["adb", "-s", DEV, *args], capture_output=True, timeout=timeout, env=ENV)
    return r.stdout if binary else r.stdout.decode(errors="replace")


def nodes():
    adb("shell", "uiautomator", "dump", "/sdcard/dp-ui.xml", timeout=40)
    xml = adb("shell", "cat", "/sdcard/dp-ui.xml")
    out = []
    try:
        root = ET.fromstring(xml[xml.index("<"):])
    except Exception:
        return out
    for n in root.iter("node"):
        label = (n.get("text") or n.get("content-desc") or "").strip()
        m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", n.get("bounds") or "")
        if label and m:
            x1, y1, x2, y2 = map(int, m.groups())
            out.append((label, (x1 + x2) // 2, (y1 + y2) // 2))
    return out


def tap_xy(x, y):
    adb("shell", "input", "tap", str(x), str(y))


def main():
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == "dump":
        for n in nodes(): print(n)
    elif cmd == "texts":
        for n in nodes(): print(n[0])
    elif cmd in ("tap", "tapsub"):
        want = args[0].lower(); nth = int(args[1]) if len(args) > 1 else 0
        hits = [n for n in nodes() if (n[0].lower() == want if cmd == "tap" else want in n[0].lower())]
        if len(hits) <= nth:
            print(f"NOT FOUND: {args[0]}"); sys.exit(1)
        label, x, y = hits[nth]; tap_xy(x, y); print(f"tapped {label!r} at {x},{y}")
    elif cmd == "keys":
        ns = nodes(); pos = {}
        for label, x, y in ns:
            pos.setdefault(label.lower(), (x, y))
        for k in args:
            if k.lower() not in pos:
                print(f"NO KEY {k}"); sys.exit(1)
            tap_xy(*pos[k.lower()]); time.sleep(0.25)
        print(f"typed {len(args)} keys")
    elif cmd == "shot":
        png = adb("exec-out", "screencap", "-p", binary=True, timeout=60)
        path = os.path.join(DIR, args[0] + ".png")
        open(path, "wb").write(png)
        subprocess.run(["sips", "-Z", "900", path, "--out", os.path.join(DIR, args[0] + "-small.png")], capture_output=True)
        print(path, len(png))
    elif cmd == "wait":
        want = args[0].lower(); secs = float(args[1]) if len(args) > 1 else 120
        t0 = time.time()
        while time.time() - t0 < secs:
            for label, *_ in nodes():
                if want in label.lower():
                    print(f"FOUND after {time.time() - t0:.0f}s: {label}"); return
            time.sleep(2)
        print(f"TIMEOUT {secs:.0f}s waiting for {args[0]}"); sys.exit(1)


if __name__ == "__main__":
    main()
