## How could we request multiple requests to chjeck: 
### 1️⃣ Rendering Strategy Switching
- Same page
- Different conditions
- Different rendering strategy

<hr>

Below is a **clean, engineering-grade way** to test **Rendering Strategy Switching** for the **same page** under **different conditions**, using **only free tools on Linux**.

---

# 🎯 Goal Recap

We want to verify that:

> **The same URL/page is rendered differently**
> when request conditions change
> and the **Adaptive Rendering Engine (ARE)** chooses a different strategy.

---

# ✅ Core Idea (Simple but Powerful)

**Same page** <br>
⬇ <br>
**Different request context** <br>
⬇ <br>
**Different rendering strategy selected automatically**

We do **NOT** create multiple pages.
We manipulate **request conditions**.

---

# 🧠 What Conditions Can We Change?

| Condition      | How we simulate         |
| -------------- | ----------------------- |
| Network speed  | Artificial delay        |
| Device type    | Headers                 |
| Cache state    | Cold vs warm cache      |
| Load           | Concurrent requests     |
| Data freshness | Time-based invalidation |

---

# 🧩 1️⃣ Strategy Switching via HTTP Headers (Most Important)

Our **Context Analyzer** reads request headers.

### The control headers, as implemented

```http
X-Network-Speed:   slow | medium | fast
X-Device-Type:     mobile | desktop
X-Cache-State:     fresh | stale | cold
X-Load-Level:      low | medium | high
X-Data-Volatility: static | periodic | realtime
X-Data-Size:       heavy | light
X-Served-By:       <node-id>        # any value except "origin" ⇒ isEdge = true
```

These are **controlled inputs** for testing.

### 1b️⃣ The same controls as query parameters (browser-usable)

A browser cannot attach custom headers to a normal navigation, so every header has a
query alias. **Precedence: header > query > inference.**

| Header | Query alias |
| --- | --- |
| `X-Network-Speed` | `?net=` |
| `X-Device-Type` | `?device=` |
| `X-Cache-State` | `?cache=` |
| `X-Load-Level` | `?load=` |
| `X-Data-Volatility` | `?volatility=` |
| `X-Data-Size` | `?size=` |
| `X-Served-By` | `?served=` |

This turns validation into something an examiner can do from the address bar:

```
http://localhost:8080/static                          → SSG
http://localhost:8080/static?cache=cold               → SSR
http://localhost:8080/static?volatility=periodic      → ISR
http://localhost:8080/dynamic?net=fast&device=desktop → CSR
http://localhost:8080/dynamic?device=mobile           → SSR
http://localhost:8080/heavy                           → STREAMING_SSR
http://localhost:8080/heavy?net=slow                  → SSR
http://localhost:8080/edge1/static?cache=cold         → EDGE_ISR
```

All eight verified against the running stack. Each page also renders an in-page
**decision console** showing the rule that fired and a live copy of the rule table.

---

## 🔧 How to Send Multiple Requests (Linux)

### ✅ Tool 1: `curl` (BEST for clarity)

#### Same page, different conditions

```bash
# Slow network → expect SSG / SSR
curl -H "X-Network-Speed: slow" \
     -H "X-Device-Type: mobile" \
     http://localhost:3000/page

# Fast network → expect CSR
curl -H "X-Network-Speed: fast" \
     -H "X-Device-Type: desktop" \
     http://localhost:3000/page

# Stale cache → expect ISR
curl -H "X-Cache-State: stale" \
     http://localhost:3000/page

# Heavy data → expect Streaming SSR
curl -H "X-Data-Size: heavy" \
     http://localhost:3000/page
```

✔ Same URL <br>
✔ Different headers <br>
✔ Different rendering strategy <br>

---

## 🔍 How We VERIFY Strategy Switching

Our server **logs the chosen strategy**:

```text
[ARE] Request: /page
[ARE] Context: slow-network, mobile
[ARE] Strategy selected: SSG
```

This log is **proof** for examiners.

---

# 🧪 2️⃣ Automated Multiple Requests (Batch Testing)

### Bash script (zero cost)

```bash
#!/bin/bash

strategies=(
  "slow mobile"
  "fast desktop"
  "medium desktop"
)

for s in "${strategies[@]}"; do
  set -- $s
  curl -H "X-Network-Speed: $1" \
       -H "X-Device-Type: $2" \
       http://localhost:3000/page
  echo ""
done
```

✔ Reproducible <br>
✔ Documentable <br>
✔ Examiner-friendly <br>

---

# ⚙️ 3️⃣ Load-Based Strategy Switching

Now test **same page under load**.

### Using Apache Benchmark (`ab`)

```bash
ab -n 1000 -c 50 http://localhost:3000/page
```

Our engine logic:

* Low load → SSR
* High load → SSG / ISR

### Strategy log example

```text
Load detected: HIGH
Strategy switched from SSR → SSG
```

---

# 🧠 4️⃣ Edge vs Origin Simulation (Implemented)

As built: **three ARE containers from one image**, differing only by environment —
`origin` (+0 ms), `edge-node-1` (+20 ms), `edge-node-2` (+80 ms). Each has its own cache;
`SERVED_BY` is what makes the analyzer report `isEdge = true`.

```bash
curl -sI "http://localhost:8080/static?cache=cold"       | grep -i x-rendering  # origin → SSR
curl -sI "http://localhost:8080/edge1/static?cache=cold" | grep -i x-rendering  # edge   → EDGE_ISR
curl -sI "http://localhost:8081/static?cache=cold"       | grep -i x-rendering  # edge   → EDGE_ISR
```

### Observed behaviour (verified)

| Node | Cache cold | Cache fresh/stale |
| --- | --- | --- |
| Edge | **EDGE_ISR** (rule 2) | SSG (rule 1 fires first) |
| Origin | SSR (fallback) | SSG |

> ⚠️ **You cannot fake an edge from the client.** `docker/nginx/proxy.conf` sets
> `proxy_set_header X-Served-By origin;` on `location /`, overwriting any client-supplied
> value — so sending `-H 'X-Served-By: edge-node-1'` to `:8080` yields SSR, not EDGE_ISR.
> Use the `/edge1/` route or ports 8081/8082. Note the `?cache=cold`: with a usable cache
> rule 1 serves SSG everywhere and the edge/origin difference is invisible.

---

# 📊 5️⃣ Visual Proof (Highly Recommended)

Return the **strategy in response headers**:

```http
X-Rendering-Strategy: Streaming-SSR
```

Then:

```bash
curl -I http://localhost:3000/page
```

Output:

```http
X-Rendering-Strategy: ISR
```

This is **bulletproof evidence**.

---

# 🧪 6️⃣ Advanced Testing (Optional)

If We want **graphs & reports**, use **Apache JMeter**:

* Same endpoint
* Different header profiles
* Visual performance charts

But **not required** for final year.

---

# 🧠 How Do We Write This in our Report

> “Rendering strategy switching was validated by issuing multiple HTTP requests to the same endpoint under varying contextual conditions using custom headers. The Adaptive Rendering Engine dynamically selected different rendering strategies, which were logged and returned as response metadata for verification.”

This is **exactly examiner language**.

---

# ✅ Final Summary (Very Clear)

✔ Same page <br>
✔ Different request headers <br>
✔ Different runtime conditions <br>
✔ Different rendering strategy <br>
✔ Fully testable on Linux <br>
✔ Zero cost

---

