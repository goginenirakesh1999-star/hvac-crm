"""Seed the refined dealer list into the unassigned lead pool.

Each lead is inserted with assigned_to = NULL and source = "pool:<caller>", so
/api/cron/assign-leads can hand them out a target-size batch at a time. Rows go
in highest-score-first with an explicit incrementing created_at, which is what
makes "oldest first" out of the pool mean "best first".

Phones already present in `leads` are skipped, so this is safe to re-run after
each scrape.

    python scripts/seed_lead_pool.py ../call-lists/leads_refined.csv
"""
import csv, json, os, sys, urllib.parse, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone

SRC = sys.argv[1] if len(sys.argv) > 1 else "../call-lists/leads_refined.csv"
URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
HDR = {"apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json"}


def api(method, path, body=None, prefer=None):
    req = urllib.request.Request(
        f"{URL}/rest/v1/{path}", method=method,
        data=json.dumps(body).encode() if body is not None else None)
    for k, v in {**HDR, **({"Prefer": prefer} if prefer else {})}.items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req) as f:
            return json.load(f) if f.length != 0 else [], f.headers.get("content-range")
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{method} {path} -> {e.code}: {e.read().decode()[:400]}")


# Existing phones, paged out so nothing is missed.
existing, page = set(), 0
while True:
    rows, _ = api("GET", f"leads?select=phone&limit=1000&offset={page*1000}")
    if not rows:
        break
    existing.update(r["phone"] for r in rows)
    page += 1
print(f"already in leads: {len(existing)}")

leads = list(csv.DictReader(open(SRC, encoding="utf-8-sig")))
leads.sort(key=lambda r: -float(r["call_score"]))

base = datetime.now(timezone.utc)
payload, skipped = [], 0
for i, r in enumerate(leads):
    if r["phone"] in existing or not r["owner"]:
        skipped += 1
        continue
    sig = ", ".join(s for s in r["signals"].split("|") if s not in ("main-line", "oem-known"))
    note = f"{r['band']} · {r['call_score']} · {r['state']} · {r['role']}"
    if r["oem"]:
        note += f" · {r['oem'][:40]}"
    if sig:
        note += f" · {sig}"
    payload.append({
        "assigned_to": None,
        "business": r["business"][:200],
        "name": r["contact"] or None,
        "phone": r["phone"],
        "status": "new",
        "source": f"pool:{r['owner']}",
        "notes": note,
        # explicit, strictly increasing: rank order survives into created_at
        "created_at": (base + timedelta(seconds=i)).isoformat(),
    })

print(f"to insert: {len(payload)}  (skipped {skipped} duplicate/unrouted)")
for i in range(0, len(payload), 500):
    chunk = payload[i:i + 500]
    api("POST", "leads", chunk, prefer="return=minimal")
    print(f"  inserted {i + len(chunk)}/{len(payload)}")

counts = {}
for owner in sorted({p["source"] for p in payload}):
    _, rng = api("GET", f"leads?select=id&assigned_to=is.null&source=eq.{urllib.parse.quote(owner)}&limit=1", prefer="count=exact")
    counts[owner] = rng
print("pool now:", json.dumps(counts, indent=1))
