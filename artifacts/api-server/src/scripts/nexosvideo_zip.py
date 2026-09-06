"""Audited stdlib-only .nexosvideo inspector/extractor.  JSON is written to stdout."""
import hashlib, json, os, posixpath, stat, sys, zipfile

MAX_ARCHIVE = 2 * 1024 * 1024 * 1024
MAX_ENTRIES = 10_000
MAX_UNCOMPRESSED = 8 * 1024 * 1024 * 1024
MAX_RATIO = 200

def fail(message):
    print(json.dumps({"ok": False, "error": message}))
    sys.exit(2)

def safe_name(name):
    if not name or "\\" in name or name.startswith("/") or "\x00" in name:
        return False
    normalized = posixpath.normpath(name)
    return normalized == name and normalized not in (".", "..") and not normalized.startswith("../")

def main(src, out):
    if os.path.getsize(src) > MAX_ARCHIVE: fail("archive exceeds maximum byte size")
    with zipfile.ZipFile(src) as archive:
        infos = archive.infolist()
        if len(infos) > MAX_ENTRIES: fail("archive has too many entries")
        names, total = set(), 0
        for info in infos:
            if not safe_name(info.filename) or info.filename in names: fail("unsafe or duplicate path")
            names.add(info.filename); total += info.file_size
            if total > MAX_UNCOMPRESSED: fail("archive exceeds uncompressed limit")
            if info.file_size and info.compress_size and info.file_size / info.compress_size > MAX_RATIO: fail("compression ratio exceeds limit")
            mode = info.external_attr >> 16
            if stat.S_ISLNK(mode) or (mode and not (stat.S_ISREG(mode) or stat.S_ISDIR(mode))): fail("non-regular zip entry")
        if "project.json" not in names or "checksums.json" not in names: fail("required package files missing")
        os.makedirs(out, exist_ok=False)
        # Validation above intentionally completes before extraction.
        for info in infos:
            target = os.path.join(out, *info.filename.split("/"))
            if info.is_dir(): os.makedirs(target, exist_ok=True); continue
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with archive.open(info) as read, open(target, "wb") as write:
                digest = hashlib.sha256()
                while True:
                    block = read.read(1024 * 1024)
                    if not block: break
                    digest.update(block); write.write(block)
        print(json.dumps({"ok": True, "entries": sorted(names), "bytes": total}))
if __name__ == "__main__":
    if len(sys.argv) != 3: fail("usage: nexosvideo_zip.py ARCHIVE OUTPUT_DIR")
    main(sys.argv[1], sys.argv[2])