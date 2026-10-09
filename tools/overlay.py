#!/usr/bin/env python3
"""Overlay generator: turn an open-source Cardputer app repo into a droidputter build overlay.

    python3 tools/overlay.py <github-url | owner/repo> [--name NAME] [--ref REF] [--env-src ENV] [--env ENV] [--build] [--upload]

Clones the repo (shallow; --ref = branch, tag or full commit sha) into apps/_src/<name>/ (git-ignored),
reads its platformio.ini (or finds its .ino), and writes apps/<name>/platformio.ini on the
apps/pense-bem pattern: the app's own sources UNCHANGED via [platformio] src_dir, its own lib_deps kept
except the display/keyboard libraries, which the shim provides patched (M5GFX 0.2.27 + M5Cardputer 1.1.1
in apps/<name>/lib via shim/apply.sh, M5Unified pinned to the version the shim is tested with) plus
DroidputterShim. Every path in the generated ini is anchored on PlatformIO's ${PROJECT_DIR} (the overlay
dir), so the same ini builds on any checkout -- a Mac or a GitHub runner -- without regeneration.
Prints one JSON line per app so a batch run can be tabulated. --build runs `pio run -e <env>` (--env,
default m5cardputer = Cardputer ADV with the real TFT teed; m5cardputer-virtual = bare ESP32-S3, the phone
is the only screen) and reports RAM/flash or the first compiler errors; --upload flashes the board on
/dev/cu.usbmodem*.
"""
import argparse
import configparser
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_ROOT = REPO_ROOT / "apps" / "_src"
APPS = REPO_ROOT / "apps"
PIO = Path.home() / ".platformio" / "penv" / "bin" / "pio"   # the PlatformIO installer's venv (Mac)
if not PIO.exists():   # pip-installed PlatformIO (CI runner): plain `pio` on PATH
    PIO = Path(shutil.which("pio") or "pio")
SHIM_LIBS = re.compile(r"M5GFX|M5Cardputer|M5Unified", re.I)
STD_FLAG = re.compile(r"^-std=")
M5UNIFIED = "m5stack/M5Unified@0.2.20"   # the version the patched M5GFX 0.2.27 is tested with

# Arduino-IDE repos carry no dependency list: map the headers they #include to PlatformIO registry
# packages. Framework/shim headers map to None (nothing to add); unknown headers are reported.
INCLUDE_TO_DEP = {
    "ArduinoJson.h": "bblanchon/ArduinoJson@^7",
    "Audio.h": "esphome/ESP32-audioI2S@^2.0.7",
    "AudioOutputI2S.h": "earlephilhower/ESP8266Audio@^1.9.7", "AudioGeneratorMP3.h": "earlephilhower/ESP8266Audio@^1.9.7",
    "AudioFileSourceSD.h": "earlephilhower/ESP8266Audio@^1.9.7", "AudioFileSourceHTTPStream.h": "earlephilhower/ESP8266Audio@^1.9.7",
    # Arduino-IDE Cardputer repos are 2023-2024 code against the NimBLE 1.x API (BleKeyboard forks etc.)
    "NimBLEDevice.h": "h2zero/NimBLE-Arduino@^1.4.3",
    "TinyGPS++.h": "mikalhart/TinyGPSPlus@^1.1.0", "TinyGPSPlus.h": "mikalhart/TinyGPSPlus@^1.1.0",
    "FastLED.h": "fastled/FastLED@^3.9",
    "IRremoteESP8266.h": "crankyoldgit/IRremoteESP8266@^2.8.6", "IRsend.h": "crankyoldgit/IRremoteESP8266@^2.8.6", "IRrecv.h": "crankyoldgit/IRremoteESP8266@^2.8.6",
    "IRremote.h": "z3t0/IRremote@^4.4", "IRremote.hpp": "z3t0/IRremote@^4.4",
    "PubSubClient.h": "knolleary/PubSubClient@^2.8",
    "Adafruit_NeoPixel.h": "adafruit/Adafruit NeoPixel@^1.12",
    "Adafruit_GFX.h": "adafruit/Adafruit GFX Library@^1.11", "Adafruit_SSD1306.h": "adafruit/Adafruit SSD1306@^2.5",
    "ESPAsyncWebServer.h": "ottowinter/ESPAsyncWebServer-esphome@^3.3", "AsyncTCP.h": "esphome/AsyncTCP-esphome@^2.1",
    "U8g2lib.h": "olikraus/U8g2@^2.35", "lvgl.h": "lvgl/lvgl@^8.4",
    "SdFat.h": "greiman/SdFat@^2.2", "ESP32Servo.h": "madhephaestus/ESP32Servo@^3",
    "JPEGDEC.h": "bitbank2/JPEGDEC@^1.8", "ESP32Time.h": "fbiego/ESP32Time@^2.0", "PNGdec.h": "bitbank2/PNGdec@^1.1",
    "AnimatedGIF.h": "bitbank2/AnimatedGIF@^2.1", "TJpg_Decoder.h": "bodmer/TJpg_Decoder@^1.1", "ESPAsyncTCP.h": "esphome/AsyncTCP-esphome@^2.1",
    "RadioLib.h": "jgromes/RadioLib@^7", "LoRa.h": "sandeepmistry/LoRa@^0.8",
    "MFRC522.h": "miguelbalboa/MFRC522@^1.4", "DHT.h": "adafruit/DHT sensor library@^1.4",
    "OneWire.h": "paulstoffregen/OneWire@^2.3", "DallasTemperature.h": "milesburton/DallasTemperature@^4",
    "LinkedList.h": "ivanseidel/LinkedList@^1.3", "JPEGDecoder.h": "bodmer/JPEGDecoder@^2.0",
    # M5Stack's TinyGPSPlus fork (2025-01-02 master): its MultipleSatellite wrapper sends the Cap LoRa GNSS init
    # handshake (FlockCameraDetector); it replaces mikalhart's TinyGPSPlus, never sits beside it.
    "MultipleSatellite.h": "https://github.com/m5stack/TinyGPSPlus.git#254a10041ac38d17d98dab24c0ae4d2a8d19a677",
    "ArduinoOTA.h": None, "WiFi.h": None, "WiFiClient.h": None, "WiFiClientSecure.h": None, "WiFiUdp.h": None, "WiFiMulti.h": None,
    "HTTPClient.h": None, "WebServer.h": None, "ESPmDNS.h": None, "DNSServer.h": None, "Update.h": None, "HTTPUpdate.h": None,
    "Preferences.h": None, "SPIFFS.h": None, "LittleFS.h": None, "FS.h": None, "SD.h": None, "SD_MMC.h": None, "FFat.h": None,
    "Wire.h": None, "SPI.h": None, "EEPROM.h": None, "Ticker.h": None, "esp_now.h": None, "esp_wifi.h": None, "esp_sleep.h": None,
    "BLEDevice.h": None, "BLEServer.h": None, "BLEUtils.h": None, "BLE2902.h": None, "BLEScan.h": None, "BLEAdvertisedDevice.h": None,
    "USB.h": None, "USBHIDKeyboard.h": None, "USBHIDMouse.h": None, "driver/i2s.h": None, "driver/rmt.h": None, "esp_system.h": None,
    "Arduino.h": None, "pgmspace.h": None, "avr/pgmspace.h": None, "M5Cardputer.h": None, "M5Unified.h": None, "M5GFX.h": None, "M5Unified.hpp": None, "M5GFX.hpp": None,
    "M5UnitLCD.h": None, "M5UnitOLED.h": None, "M5AtomDisplay.h": None, "M5ModuleDisplay.h": None, "M5Stack.h": None,
}
LOCAL_HEADER_EXTS = (".h", ".hpp", ".hh")
# Folders that hold OTHER people's sketches: a vendored library's examples/ (M5Apps shipped LovyanGFX and the .ino
# search picked LovyanGFX's own example, 2026-10-08), ESP-IDF components, build output.
VENDORED_DIRS = {"components", "managed_components", "lib", "libraries", "examples", ".pio", "test", "tests"}
# The shim intercepts M5GFX (and so M5Unified/M5Cardputer). An app that draws through TFT_eSPI or Arduino_GFX
# never reaches it: no mirror until the TFT_eSPI shim (M4). Bruce = TFT_eSPI, M5Stick-Launcher = Arduino_GFX.
SHIM_GFX_HEADERS = {"M5GFX.h", "M5GFX.hpp", "M5Unified.h", "M5Unified.hpp", "M5Cardputer.h"}
OTHER_GFX_HEADERS = {"TFT_eSPI.h": "TFT_eSPI", "Arduino_GFX_Library.h": "Arduino_GFX"}
OTHER_GFX_INI = {"USER_SETUP_LOADED": "TFT_eSPI", "TFT_eSPI": "TFT_eSPI", "TFT_DATABUS_N": "Arduino_GFX", "GFX Library for Arduino": "Arduino_GFX"}
PREBUILT_HINT = "flash its prebuilt from the LauncherHub tab instead (no phone mirror)"


def fail(cls: str, reason: str):
    """Stop with a classified reason as the JSON line the CI and the proxy read (build-app.yml -> failure.json)."""
    print(json.dumps({"ok": False, "failed": cls, "reason": reason}))
    sys.exit(2)


def outside_vendored(p: Path, root: Path) -> bool:
    return not VENDORED_DIRS & set(p.relative_to(root).parts[:-1])


def includes_in(root: Path) -> set[str]:
    """Header basenames #included anywhere under root, vendored folders excluded."""
    found = set()
    for f in root.rglob("*"):
        if f.suffix not in (".ino", ".cpp", ".c", ".h", ".hpp") or not f.is_file() or not outside_vendored(f, root):
            continue
        try:
            text = f.read_text(errors="replace")
        except OSError:
            continue
        found.update(Path(m.group(1)).name for m in re.finditer(r'^\s*#\s*include\s*[<"]([^>"]+)[>"]', text, re.M))
    return found


def foreign_graphics(src: Path, env_text: str) -> str | None:
    """'TFT_eSPI' / 'Arduino_GFX' when the app draws through a display library the shim cannot see, else None.
    The chosen env's own config decides first: multi-board firmwares include M5Unified for their M5 boards but
    drive the Cardputer through TFT_eSPI (Bruce: USER_SETUP_LOADED) or Arduino_GFX (Launcher: TFT_DATABUS_N).
    Every TFT_eSPI build that "succeeded" through the proxy got an auto-verdict broken (hello=false), both envs."""
    for key, lib in OTHER_GFX_INI.items():
        if key in env_text:
            return lib
    inc = includes_in(src)
    if inc & SHIM_GFX_HEADERS:
        return None
    for hdr, lib in OTHER_GFX_HEADERS.items():
        if hdr in inc:
            return lib
    return None


def infer_ino_deps(sketch_dir: Path, repo: Path) -> tuple[list[str], list[str]]:
    """Registry deps for the headers an Arduino-IDE sketch includes; also the headers we cannot place."""
    local = {p.name for p in repo.rglob("*") if p.suffix in LOCAL_HEADER_EXTS}
    deps, unknown, seen = [], [], set()
    for f in list(sketch_dir.rglob("*.ino")) + list(sketch_dir.rglob("*.cpp")) + list(sketch_dir.rglob("*.h")) + list(sketch_dir.rglob("*.hpp")):
        try:
            text = f.read_text(errors="replace")
        except OSError:
            continue
        for m in re.finditer(r'^\s*#\s*include\s*[<"]([^>"]+)[>"]', text, re.M):
            hdr = m.group(1)
            if hdr in seen:
                continue
            seen.add(hdr)
            if hdr in INCLUDE_TO_DEP:
                dep = INCLUDE_TO_DEP[hdr]
                if dep and dep not in deps:
                    deps.append(dep)
            elif Path(hdr).name in local or hdr.startswith(("freertos/", "esp_", "driver/", "soc/", "hal/", "rom/", "nvs", "sys/", "lwip/", "mbedtls/")) or "/" not in hdr and not hdr.endswith((".h", ".hpp")):
                continue
            elif hdr.endswith((".h", ".hpp")) and not hdr.startswith(("std", "c")) and hdr not in ("string.h", "stdio.h", "stdlib.h", "stdint.h", "math.h", "time.h", "ctype.h", "vector", "map", "string"):
                unknown.append(hdr)
    if INCLUDE_TO_DEP["MultipleSatellite.h"] in deps:   # the fork ships TinyGPS++.h too
        deps = [d for d in deps if not d.startswith("mikalhart/TinyGPSPlus")]
    return deps, unknown

ENV_TEMPLATE = """; DROIDPUTTER overlay generated by tools/overlay.py -- builds {slug} UNCHANGED from
; apps/_src/{name} against the patched libs in lib/ (shim/apply.sh) + DroidputterShim.
; Upstream env used for lib_deps/build_flags: [{env_src}]. Regenerate with:
;   python3 tools/overlay.py {slug} --name {name}
[platformio]
src_dir = {src_dir}

[env:m5cardputer]
platform = espressif32@6.12.0
board = m5stack-stamps3
framework = arduino
board_build.mcu = esp32s3
board_build.f_cpu = 240000000L
board_build.f_flash = 80000000L
board_build.flash_mode = qio
board_build.flash_size = 8MB
board_build.psram = false
{extra_board}{src_filter}lib_deps =
{lib_deps}
lib_ldf_mode = {ldf_mode}
{lib_extra_dirs}build_unflags = -std=gnu++11
build_flags =
{build_flags}
monitor_speed = 115200
upload_speed = 460800

; Same app, TFT dark, the phone is the only screen (Panel_Droidputter, dp_panel.h) -- the bare-ESP32-S3 target.
; A bare S3 module is usually an R8 (octal PSRAM: the S3-PICO-1 in the StickS3, the WROOM-1-N16R8 devkit); the
; ESP-IDF startup probes PSRAM with the core's memory type BEFORE any console exists, and a QSPI-typed firmware
; on an octal module hangs right there (2026-09-05: StickS3 #2 showed the ROM banner, then silence). qio_opi +
; PSRAM on is the env proven on the StickS3 on 2026-09-03; a module without PSRAM logs "not found" and runs on.
; Proven on a StickS3 2026-09-16 (progress.txt): the generic esp32-s3-devkitc-1 variant and the M5GFX board hint
; 26 (board_M5StickS3, what the 2026-09-03 StickS3 env used) instead of the recipe's own hint (24 = Cardputer ADV);
; with the StampS3 variant + hint 24 the same app booted to the ROM banner and hung before any console.
[env:m5cardputer-virtual]
extends = env:m5cardputer
board = esp32-s3-devkitc-1
board_build.psram = true
board_build.arduino.memory_type = qio_opi
; The devkitc-1 variant has no M5 G<n> pin names; dp_m5pins.h restores the StampS3 variant's set (miniacid: 'G2').
build_flags = ${{env:m5cardputer.build_flags}} -DDROIDPUTTER_VIRTUAL=1 -UM5GFX_BOARD -DM5GFX_BOARD=26
    -include ${{PROJECT_DIR}}/../../shim/lib/DroidputterShim/src/dp_m5pins.h
"""


def slug_of(url: str) -> str:
    m = re.search(r"github\.com[/:]([\w.-]+)/([\w.-]+?)(?:\.git)?/?$", url) or re.match(r"^([\w.-]+)/([\w.-]+)$", url)
    if not m:
        sys.exit(f"not a github url or owner/repo: {url}")
    return f"{m.group(1)}/{m.group(2)}"


def clone(slug: str, name: str, ref: str | None) -> Path:
    dst = SRC_ROOT / name
    if dst.exists():
        return dst
    SRC_ROOT.mkdir(parents=True, exist_ok=True)
    url = f"https://github.com/{slug}.git"
    if ref and re.fullmatch(r"[0-9a-f]{40}", ref):   # a commit: `git clone --branch` takes only branches/tags
        dst.mkdir()
        for cmd in (["git", "init", "-q"], ["git", "remote", "add", "origin", url],
                    ["git", "fetch", "-q", "--depth", "1", "origin", ref], ["git", "checkout", "-q", "FETCH_HEAD"]):
            subprocess.run(cmd, cwd=dst, check=True)
    else:
        cmd = ["git", "clone", "-q", "--depth", "1"] + (["--branch", ref] if ref else []) + [url, str(dst)]
        if subprocess.run(cmd).returncode != 0:
            fail("clone-failed", f"git clone {slug} failed (private, renamed or missing repo/ref)")
    if (dst / ".gitmodules").exists():   # best effort: a private submodule must not sink a public build
        subprocess.run(["git", "submodule", "update", "-q", "--init", "--recursive", "--depth", "1"], cwd=dst)
    return dst


def upstream_commit(src: Path) -> str:
    r = subprocess.run(["git", "rev-parse", "HEAD"], cwd=src, capture_output=True, text=True)
    return r.stdout.strip() or "unknown"


def read_ini(path: Path) -> configparser.ConfigParser | None:
    if not path.exists():
        return None
    cp = configparser.ConfigParser(allow_no_value=True, strict=False, interpolation=None, delimiters=("=",))
    cp.optionxform = str
    cp.read(path)
    for pat in multiline(cp.get("platformio", "extra_configs", fallback="")):
        cp.read(sorted(str(p) for p in path.parent.glob(pat)))
    return cp


def pio_get(cp: configparser.ConfigParser, section: str, option: str, depth: int = 0) -> str | None:
    """An option as PlatformIO reads it: the section's own value, else its `extends` chain, else [env] (for env:*),
    with ${section.option} / ${this.option} / ${sysenv.X} references expanded. Copying the raw text broke
    MeshCore (2026-10-09): `${m5stack_cardputer_cap_lora868_base.build_flags}` landed in an ini without that
    section -> InvalidProjectConfError. Unresolvable references expand to nothing."""
    if depth > 10:
        return None
    raw = cp.get(section, option, fallback=None) if cp.has_section(section) else None
    if raw is None and cp.has_section(section):
        for parent in (s.strip() for s in cp.get(section, "extends", fallback="").split(",") if s.strip()):
            raw = pio_get(cp, parent if cp.has_section(parent) else f"env:{parent}", option, depth + 1)
            if raw is not None:
                break
    if raw is None and section.startswith("env:") and cp.has_section("env"):
        raw = pio_get(cp, "env", option, depth + 1)
    if raw is None:
        return None

    def expand(m: re.Match) -> str:
        sect, opt = m.group(1), m.group(2)
        if sect == "sysenv":
            return os.environ.get(opt, "")
        return pio_get(cp, section if sect == "this" else sect, opt, depth + 1) or ""
    return re.sub(r"\$\{([\w:.-]+?)\.([\w.-]+)\}", expand, raw)


def pick_env(cp: configparser.ConfigParser, wanted: str | None) -> str | None:
    envs = [s for s in cp.sections() if s.startswith("env:")]
    if wanted:
        return f"env:{wanted}" if f"env:{wanted}" in cp else None
    for e in envs:  # prefer an env that already targets the Cardputer's StampS3
        b = cp.get(e, "board", fallback="")
        if "stamps3" in b or "cardputer" in e.lower():
            return e
    return envs[0] if envs else None


def multiline(v: str) -> list[str]:
    return [ln.strip() for ln in v.strip().splitlines() if ln.strip() and not ln.strip().startswith(";")]


def anchored(path: Path, app: Path) -> str:
    """A path under apps/_src as PlatformIO sees it from the overlay dir: ${PROJECT_DIR}/../_src/<name>/...
    (${PROJECT_DIR} is a PlatformIO built-in = the project dir), so the ini carries no machine-specific path."""
    return "${PROJECT_DIR}/" + os.path.relpath(path, app)


def anchor_flag(flag: str, src: Path, app: Path) -> str:
    """-I include / -I src style include paths in upstream flags are relative to ITS project dir."""
    m = re.match(r"^(-I|-include|-imacros)\s*(\S+)$", flag)
    if m and not m.group(2).startswith("/"):
        return f"{m.group(1)} {anchored(src / m.group(2), app)}"
    return flag


def library_example(src: Path, name: str) -> Path | None:
    """The sketch to build from a LIBRARY repo (m5stack/M5Cardputer): the example a committed overlay of the same
    name already uses (m5-example = examples/Basic/keyboard/inputText), else the first Basic example, else the
    first one. Was rglob order: the runner's filesystem picked Basic/buzzer (built) one day and
    Advanced/SSHClient (libssh_esp32.h missing, 12 failed builds) the next."""
    exs = sorted(src.glob("examples/**/*.ino"))
    if not exs:
        return None
    ov = APPS / name / "platformio.ini"
    m = re.search(r"^src_dir\s*=\s*\S*?examples/(\S+)", ov.read_text(), re.M) if ov.exists() else None
    if m:
        hit = [e for e in exs if e.parent == src / "examples" / m.group(1)]
        if hit:
            return hit[0]
    return ([e for e in exs if "/Basic/" in e.as_posix()] or exs)[0]


def committed_sketch(src: Path, name: str) -> Path | None:
    """The sketch a committed overlay of the same name already builds (apps/cardputer = VolosR's SpaceWars/), so a
    proxy rebuild of a catalog recipe builds what the recipe means, not the alphabetically first sketch."""
    ov = APPS / name / "platformio.ini"
    m = re.search(rf"^src_dir\s*=\s*\S*?_src/{re.escape(name)}/(\S+)", ov.read_text(), re.M) if ov.exists() else None
    if not m:
        return None
    hit = sorted((src / m.group(1)).glob("*.ino")) if (src / m.group(1)).is_dir() else []
    return hit[0] if hit else None


def preflight(slug: str, name: str, src: Path, env_src: str | None):
    """Decide BEFORE PlatformIO runs whether the repo can be a shim build at all, and fail() with a class when
    not -- 75 of the 174 failed proxy builds (2026-09-04..10-08) were repos that could never build, retried
    blind. Returns (ini, env name) for a PlatformIO repo, (None, sketch path) for an Arduino-IDE one."""
    cp = read_ini(src / "platformio.ini")
    if cp:
        env = pick_env(cp, env_src)
        if not env:
            fail("no-cardputer-env", f"{slug}: its platformio.ini has no [env:*] to build")
        keys = set(cp.options(env)) | {"build_flags", "lib_deps"}
        lib = foreign_graphics(src, "\n".join(f"{k}={pio_get(cp, env, k) or ''}" for k in sorted(keys)))
        if lib:
            fail("unsupported-graphics", f"{slug} draws with {lib}, which the shim cannot mirror yet; {PREBUILT_HINT}")
        return cp, env
    if (src / "library.properties").exists() or (src / "library.json").exists():
        example = library_example(src, name)
        if not example:
            fail("library-repo", f"{slug} is a library with no example sketch to build")
        return None, example
    # The Cardputer sketch first: Evil-M5Core2 keeps eight firmwares side by side (AtomS3, Core3, Dial, ...,
    # Evil-Cardputer-v1-5-6.ino) and the shallowest-first pick built the AtomS3 one (M5Dial.h missing).
    inos = sorted((p for p in src.rglob("*.ino") if outside_vendored(p, src)),
                  key=lambda p: ("cardputer" not in p.relative_to(src).as_posix().lower(), len(p.parts), p.as_posix()))
    pinned = committed_sketch(src, name)
    if pinned:
        inos = [pinned] + [i for i in inos if i != pinned]
    if not inos:
        fail("not-arduino", f"{slug} has neither a platformio.ini nor an Arduino sketch (ESP-IDF or MicroPython?); {PREBUILT_HINT}")
    lib = foreign_graphics(src, "")
    if lib:
        fail("unsupported-graphics", f"{slug} draws with {lib}, which the shim cannot mirror yet; {PREBUILT_HINT}")
    return None, inos[0]


def generate(slug: str, name: str, env_src: str | None, ref: str | None) -> dict:
    src = clone(slug, name, ref)
    app = APPS / name
    cp, target = preflight(slug, name, src, env_src)
    info = {"name": name, "repo": slug, "src": str(src), "upstream_commit": upstream_commit(src)}
    lib_deps, flags, extra_board, src_dir, extra_lib_dirs, src_filter, ldf_mode = [], [], [], None, [], "", "deep+"
    if cp:
        env = target
        info["env_src"] = env
        src_dir = cp.get("platformio", "src_dir", fallback="src")
        for dep in multiline(pio_get(cp, env, "lib_deps") or ""):
            if not SHIM_LIBS.search(dep):
                lib_deps.append(dep)
        for f in multiline(pio_get(cp, env, "build_flags") or ""):
            f = re.sub(r"\s*;.*$", "", f)  # trailing ini comments
            if not f or STD_FLAG.match(f) and f in ("-std=gnu++11", "-std=gnu++14", "-std=c++11", "-std=c++14"):
                continue
            flags.append(anchor_flag(f, src, app))
        for key in ("board_build.partitions", "board_build.embed_files", "board_build.embed_txtfiles"):
            v = pio_get(cp, env, key)
            if v:
                # built-in partition names (default_8MB.csv, ...) resolve inside the framework; only
                # repo-relative files get anchored on ${PROJECT_DIR}
                paths = []
                for p in multiline(v):
                    if p.startswith("/") or not (src / p).exists():
                        paths.append(p)
                    elif key == "board_build.partitions":
                        paths.append(anchored(src / p, app))
                    else:
                        # _binary_<path>_start/_end are named after the path as written: an anchored
                        # ${PROJECT_DIR}/../_src/... path renamed them (M5Gotchi: undefined _binary_fonts_big_vlw_end).
                        (app / p).parent.mkdir(parents=True, exist_ok=True)
                        shutil.copyfile(src / p, app / p)
                        paths.append(p)
                extra_board.append(f"{key} = {paths[0]}" if len(paths) == 1 else f"{key} =\n" + "\n".join(f"    {p}" for p in paths))
    else:  # Arduino-IDE repo: the sketch dir is the source dir (PlatformIO compiles .ino)
        src_dir = str(target.parent.relative_to(src))
        info["env_src"] = "(ino)"
        lib_deps, unknown = infer_ino_deps(target.parent, src)
        info["inferred_deps"] = lib_deps
        if unknown:
            info["unresolved_includes"] = unknown
        if (src / "libraries").is_dir():   # sketch-local library folder, Arduino-IDE style
            extra_lib_dirs.append(anchored(src / "libraries", app))
        # The Arduino IDE compiles the sketch folder's top-level files plus src/** -- not every
        # subfolder (miniacid ships an SDL desktop port next to the sketch).
        src_filter = "build_src_filter = +<*.ino> +<*.c> +<*.cpp> +<*.h> +<*.hpp> +<src/>\n"
        # Several .ino with their own setup() in one folder are separate firmwares, not tabs of one sketch.
        setups = [s for s in target.parent.glob("*.ino") if re.search(r"\bvoid\s+setup\s*\(", s.read_text(errors="replace"))]
        if len(setups) > 1:
            src_filter = f"build_src_filter = +<{target.name}> +<*.c> +<*.cpp> +<*.h> +<*.hpp> +<src/>\n"
            info["sketch"] = target.name
        # Plain deep: deep+ evaluates #if guards with the S3 config and then drops FS for the
        # framework's SD_MMC library, which audio libraries include unconditionally (WebRadio).
        ldf_mode = "deep"
    src_dir_abs = src / src_dir
    if not src_dir_abs.exists():
        fail("src-dir-missing", f"{slug}: src_dir {src_dir} does not exist in the repo")
    if cp:
        # PlatformIO repos declare lib_deps, but not always all of them: Ultimate-Remote #includes <IRremote.hpp>
        # with no IRremote in its ini (Arduino-IDE users have it installed globally -- and so did this Mac's
        # ~/.platformio/lib, which hid the gap until the first GitHub-runner build failed, 2026-09-04). So the
        # include scan runs for PlatformIO repos too and adds registry deps whose package is not declared yet.
        inferred, unknown = infer_ino_deps(src_dir_abs, src)
        declared = {re.split(r"[@=]", d, 1)[0].strip().lower() for d in lib_deps}
        added = [d for d in inferred if re.split(r"[@=]", d, 1)[0].strip().lower() not in declared]
        if added:
            lib_deps += added
            info["inferred_deps"] = added
        if unknown:
            info["unresolved_includes"] = unknown
    if not any(STD_FLAG.match(f) for f in flags):
        flags.insert(0, "-std=gnu++17")
    if not any(f.startswith("-DCORE_DEBUG_LEVEL") for f in flags):
        flags.append("-DCORE_DEBUG_LEVEL=1")
    for must in ("-DM5GFX_BOARD=24", "-DARDUINO_USB_CDC_ON_BOOT=1", "-DDROIDPUTTER=1"):
        if must not in flags:
            flags.append(must)
    if (src / "include").is_dir():
        flags.append(f"-I {anchored(src / 'include', app)}")
    if (app / "include").is_dir():   # overlay-side compat headers (e.g. a credentials.h the repo only ships as an example)
        flags.append("-I include")
    flags.append("-Wall")
    flags.append("-I ../../shim/lib/DroidputterShim/src")
    lib_deps = [M5UNIFIED] + lib_deps + ["symlink://../../shim/lib/DroidputterShim"]
    # The app's own lib/ (MeshCore keeps ed25519 there) and an Arduino-IDE libraries/ folder. Until 2026-10-09 this sat
    # in [platformio], where PlatformIO 6 ignores it; the shim comes in through lib_deps (symlink://), not from here.
    lib_extra = ([f"    {anchored(src / 'lib', app)}"] if (src / "lib").is_dir() else []) + [f"    {d}" for d in extra_lib_dirs]

    app.mkdir(parents=True, exist_ok=True)
    ini = ENV_TEMPLATE.format(
        slug=slug, name=name, env_src=info["env_src"], src_dir=anchored(src_dir_abs, app),
        lib_extra_dirs=("lib_extra_dirs =\n" + "\n".join(lib_extra) + "\n") if lib_extra else "",
        extra_board="".join(x + "\n" for x in extra_board),
        src_filter=src_filter, ldf_mode=ldf_mode,
        lib_deps="\n".join(f"    {d}" for d in lib_deps),
        build_flags="\n".join(f"    {f}" for f in flags),
    )
    (app / "platformio.ini").write_text(ini)
    info.update(app=str(app.relative_to(REPO_ROOT)), src_dir=str(src_dir_abs), lib_deps=lib_deps)
    if not (app / "lib" / "M5GFX").is_dir() or not (app / "lib" / "M5Cardputer").is_dir():
        # apply.sh finds the pinned M5GFX/M5Cardputer versions in ~/.platformio/lib itself (downloading
        # them once if absent), so no libdeps dir is passed any more.
        r = subprocess.run(["bash", str(REPO_ROOT / "shim" / "apply.sh"), str(app)], capture_output=True, text=True)
        info["apply"] = "ok" if r.returncode == 0 else (r.stdout + r.stderr)[-800:]
    return info


def classify_build(out: str) -> tuple[str, str]:
    """(class, one-line reason) of a failed `pio run`, for the phone's status line and the proxy's failure cache.
    Same rules as the 2026-10-09 dissection of the 174 failed proxy builds."""
    m = re.search(r"region `dram0_0_seg' overflowed by (\d+) bytes", out)
    if m:
        return "dram-overflow", f"the app plus the shim need {m.group(1)} bytes more static RAM than the ESP32-S3 has"
    m = re.search(r"program size \((\d+) bytes\) is greater than maximum allowed \((\d+) bytes\)", out)
    if m:
        return "flash-too-big", f"the firmware is {m.group(1)} bytes; the app partition holds {m.group(2)}"
    m = re.search(r"fatal error: (\S+): No such file", out)
    if m:
        return "missing-header", f"needs {m.group(1)}, which no known library provides"
    m = re.search(r"undefined reference to `([^']+)'", out)
    if m:
        return "link-error", f"link failed: undefined reference to {m.group(1)[:80]}"
    m = re.search(r"multiple definition of `([^']+)'", out)
    if m:
        return "link-error", f"link failed: multiple definition of {m.group(1)[:80]}"
    m = re.search(r"\berror: (.+)", out)
    if m:
        return "compile-error", m.group(1).strip()[:160]
    tail = [ln for ln in out.splitlines() if ln.strip()][-1:] or ["(no output)"]
    return "build-error", tail[0][:160]


def build(app: Path, upload: bool, env: str = "m5cardputer") -> dict:
    """`pio run -e <env>` in the overlay dir; the parts land in apps/<name>/.pio/build/<env> (reported as build_dir)."""
    cmd = [str(PIO), "run", "-e", env] + (["-t", "upload"] if upload else [])
    r = subprocess.run(cmd, cwd=app, capture_output=True, text=True)
    out = r.stdout + r.stderr
    res = {"ok": r.returncode == 0, "env": env, "build_dir": str((app / ".pio" / "build" / env).relative_to(REPO_ROOT))}
    m = re.search(r"RAM:.*?([\d.]+)%.*?used (\d+)", out, re.S)
    f = re.search(r"Flash:.*?([\d.]+)%.*?used (\d+)", out, re.S)
    if m:
        res["ram"] = f"{m.group(1)}% ({m.group(2)} B)"
    if f:
        res["flash"] = f"{f.group(1)}% ({f.group(2)} B)"
    (app / ".pio" / "overlay-build.log").parent.mkdir(parents=True, exist_ok=True)
    (app / ".pio" / "overlay-build.log").write_text(out)   # full log for triage
    if not res["ok"]:
        errs = [ln for ln in out.splitlines() if re.search(r"\berror\b:|fatal error|undefined reference|No such file|\*\*\* \[", ln)]
        res["error"] = errs[:8] if errs else out.splitlines()[-30:]
        res["failed"], res["reason"] = classify_build(out)
    if upload:
        res["uploaded"] = "Hard resetting" in out or "SUCCESS" in out
    return res


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("repo", help="github url or owner/repo")
    ap.add_argument("--name", help="overlay name (default: repo name, lowercased)")
    ap.add_argument("--env-src", help="upstream env to take lib_deps/build_flags from")
    ap.add_argument("--ref", help="git branch/tag to clone")
    ap.add_argument("--env", default="m5cardputer",
                    help="PlatformIO env to build: m5cardputer (Cardputer ADV, real TFT) or m5cardputer-virtual (bare ESP32-S3, phone-only)")
    ap.add_argument("--build", action="store_true")
    ap.add_argument("--upload", action="store_true")
    a = ap.parse_args()
    slug = slug_of(a.repo)
    name = a.name or slug.split("/")[1].lower()
    info = generate(slug, name, a.env_src, a.ref)
    if a.build or a.upload:
        info.update(build(REPO_ROOT / info["app"], a.upload, a.env))
        # Arduino-IDE repos straddle the NimBLE 1.x -> 2.x API break: try the other major once.
        if not info["ok"] and info.get("inferred_deps") and any("NimBLE" in e for e in info.get("error", [])):
            alt = "h2zero/NimBLE-Arduino@^2.3.7" if any(d.startswith("h2zero/NimBLE-Arduino@^1") for d in info["inferred_deps"]) else "h2zero/NimBLE-Arduino@^1.4.3"
            ini = REPO_ROOT / info["app"] / "platformio.ini"
            ini.write_text(re.sub(r"h2zero/NimBLE-Arduino@\^[0-9.]+", alt.split("@")[0] + "@" + alt.split("@")[1], ini.read_text()))
            for d in (REPO_ROOT / info["app"] / ".pio" / "libdeps").glob("*/NimBLE-Arduino*"):
                subprocess.run(["rm", "-rf", str(d)])
            info["nimble_retry"] = alt
            info.pop("failed", None); info.pop("reason", None)
            info.update(build(REPO_ROOT / info["app"], a.upload, a.env))
        # Wi-Fi deauthers override the framework's ieee80211_raw_frame_sanity_check (saturn); the Arduino-IDE recipe for
        # them is -zmuldefs, so the app's definition wins at link time.
        if not info["ok"] and "ieee80211_raw_frame_sanity_check" in info.get("reason", ""):
            ini = REPO_ROOT / info["app"] / "platformio.ini"
            ini.write_text(ini.read_text().replace("build_flags =\n", "build_flags =\n    -Wl,-zmuldefs\n", 1))
            info["muldefs_retry"] = True
            info.pop("failed", None); info.pop("reason", None)
            info.update(build(REPO_ROOT / info["app"], a.upload, a.env))
        # Over the 3,342,336 B OTA slot of default_8MB.csv (Ultimate-Remote, 2026-09-19..30): one factory slot of
        # 0x7E0000 (max_app_8MB.csv, in the pinned framework). The phone flashes partitions.bin with the app.
        if not info["ok"] and info.get("failed") == "flash-too-big":
            ini = REPO_ROOT / info["app"] / "platformio.ini"
            text = ini.read_text()
            line = "board_build.partitions = max_app_8MB.csv"
            if re.search(r"^board_build\.partitions\s*=.*$", text, re.M):
                text = re.sub(r"^board_build\.partitions\s*=.*$", line, text, count=1, flags=re.M)
            else:
                text = text.replace("board_build.psram = false\n", f"board_build.psram = false\n{line}\n", 1)
            ini.write_text(text)
            info["partition_retry"] = "max_app_8MB.csv"
            info.pop("failed", None); info.pop("reason", None)
            info.update(build(REPO_ROOT / info["app"], a.upload, a.env))
    print(json.dumps(info))
    return 0 if info.get("ok", True) else 1


if __name__ == "__main__":
    sys.exit(main())
