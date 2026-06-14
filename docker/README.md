# Docker — ARE Private Server

This directory contains the container definitions for the Adaptive Rendering
Engine's private test server. See `../6_technology-and-docker-guide.md` for the
full rationale.

## Files
- **`Dockerfile`** — multi-stage build. Stage 1 compiles TypeScript and bundles
  the React client with esbuild; stage 2 is a slim runtime running
  `node dist/server/server.js`.
- **`nginx/proxy.conf`** — front reverse proxy. Routes `/` to the origin and
  `/edge1`, `/edge2` to the edge nodes, forwarding all `X-*` control headers.

## Topology (defined in `../docker-compose.yml`)
| Service | Role | Port | Notes |
| --- | --- | --- | --- |
| `proxy` | nginx reverse proxy | 8080 | single front door → origin |
| `origin` | ARE engine | (internal) | `SERVED_BY=origin`, no latency |
| `edge-node-1` | ARE engine (edge) | 8081 | `+20ms`, own short-TTL cache |
| `edge-node-2` | ARE engine (edge) | 8082 | `+80ms`, own short-TTL cache |
| `redis` | shared cache | (internal) | optional; edges share it |

> **Design note:** edge nodes run the *same image* as origin but self-identify
> via `SERVED_BY` and inject latency via `EDGE_LATENCY_MS`. This is more honest
> than faking edges with nginx delays — each edge has a real process, real cache
> and real latency, exactly like a CDN POP.

## Prerequisite
Needs the Docker **Compose v2** plugin (`docker compose ...`). Verify with
`docker compose version`. On Fedora/RHEL install it with
`sudo dnf install docker-compose-plugin` (or use the standalone `docker-compose`
binary). The image itself builds/runs with plain `docker build` / `docker run`
if Compose is unavailable.

## Run
```bash
cp .env.example .env          # optional; compose has sane inline defaults
docker compose up --build     # origin + 2 edges + proxy + redis
curl -I http://localhost:8080/static    # via proxy → origin
curl -I http://localhost:8081/static    # directly at edge-node-1
docker compose logs -f origin | grep '\[ARE\]'
docker compose down           # add -v to clear caches/volumes
```
