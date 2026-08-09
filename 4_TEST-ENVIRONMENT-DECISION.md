> **Status note (2026-08-09).** This document records the *original decision rationale*,
> written from a Linux workstation. The decision still stands and the implementation
> matches it. The stack is currently also developed on **macOS (arm64)** via Docker
> Desktop — identical `docker compose` behaviour, only the install commands differ. The
> Linux-native argument below remains the reason Docker was chosen over a VM.
>
> One implementation detail differs from the sketch below: the **edge nodes are full ARE
> Node containers** (same image, different `SERVED_BY`/`EDGE_LATENCY_MS`), not nginx
> proxies. See `6_technology-and-docker-guide.md` §6.3.

---

Being a **Linux user is actually an advantage** for this project 👍

---

## 🥇 **Docker-based Private Server on Linux (Native Docker)**

## Why this is the best choice for a Linux user

### ✅ Native & lightweight

* Docker runs **natively on Linux**
* No extra virtualization layer
* Better performance than VM-based setups

### ✅ Zero cost

* Docker is free
* No cloud, no subscriptions
* Everything runs locally

### ✅ Perfect for a *technology* project

Our can:

* Simulate **origin server**
* Simulate **edge nodes**
* Control latency, cache, load
* Observe real rendering behavior

This aligns perfectly with our **Adaptive Rendering Engine**.

---

## Why NOT the other options (for Our)

### ❌ VirtualBox VM

* Adds unnecessary complexity
* Slower (nested virtualization)
* Not needed on Linux

### ❌ Cloud free tiers

* Limited
* Not private
* Risky for deadlines

### ❌ Raspberry Pi

* Requires hardware
* Not necessary

---

# 🧠 What our Setup Will Look Like (Conceptually)

```
Linux Host
│
├── Docker Engine
│    ├── edge-node-1   (simulated edge, low latency)
│    ├── edge-node-2   (simulated edge, high latency)
│    ├── origin-server (Adaptive Rendering Engine)
│    └── cache-store   (Redis / FS cache)
│
└── Browser (Client)
```

This is **exactly how real systems are tested**, just locally.

---

# 🧪 What We Can Test with This Setup

| Feature              | Supported |
| -------------------- | --------- |
| SSG                  | ✅         |
| SSR                  | ✅         |
| Streaming SSR        | ✅         |
| ISR                  | ✅         |
| Edge ISR (simulated) | ✅         |
| Network throttling   | ✅         |
| Load testing         | ✅         |

---

# 📄 How We Explain This to Examiners

> “Since Linux supports containerization natively, a Docker-based private server was used to simulate origin and edge environments for controlled experimentation without reliance on commercial cloud infrastructure.”

That sentence alone gives our marks.

---

# 🎯 Final Decision (No Ambiguity)

👉 **Chosen: Docker-based private server on Linux** <br>
👉 Use Docker + Docker Compose <br>
👉 Simulate edge & origin locally 

This is:

* Technically correct
* Zero cost
* Low risk
* High academic value

---
