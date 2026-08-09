# 9. Zero → Running — Complete Beginner Guide (Fedora 43)

This guide takes you from a **fresh machine** to a **fully running Adaptive
Rendering Engine**, explaining what each command does and why. Follow top to
bottom the first time; later use it as a reference.

---

## ⚡ Your machine status (checked 2026-06-14)

| Tool | Needed | You have | Action |
| --- | --- | --- | --- |
| Node.js | ≥ 20 | v25.2.1 ✅ | none |
| npm | any | 11.6.2 ✅ | none |
| git | any | 2.54 ✅ | none |
| Docker engine | any | 29.5.2 ✅ (daemon running, you're in `docker` group) | none |
| Apache Bench (`ab`) | for load tests | installed ✅ | none |
| **Docker Compose** | for multi-container | **MISSING** ❌ | **install (Phase 0.3)** |

**Bottom line:** you can run everything *locally* right now (Phase 1). To run the
full Docker private server (Phase 3) you only need to install Compose.

---

# Phase 0 — Installations (from absolute zero)

> Skip any tool you already have (see table above). Commands are for Fedora 43.

## 0.1 Node.js + npm
```bash
sudo dnf install -y nodejs npm
node -v && npm -v          # expect v20+ and a version number
```
*Node runs the engine; npm installs the project's libraries.*

## 0.2 Docker engine
```bash
sudo dnf install -y docker            # Fedora ships Docker/Moby
sudo systemctl enable --now docker    # start it now + on every boot

# Run docker without sudo (log out/in afterwards for it to take effect):
sudo usermod -aG docker "$USER"

docker run --rm hello-world           # sanity check
```
*Docker packages the app + its environment into isolated containers.*

## 0.3 Docker Compose  ← the one you need
```bash
sudo dnf install -y docker-compose    # installs Compose v2 (the `docker-compose` command)
docker-compose version                # expect v2.x
```
> **Command name:** Fedora installs it as `docker-compose` (hyphen). The newer
> `docker compose` (space) is the same tool as a plugin. **This project's docs
> use `docker compose` (space)** — if that errors on your machine, just replace
> it with `docker-compose` (hyphen) everywhere. They behave identically.
>
> Optional — enable the `docker compose` (space) form too:
> ```bash
> mkdir -p ~/.docker/cli-plugins
> ln -sf "$(command -v docker-compose)" ~/.docker/cli-plugins/docker-compose
> docker compose version    # now works with a space
> ```

## 0.4 Load-testing tool (optional, for §C.4 of the runbook)
```bash
sudo dnf install -y httpd-tools       # provides `ab` (Apache Bench)
ab -V | head -1
```

---

# Phase 1 — Get the project & install dependencies

```bash
cd /home/bijaybk/Projects/college-project/ARE      # the project root (already here)
ls                                                  # you should see src/ docker/ package.json ...

npm install        # reads package.json, downloads React/esbuild/etc into node_modules/
```
*One-time (re-run only when `package.json` changes). Creates `node_modules/`.*

---

# Phase 2 — Run locally (no Docker) — fastest way to see it work

## 2.1 Build the browser bundle (once)
```bash
npm run build:client     # esbuild compiles the React client → public/client.js
```
*Needed so CSR/hydration pages have JavaScript to send to the browser.*

## 2.2 Start the engine
```bash
npm run dev              # starts on http://localhost:3000, auto-reloads on edits
```
Leave this terminal running. You'll see:
```
[ARE] Prebuilt SSG: /static
[ARE] Adaptive Rendering Engine listening on :3000 (origin)
[ARE] Strategies registered: SSG, SSR, STREAMING_SSR, ISR, CSR, EDGE_ISR
```

## 2.3 Drive it from a SECOND terminal (client side)
```bash
cd /home/bijaybk/Projects/college-project/ARE

# The headline demo — same URLs, different strategies based on headers:
BASE_URL=http://localhost:3000 bash scripts/switch-test.sh
```
Or open in a browser: http://localhost:3000/static , `/dynamic` , `/heavy`.

Stop the engine with **Ctrl-C** in its terminal.

---

# Phase 3 — Run the Docker private server (origin + edges + proxy + redis)

This is the setup for your report/viva: it models a real CDN locally.

## 3.1 Bring the whole system up
```bash
cd /home/bijaybk/Projects/college-project/ARE
cp .env.example .env            # optional; compose has sane defaults
docker compose up --build       # or: docker-compose up --build
```
What happens (one command, five containers):
- **builds** the `are:latest` image from `docker/Dockerfile`,
- starts **origin** (the engine), **edge-node-1**, **edge-node-2**, **redis**, **proxy**,
- puts them on one private network where they find each other **by name**.

You'll see interleaved logs from each container. Leave it running.

## 3.2 Where things listen (host → container)
| You type in browser/curl | Goes to | Notes |
| --- | --- | --- |
| `http://localhost:8080/...` | **proxy → origin** | main entry, no latency |
| `http://localhost:8081/...` | **edge-node-1** | +20 ms, own cache, `isEdge=true` |
| `http://localhost:8082/...` | **edge-node-2** | +80 ms, own cache, `isEdge=true` |

> Only these ports are exposed to your laptop. Redis and the origin's own port
> stay *inside* the Docker network — that's what makes it a **private** server.

## 3.3 Stop / clean up
```bash
# In another terminal (or after Ctrl-C in the compose terminal):
docker compose down             # stop & remove the 5 containers
docker compose down -v          # also delete volumes (clears caches/SSG/metrics)
```

---

# Phase 4 — Connecting Docker and client-side controls

This is how you *operate* the running containers from your terminal/browser.

## 4.1 Send requests (the "client side")
The engine is controlled entirely by **HTTP headers** on normal requests —
nothing special needed beyond `curl` or a browser.

```bash
# Read which strategy a request got (the proof header):
curl -s -D- -o /dev/null http://localhost:8080/dynamic | grep -i x-rendering-strategy

# Force conditions with headers (same URL, different outcomes):
curl -s -D- -o /dev/null \
  -H 'X-Network-Speed: slow' -H 'X-Device-Type: mobile' \
  http://localhost:8080/dynamic | grep -i x-rendering

# All control headers you can set:
#   X-Network-Speed: slow|medium|fast
#   X-Device-Type:   mobile|desktop
#   X-Cache-State:   fresh|stale|cold
#   X-Load-Level:    low|medium|high
#   X-Data-Volatility: static|periodic|realtime
#   X-Data-Size:     heavy
#   X-Served-By:     edge-node-1   (simulate an edge against any node)
```

## 4.2 Watch the engine's decisions (server side)
```bash
docker compose logs -f origin | grep '\[ARE\]'
#   [ARE] Request: /dynamic
#   [ARE] Context: net=slow device=mobile cache=fresh load=low volatility=realtime ...
#   [ARE] Strategy selected: SSR — Slow network -> avoid heavy hydration (SSR)
```
`-f` follows live. Swap `origin` for `edge-node-1` to watch an edge.

## 4.3 Compare origin vs edge (proves edge behavior)
```bash
curl -s -D- -o /dev/null http://localhost:8080/static | grep -i x-rendering   # origin
curl -s -D- -o /dev/null http://localhost:8081/static | grep -i x-rendering   # edge-1 (isEdge=true)
```

## 4.4 Useful container controls
```bash
docker compose ps                       # list running services + status
docker compose restart edge-node-1      # restart one service
docker compose logs --tail=50 proxy     # last 50 lines from the proxy
docker compose exec origin sh           # open a shell INSIDE the origin container
docker compose exec redis redis-cli keys '*'   # inspect the shared cache
docker stats                            # live CPU/memory per container
```

## 4.5 Collect evidence / run experiments
```bash
# Functional + unit proof (no server needed):
npm test                                # 14 tests, all 9 decision rules

# Strategy switching + performance report:
BASE_URL=http://localhost:8080 bash scripts/switch-test.sh
npm run report                          # → experiments/results/report.{json,csv}

# Load test (needs ab):
BASE_URL=http://localhost:8080 N=1000 C=50 bash scripts/load-test.sh /dynamic
```

---

# Phase 5 — Everyday cheat sheet

| Goal | Command |
| --- | --- |
| Install deps | `npm install` |
| Build client bundle | `npm run build:client` |
| Run locally | `npm run dev` (→ :3000) |
| Run full stack | `docker compose up --build` (→ :8080/:8081/:8082) |
| Stop full stack | `docker compose down` |
| Unit tests | `npm test` |
| Typecheck | `npm run typecheck` |
| Performance report | `npm run report` |
| Strategy demo | `bash scripts/switch-test.sh` |
| Watch decisions | `docker compose logs -f origin \| grep '\[ARE\]'` |

---

# Phase 6 — Troubleshooting (zero-level)

| Symptom | Cause & fix |
| --- | --- |
| `docker compose: unknown command` | Use `docker-compose` (hyphen), or do the symlink in §0.3 |
| `permission denied` talking to Docker | You're not in the `docker` group yet — `sudo usermod -aG docker $USER`, then **log out and back in** |
| `Cannot connect to the Docker daemon` | Start it: `sudo systemctl start docker` |
| Page says "client bundle not built" | `npm run build:client` |
| `ab: command not found` | `sudo dnf install httpd-tools` |
| Port 8080/3000 "address already in use" | Another process/old container is using it — `docker compose down`, or change the port in `docker-compose.yml` / `PORT` env |
| Redis warning in logs | Harmless — engine falls back to file+memory cache; Redis is optional |
| Changes to `src/` not reflected in Docker | Rebuild the image: `docker compose up --build` (Docker uses the built image, not your live files) |

---

## What "connecting" really means here (mental model)

1. **Your browser/curl** talks only to published host ports (`8080/8081/8082`).
2. Docker **forwards** those to the matching container's internal port `3000`.
3. Inside the private network, containers reach each other **by service name**
   (`proxy` → `origin`, edges → `redis`). No IPs, no public internet.
4. You **control behavior with request headers**; you **observe results** in
   response headers (`X-Rendering-Strategy`) and `[ARE]` log lines.

That's the whole loop: *headers in → decision → render → headers + logs out.*
