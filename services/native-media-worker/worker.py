"""NexOS reference native-media worker.

It never downloads weights or contacts commercial/model-hosting APIs.  A CPU
host reports no GPU inference capabilities and refuses inference jobs.
"""
import hashlib, hmac, json, os, shutil, subprocess, sys, time, tempfile, threading
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlsplit

CONFIG = Path(os.getenv("NATIVE_MEDIA_WORKER_CONFIG", "config.example.json"))
API = os.environ.get("NATIVE_MEDIA_INTERNAL_URL", "")
SECRET = os.environ.get("NATIVE_MEDIA_WORKER_SECRET", "")
WORKSPACE = os.environ.get("NATIVE_MEDIA_WORKSPACE_ID", "")
WORKER_ID = os.environ.get("NATIVE_MEDIA_WORKER_ID", "")
def canonical_path(path):
    parsed=urlsplit(API+path)
    return parsed.path+("?" + parsed.query if parsed.query else "")

def cuda():
    return shutil.which("nvidia-smi") is not None and subprocess.run(["nvidia-smi", "-L"], capture_output=True).returncode == 0
def ffmpeg():
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None
def load_config():
    with CONFIG.open() as f: return json.load(f)
def capabilities(cfg):
    # A declared model is not a capability unless the local path exists and CUDA is real.
    if not cuda(): return []
    out = []
    for model in cfg.get("models", []):
        if not Path(model["path"]).is_dir() or not model.get("licenseApproved", False): continue
        out.append({k: model[k] for k in ("operation","modelId","modelRevision","licenseApproved","resolutions","maxFps","maxDurationSeconds","vramMb") if k in model})
    if ffmpeg():
        out += [c for c in cfg.get("deterministicCapabilities", []) if c["operation"] in ("timeline_render", "qc_extract", "upscale")]
    return out
def headers(bootstrap=False):
    stamp = str(int(time.time() * 1000))
    nonce = os.urandom(24).hex()
    return stamp, nonce
def post(path, body, bootstrap=False):
    stamp, nonce = headers(bootstrap); raw = json.dumps(body,separators=(",",":"),sort_keys=True).encode()
    key = os.environ.get("NATIVE_MEDIA_BOOTSTRAP_SECRET", "") if bootstrap else SECRET
    canonical = f"{stamp}\n{nonce}\nPOST\n{canonical_path(path)}\n{hashlib.sha256(raw).hexdigest()}"
    sig = hmac.new(key.encode(), canonical.encode(), hashlib.sha256).hexdigest()
    hdr = {"content-type":"application/json", "x-native-worker-timestamp":stamp, "x-native-worker-nonce":nonce, "x-native-worker-id":WORKER_ID, "x-native-worker-credential":SECRET, "x-native-worker-signature":sig}
    req = Request(API + path, raw, headers=hdr, method="POST")
    with urlopen(req, timeout=20) as r: return json.loads(r.read() or b"{}")
def transfer(method, path, body=b"", mime="application/json", lease=""):
    access = post('/object-grants', {'jobId': path.split('/')[2], 'leaseToken': lease})['objectAccess']
    grant = access['inputs'][int(path.rsplit('/', 1)[1])]['grant']
    stamp, nonce = headers(); digest = hashlib.sha256(body).hexdigest()
    canonical = f"{stamp}\n{nonce}\n{method}\n{canonical_path(path)}\n{digest}"
    sig = hmac.new(SECRET.encode(), canonical.encode(), hashlib.sha256).hexdigest()
    hdr={"content-type":mime,"content-length":str(len(body)),"x-native-worker-timestamp":stamp,
         "x-native-worker-nonce":nonce,"x-native-worker-id":WORKER_ID,
         "x-native-worker-credential":SECRET,"x-native-worker-signature":sig,
         "x-native-body-sha256":digest,"x-native-lease-token":lease,"x-native-object-grant":grant}
    return urlopen(Request(API+path, data=body if method=="PUT" else None, headers=hdr, method=method), timeout=120)
def put_file(path, source, mime, lease):
    grant = post('/object-grants', {'jobId': path.split('/')[2], 'leaseToken': lease})['objectAccess']['output']['grant']
    digest=hashlib.sha256()
    with source.open("rb") as stream:
        for chunk in iter(lambda:stream.read(1024*1024),b""): digest.update(chunk)
    stamp,nonce=headers(); body_hash=digest.hexdigest()
    canonical=f"{stamp}\n{nonce}\nPUT\n{canonical_path(path)}\n{body_hash}"
    signature=hmac.new(SECRET.encode(),canonical.encode(),hashlib.sha256).hexdigest()
    hdr={"content-type":mime,"content-length":str(source.stat().st_size),"x-native-worker-timestamp":stamp,
         "x-native-worker-nonce":nonce,"x-native-worker-id":WORKER_ID,"x-native-worker-credential":SECRET,
         "x-native-worker-signature":signature,"x-native-body-sha256":body_hash,"x-native-lease-token":lease,"x-native-object-grant":grant}
    with source.open("rb") as stream, urlopen(Request(API+path,data=stream,headers=hdr,method="PUT"),timeout=3600) as response:
        return json.load(response)
def main():
    global WORKER_ID
    cfg = load_config(); caps = capabilities(cfg)
    # Registration is safe on CPU but advertises zero inference capabilities.
    registered = post("/register", {"workspaceId":WORKSPACE, "workerName":cfg["workerName"], "credential":SECRET, "capabilities":caps, "gpuInfo":{"cuda":cuda()}, "runtimeInfo":{"ffmpeg":ffmpeg(), "localWeightsOnly":True}}, True)
    WORKER_ID = registered["worker"]["id"]
    if not cuda():
        print("No CUDA GPU detected: registered with no inference capabilities.", file=sys.stderr); return
    while True:
        job = post("/lease", {}).get("job")
        if not job: time.sleep(3); continue
        post("/ack", {"jobId":job["id"], "leaseToken":job["leaseToken"]})
        stop_renewal=threading.Event()
        def renew():
            progress=1
            while not stop_renewal.wait(20):
                try:
                    post("/renew",{"jobId":job["id"],"leaseToken":job["leaseToken"]})
                    post("/progress",{"jobId":job["id"],"leaseToken":job["leaseToken"],"progress":min(progress,95)})
                    progress += 5
                except Exception:
                    stop_renewal.set()
        renewal=threading.Thread(target=renew,daemon=True); renewal.start()
        operation = job["operation"]; command = cfg.get("plugins", {}).get(operation)
        if not isinstance(command, list) or not command:
            stop_renewal.set(); renewal.join(timeout=2)
            post("/fail", {"jobId":job["id"], "leaseToken":job["leaseToken"], "message":"No local backend plugin configured"}); continue
        work=Path(tempfile.mkdtemp(prefix="nexos-native-"))
        try:
            inputs=[]
            for i, _ in enumerate(job.get("inputObjects", [])):
                dest=work/f"input-{i}"
                digest = hashlib.sha256()
                with transfer("GET",f"/jobs/{job['id']}/inputs/{i}",lease=job["leaseToken"]) as src, dest.open("wb") as out:
                    for chunk in iter(lambda: src.read(1024 * 1024), b''):
                        digest.update(chunk); out.write(chunk)
                if digest.hexdigest() != job['inputObjects'][i]['sha256']:
                    raise RuntimeError('Input object hash mismatch')
                inputs.append(str(dest))
            output=work/"output"
            argv=[str(value).replace("{output}",str(output)).replace("{inputs}",json.dumps(inputs)) for value in command]
            started=time.monotonic()
            result=subprocess.run(argv,check=False,env={**os.environ,"NATIVE_MEDIA_JOB":json.dumps(job),"NATIVE_MEDIA_INPUTS":json.dumps(inputs),"NATIVE_MEDIA_OUTPUT":str(output)})
            elapsed=max(time.monotonic()-started, 0.001)
            if result.returncode or not output.is_file() or output.stat().st_size == 0: raise RuntimeError(f"Plugin failed ({result.returncode})")
            mime=cfg.get("outputMimeTypes",{}).get(operation,"video/mp4")
            put_file(f"/jobs/{job['id']}/output",output,mime,job["leaseToken"])
            # The deterministic ffmpeg tools can run on a CUDA host but are not
            # GPU inference. Never turn host availability into a GPU-work claim.
            gpu_inference = operation in ("text_to_video","image_to_video","avatar_animation","voice_clone","tts","lip_sync")
            backend = "gpu" if gpu_inference else "cpu"
            gpu_seconds = f"{elapsed:.3f}" if gpu_inference else "0"
            post("/complete",{"jobId":job["id"],"leaseToken":job["leaseToken"],"telemetry":{"modelId":next((c.get("modelId") for c in caps if c["operation"]==operation),"deterministic-local"),"executionBackend":backend,"gpuSeconds":gpu_seconds,"estimatedGpuCost":"0","runtime":{"cudaDetected":True,"measurement":"wall_clock_gpu_capability_window" if gpu_inference else "cpu_deterministic_tool"}}})
        except Exception as exc:
            post("/fail",{"jobId":job["id"],"leaseToken":job["leaseToken"],"message":str(exc)[:1000]})
        finally:
            stop_renewal.set(); renewal.join(timeout=2)
            shutil.rmtree(work,ignore_errors=True)
if __name__ == "__main__": main()
