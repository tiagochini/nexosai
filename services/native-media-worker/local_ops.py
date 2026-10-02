"""Deterministic local FFmpeg operations used by a private worker plugin.

This module has no model dependency. It is intentionally not used to fabricate
GPU inference output: unsupported inference operations must fail.
"""
import json, shutil, subprocess, sys
from pathlib import Path

def run(args):
    operation, source, target = args.operation, Path(args.source), Path(args.target)
    if operation not in ("upscale", "qc_extract", "timeline_render"):
        raise RuntimeError("operation is not deterministic/local")
    if not shutil.which("ffmpeg"):
        raise RuntimeError("FFmpeg is unavailable")
    if not source.is_file(): raise RuntimeError("source object was not mounted locally")
    target.parent.mkdir(parents=True, exist_ok=True)
    if operation == "upscale":
        command = ["ffmpeg","-y","-i",str(source),"-vf",f"scale={args.width}:{args.height}:flags=lanczos",str(target)]
    elif operation == "qc_extract":
        command = ["ffmpeg","-y","-i",str(source),"-vf","fps=1/5",str(target)]
    elif operation == "timeline_render":
        # Timeline manifests must already resolve private inputs in a sandbox.
        command = ["ffmpeg","-y","-f","concat","-safe","0","-i",str(source),"-c","copy",str(target)]
    else: raise RuntimeError("operation is not deterministic/local")
    subprocess.run(command, check=True)

if __name__ == "__main__":
    import argparse
    p=argparse.ArgumentParser(); p.add_argument("operation", choices=["upscale","qc_extract","timeline_render"])
    p.add_argument("--source", required=True); p.add_argument("--target", required=True)
    p.add_argument("--width", default="1920"); p.add_argument("--height", default="1080")
    run(p.parse_args())
