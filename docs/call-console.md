# Call console — running it

Browser softphone at `/call`. Your side of the call goes over the internet (WebRTC), so you
only pay Twilio's outbound US leg — around $0.014/min. The $20 on the account is roughly
1,400 minutes, which covers a 300-call sprint with room to spare.

> **Why this matters:** the alternative — having Twilio ring your mobile and bridge you to the
> dealer — bills a second leg. If that mobile is Indian, that leg costs 10–20× the US one and
> $20 disappears in about forty calls. The browser is not the fancy option, it's the cheap one.

---

## Deployed on Vercel (recommended — do this instead of tunnels)

A fixed URL means the TwiML App is configured once and never touched again. Tunnels are only
worth it if you're editing the code while calling.

**Environment variables to set in the Vercel project** (Settings → Environment Variables), on
top of everything already in `.env.local`:

| Variable | Value |
|---|---|
| `DIALER_PASSCODE` | a long random string you invent — this is the console password |
| `WEBHOOK_BASE_URL` | `https://<your-app>.vercel.app` — no trailing slash |

Both are **required in production**. Without `DIALER_PASSCODE` the app refuses to serve the
console at all; without `WEBHOOK_BASE_URL` the Twilio signature check is skipped and anyone who
finds `/api/voice/outbound` can place calls on your account.

**Then point the TwiML App at it, once:**

Twilio Console → **Voice → Manage → TwiML Apps** → the app matching `TWILIO_TWIML_APP_SID`

- **Request URL:** `https://<your-app>.vercel.app/api/voice/outbound`
- **Method:** `HTTP POST`

**Using it:** open `https://<your-app>.vercel.app/call`. The browser asks for a username and
password — leave the username blank or type anything, and enter your `DIALER_PASSCODE` as the
password.

> **One caveat, your call to make:** Vercel's Hobby tier terms prohibit commercial use. This is an
> internal tool rather than a customer-facing site, but it is being used to run a business. That's
> why the warranty site itself is on Cloudflare Pages. If it matters to you, a Vercel Pro seat or a
> named Cloudflare tunnel both solve it.

---

## The step that isn't obvious (tunnel method — only if not deployed)

Twilio has to reach `/api/voice/outbound` to know who to dial. **It cannot reach `localhost`.**
So a local dev server alone will connect the device, then fail the moment you press Call.

You need a public URL pointing at your local server, and the TwiML App has to be told about it.

### Every time you start a calling session

**1. Start the app**

```
cd C:\Users\DELL\Documents\HVAC-CRM
npm run dev
```

**2. Open a public tunnel to it — separate terminal, leave it running**

```
npx cloudflared tunnel --url http://localhost:3000
```

It prints a URL like `https://something-random-words.trycloudflare.com`. Copy it.

**3. Point the TwiML App at the tunnel**

Twilio Console → **Voice → Manage → TwiML Apps** → open the app matching `TWILIO_TWIML_APP_SID`
in `.env.local`.

- **Request URL:** `https://<your-tunnel>.trycloudflare.com/api/voice/outbound`
- **Method:** `HTTP POST`
- **Save**

**4. Call**

Open `http://localhost:3000/call` → **Connect phone** → allow the microphone → **Import CSV** →
choose `public/call-list-priority.csv` → press **Call** on a row.

⚠️ **The tunnel URL changes every time you restart it.** Step 3 has to be redone each session.
If that becomes annoying, set up a named Cloudflare tunnel for a stable hostname, or deploy the
app somewhere with a fixed URL.

---

## The call list

`public/call-list-priority.csv` — **128 dealership groups**, filtered and ordered for this
campaign, not the raw 277.

What was taken out and why:

- **Carrier Transicold entries** — transport refrigeration, not equipment dealers. Different OEM
  programmes, nothing from the Kubota pilot transfers.
- **Duplicates** — Swiderski, Rueter, Malvese, Acme, H&R Agri-Power and Eagle Power each appeared
  twice under different names.
- **Broken phone rows** — several entries had `10335260518` in the phone column, which is a
  spreadsheet artifact, not a number. Messick, S&H Farm Supply, Hills Machinery and Lee Tractor
  are affected; find their real numbers before calling them.
- **6–10 store groups deprioritised** — they employ a warranty administrator already and usually
  have an incumbent. They are not excluded, just not first.

What it is ordered by:

1. **Missouri and neighbouring states first** — the Wentzville address is a true local story, and
   Central time is the only calling window that doesn't wreck your sleep.
2. **Kubota dealers** — where the founder's experience is real and specific. On a Case IH claim
   you are guessing, and a service manager hears the difference.
3. **2–4 store groups** — one owner decides, in one call.

Row 1 is **Mordt Tractor, Warrenton MO** — about 20 minutes from the registered address.

---

## Forwarding inbound calls to your mobile

Separate from the dialer, and deliberately **not** hosted in this app — a dealer calling the
number published on the website must get through even if Vercel is down or the deploy is broken.
So this lives in a Twilio-hosted TwiML Bin with no dependency on anything you run.

**1. Console search → TwiML Bins → Create new**

Friendly name: `Inbound - forward to Rakesh`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="20" callerId="+12013477569" answerOnBridge="true">
    <Number>+919063855903</Number>
  </Dial>
  <Say voice="alice">Sorry, we could not reach anyone. Please leave a message after the tone, and we will call you back the same business day.</Say>
  <Record maxLength="120" playBeep="true" />
</Response>
```

**2. Phone Numbers → Active Numbers → +1 201 347 7569 → Voice Configuration**

- *A call comes in:* **TwiML Bin** → `Inbound - forward to Rakesh`
- *Primary handler fails:* leave empty
- **Caller Name Lookup: OFF** — it's a cent per call for a US caller-ID lookup you don't need
- **Save**

**3. Prerequisites** — either of these missing and it fails silently:

- **Geo Permissions** must have **India** enabled for Voice (Console search → Geo Permissions).
  Twilio blocks most countries by default.
- The account must be upgraded past trial. ✅ done.

**4. Test it.** Call `+1 (201) 347-7569` from another phone and confirm your mobile rings. Then
don't answer, and confirm you get the voicemail prompt.

### Two things to know

**Caller ID shows your own Twilio number, not the dealer's.** That's deliberate — passing the
original caller's number through to an Indian mobile gets blocked by some carriers, and a call
that doesn't connect is worse than one you can't identify. Who actually called is in **Monitor →
Logs → Calls**, with the time and number.

**Forwarding to India is the expensive leg.** Twilio → Indian mobile costs materially more per
minute than a US call — check Twilio's current voice pricing for the real figure. Inbound volume
will be low so it doesn't matter much, but the voicemail fallback above exists partly so a missed
call ends in 20 seconds instead of ringing on your balance.

The `<Record>` voicemails land in **Monitor → Logs → Recordings**.

---

## Recording is off by default

There's a checkbox in the Leads panel. Leave it off for cold calls.

Several states in this list require **all-party** consent to record a call — California, Illinois,
Pennsylvania, Washington, Florida, Massachusetts among them — and a cold call to a stranger is
exactly the situation those laws are about. When the box is ticked, the callee hears "this call
may be recorded" before being bridged in, which is the standard mitigation, but it is a
mitigation and not a guarantee.

For 300 cold calls the notes field gives you everything useful and none of the exposure.

---

## Calling window

Service managers answer between roughly 7–9am and 1–3pm local. For Central time that's:

| Central | IST |
|---|---|
| 7:00 am | 5:30 pm |
| 9:00 am | 7:30 pm |
| 1:00 pm | 11:30 pm |

The 7–9am Central block is 5:30–7:30pm IST — a normal evening, and sustainable for 15 days.
That is the single strongest argument for working Missouri and the Midwest before the coasts.

---

## The opener

Ask for denied claims, not for a meeting. A file attachment is a far easier yes than a slot in
somebody's calendar.

> "Rakesh Gogineni, Rocky Solutions, we're over in Wentzville. I own a Kubota dealership myself —
> I'm not a consultant, I've filed these claims from behind the counter. Quick question: do you
> have warranty claims that came back denied in the last year that nobody went back to? Send me
> twenty of them. I'll tell you which ones are recoverable and why. If I recover money you pay me
> a percentage. If I recover nothing, you owe nothing."

Mark the outcome **Sending denials** when they agree. That is the only outcome that counts.
