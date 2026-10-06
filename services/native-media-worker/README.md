# Native media reference worker

Set `NATIVE_MEDIA_INTERNAL_URL`, `NATIVE_MEDIA_WORKSPACE_ID`,
`NATIVE_MEDIA_WORKER_SECRET`, and `NATIVE_MEDIA_WORKER_ID` through the host
secret manager; do not put secrets in configuration files. The worker signs
each internal request with HMAC-SHA256. It probes CUDA, FFmpeg, and configured
local model paths and advertises only capabilities that exist locally.

No weights are downloaded and no HuggingFace or commercial API is called.
Without CUDA it intentionally advertises no inference capability and produces
no placeholder media. The control plane brokers object access with one-time
grants scoped to worker, workspace, job, lease, method and input hash. Grants
expire within 60 seconds and never expose storage credentials. Before each
transfer, the worker requests fresh grants through signed `/object-grants`.
The API rechecks the active lease and consent; replay consumption is atomic in
PostgreSQL. Input files are hashed while streaming and must match the job hash.
Deploy the API and worker changes together; older workers without grant headers
will be rejected. GPU model/license/output homologation remains required.
