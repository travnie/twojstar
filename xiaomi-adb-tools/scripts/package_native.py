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
    parser.add_argument("--require-version", help="Exact required bundled Java version")
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
    version = subprocess.check_output([jpackage, "--version"], text=True).strip()
    if version.split(".")[0] != "25":
        raise SystemExit(f"Expected jpackage from JDK 25, got {version}")
    stage = project / "build" / "native-input"
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True)
    shutil.copy2(jar, stage / jar.name)

    destination = project / "build" / "native"
    destination.mkdir(parents=True, exist_ok=True)
    name = "XiaomiADBFastbootTools"
    image = destination / (f"{name}.app" if platform.system() == "Darwin" else name)
    if image.exists():
        shutil.rmtree(image)
    # CVE-2026-114938: disable the vulnerable HotSpot intrinsic on x64.
    java_options = ["--java-options", "--enable-native-access=ALL-UNNAMED"]
    if detected.endswith("-x64"):
        mitigation = ["-XX:+UnlockDiagnosticVMOptions", "-XX:-UseBASE64Intrinsics"]
        java = Path(jpackage).with_name("java.exe" if platform.system() == "Windows" else "java")
        subprocess.run([str(java), *mitigation, "-version"], check=True)
        for option in mitigation:
            java_options += ["--java-options", option]
    subprocess.run(
        [
            jpackage, "--type", "app-image",
            "--name", "XiaomiADBFastbootTools",
            "--input", str(stage),
            "--main-jar", jar.name,
            "--main-class", "Main",
            "--dest", str(destination),
            *java_options,
        ],
        check=True,
    )

    runtimes = [p for p in image.rglob("runtime") if p.is_dir()]
    releases = [release for runtime in runtimes for release in runtime.rglob("release") if release.is_file()]
    if len(releases) != 1:
        raise SystemExit(f"Expected one bundled Java release file: {image}")
    metadata = dict(line.split("=", 1) for line in releases[0].read_text(encoding="utf-8").splitlines() if "=" in line)
    bundled_version = metadata.get("JAVA_VERSION", "").strip('"')
    if bundled_version != version.split("+", 1)[0]:
        raise SystemExit(f"Bundled Java {bundled_version!r} does not match jpackage {version}")
    if args.require_version and bundled_version != args.require_version:
        raise SystemExit(f"Expected bundled Java {args.require_version}, got {bundled_version}")
    print(f"Verified bundled Java version: {bundled_version}")

    output = project / "build" / "native-dist"
    output.mkdir(parents=True, exist_ok=True)
    if platform.system() == "Windows":
        archive = output / f"{name}-{detected}.zip"
        temporary = archive.with_name(archive.name + ".tmp")
        with zipfile.ZipFile(temporary, "w", zipfile.ZIP_DEFLATED) as bundle:
            for item in sorted(image.rglob("*")):
                if item.is_file():
                    bundle.write(item, item.relative_to(destination))
    else:
        archive = output / f"{name}-{detected}.tar.gz"
        temporary = archive.with_name(archive.name + ".tmp")
        with tarfile.open(temporary, "w:gz") as bundle:
            bundle.add(image, arcname=image.name)
    temporary.replace(archive)
    print(f"Self-contained archive: {archive}")


if __name__ == "__main__":
    main()
