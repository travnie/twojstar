#!/usr/bin/env python3
"""Bundle the host JDK with Xiaomi ADB Tools using jpackage."""

import argparse
import platform
import shutil
import subprocess
import tarfile
import zipfile
from pathlib import Path


def host_platform():
    system = platform.system()
    machine = platform.machine().lower()
    arch = "arm64" if machine in {"aarch64", "arm64"} else "x64"
    if machine not in {"aarch64", "arm64", "x86_64", "amd64"}:
        raise SystemExit(f"Unsupported CPU architecture: {machine}")
    systems = {"Windows": "windows", "Linux": "linux", "Darwin": "macos"}
    if system not in systems:
        raise SystemExit(f"Unsupported OS: {system}")
    return f"{systems[system]}-{arch}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--platform", required=True, help="Expected host platform")
    args = parser.parse_args()

    detected = host_platform()
    if args.platform != detected:
        raise SystemExit(f"Expected {args.platform}, running on {detected}")

    project = Path(__file__).resolve().parents[1]
    jar = project / "build" / "libs" / f"XiaomiADBFastbootTools-{detected}.jar"
    if not jar.is_file():
        raise SystemExit(f"Missing {jar.name}: build jar{''.join(part.capitalize() for part in detected.split('-'))} first")

    jpackage = shutil.which("jpackage")
    if not jpackage:
        raise SystemExit("jpackage missing: run with a full JDK 25")
    destination = project / "build" / "native"
    destination.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            jpackage, "--type", "app-image",
            "--name", "XiaomiADBFastbootTools",
            "--input", str(jar.parent),
            "--main-jar", jar.name,
            "--main-class", "Main",
            "--dest", str(destination),
            "--java-options", "--enable-native-access=ALL-UNNAMED",
        ],
        check=True,
    )

    name = "XiaomiADBFastbootTools"
    image = destination / (f"{name}.app" if platform.system() == "Darwin" else name)
    if not image.is_dir() or not any(p.is_dir() for p in image.rglob("runtime")):
        raise SystemExit(f"Packaged image is missing its bundled Java runtime: {image}")

    output = project / "build" / "native-dist"
    output.mkdir(parents=True, exist_ok=True)
    if platform.system() == "Windows":
        archive = output / f"{name}-{detected}.zip"
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
            for item in sorted(image.rglob("*")):
                if item.is_file():
                    bundle.write(item, item.relative_to(destination))
    else:
        archive = output / f"{name}-{detected}.tar.gz"
        with tarfile.open(archive, "w:gz") as bundle:
            bundle.add(image, arcname=image.name)
    print(f"Self-contained archive: {archive}")


if __name__ == "__main__":
    main()
