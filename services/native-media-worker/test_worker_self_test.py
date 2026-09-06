"""CPU safety self-test for the reference native-media worker.

This is deliberately offline: it neither registers a worker nor contacts an API.
"""
import json
import tempfile
from pathlib import Path

import local_ops
import worker

INFERENCE = {"text_to_video", "voice_clone", "avatar_animation"}

if worker.cuda():
    raise SystemExit("This CPU safety fixture must be run on a host without CUDA")

cfg = json.loads(Path(__file__).with_name("config.example.json").read_text())
advertised = worker.capabilities(cfg)
assert not (INFERENCE & {cap["operation"] for cap in advertised}), advertised

with tempfile.TemporaryDirectory(prefix="native-media-worker-self-test-") as tmp:
    for operation in INFERENCE:
        args = type("Args", (), {
            "operation": operation, "source": str(Path(tmp) / "input"),
            "target": str(Path(tmp) / "output"), "width": "16", "height": "16",
        })()
        try:
            local_ops.run(args)
        except RuntimeError as error:
            assert "not deterministic/local" in str(error)
        else:
            raise AssertionError(f"{operation} emitted a placeholder instead of refusing")

print("reference worker CPU self-test passed: no GPU inference capabilities or placeholders")