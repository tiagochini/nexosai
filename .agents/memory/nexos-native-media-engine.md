---
name: NexOS Native Media Engine
description: Durable architecture and honesty boundary for self-controlled video, voice and likeness generation.
---

The native media engine separates the Replit-hosted control plane from private
GPU workers. Workers execute locally mounted, approved model weights for video,
voice, likeness, lip-sync and upscale. A native job must never fall through to a
commercial generation provider.

**Why:** The product must own orchestration, execution evidence, cost and data
handling without presenting provider-backed output as a NexOS-native model.
Replit currently supplies no documented CUDA worker for this workload, so
physical inference must run on NexOS-controlled GPU infrastructure.

**How to apply:** Register only healthy workers that truthfully advertise CUDA,
VRAM, model revision, license and supported output contracts. Authenticate each
worker separately with canonical signed requests and replay protection. Bind
inputs/outputs to an active lease; stream through the control plane without broad
storage credentials. Re-check revocable consent throughout the job. Only
server-hashed and technically verified staged output can create provenance,
usage or success. CPU environments must refuse GPU inference, never emit
placeholders.

The initial real inference target selected by the product owner is a rented AWS
A100 80 GB worker. Treat advertised hourly prices from other GPU hosts only as
references; verify AWS instance topology, region, quota and actual pricing before
provisioning.