# Native media reference worker

Set `NATIVE_MEDIA_INTERNAL_URL`, `NATIVE_MEDIA_WORKSPACE_ID`,
`NATIVE_MEDIA_WORKER_SECRET`, and `NATIVE_MEDIA_WORKER_ID` through the host
secret manager; do not put secrets in configuration files. The worker signs
each internal request with HMAC-SHA256. It probes CUDA, FFmpeg, and configured
local model paths and advertises only capabilities that exist locally.

No weights are downloaded and no HuggingFace or commercial API is called.
Without CUDA it intentionally advertises no inference capability and produces
no placeholder media. Object access grants are not implemented by the current
storage adapter; the server returns opaque keys only and a deployment must add
an object-bound, short-TTL broker before plugins can read/write media.