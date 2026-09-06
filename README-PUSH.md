# Push Notifications — how this works and what's left

## What works right now (no backend, no cost)

Already live after this commit:

- **Service worker** (`sw.js`) registered and controlling the page
- **Permission prompt** — appears 4 seconds after first visit, with a separate
  iPhone flow explaining Add-to-Home-Screen
- **PWA manifest** so the app installs to the home screen
- **Real OS notifications** in the phone's notification centre, fired when
  Firebase delivers a new announcement, message, or reply from another device
- **Tap to open** — tapping a notification opens the app and routes to the
  right screen (`?screen=board` / `?screen=home`)
- **Self-suppression** — you don't get notified about your own posts

**The limit:** these fire while the app is running or backgrounded (tab alive).
On Android that covers most of a weekend. On iOS, Safari suspends background
pages aggressively, so a fully-closed app won't fire them.

## What needs a backend (true push when fully closed)

Web Push requires a server holding a **VAPID private key** to transmit through
Apple's / Google's push services. A static GitHub Pages site can't do this —
there's nowhere to keep the private key or run the sender.

You need one small always-available sender. Two free options:

---

### Option A — Cloudflare Worker (free, ~15 min)

**1. Generate VAPID keys** (once, on any machine with Node):

```bash
npx web-push generate-vapid-keys
# → Public Key:  BN4G...   (goes in push-setup.js)
# → Private Key: k8Jd...   (goes in the Worker secret — never commit it)
```

**2. Paste the public key** into `push-setup.js`:

```js
const VAPID_PUBLIC_KEY = 'BN4G...';   // replace null
```

Devices will now register a real push subscription and store it at
`weekend/pushSubs/{id}` in your Realtime Database.

**3. Create the Worker** at dash.cloudflare.com → Workers → Create:

```js
import webpush from 'web-push';

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('POST only', { status: 405 });

    const { title, body, url, tag } = await request.json();

    webpush.setVapidDetails('mailto:you@example.com', env.VAPID_PUBLIC, env.VAPID_PRIVATE);

    // pull every stored subscription
    const res  = await fetch(`${env.DB_URL}/weekend/pushSubs.json`);
    const subs = (await res.json()) || {};

    const payload = JSON.stringify({ title, body, url, tag });
    await Promise.all(Object.entries(subs).map(([id, sub]) =>
      webpush.sendNotification(sub, payload).catch(async err => {
        // 404/410 means the device unsubscribed — clean it up
        if (err.statusCode === 404 || err.statusCode === 410) {
          await fetch(`${env.DB_URL}/weekend/pushSubs/${id}.json`, { method: 'DELETE' });
        }
      })
    ));

    return new Response('sent');
  }
};
```

**4. Add secrets** in the Worker settings:

| Name | Value |
|---|---|
| `VAPID_PUBLIC` | the public key |
| `VAPID_PRIVATE` | the private key — **never commit this** |
| `DB_URL` | `https://porch-family-default-rtdb.firebaseio.com` |

**5. Point the app at it.** In `push-setup.js`, after `const VAPID_PUBLIC_KEY`:

```js
const PUSH_ENDPOINT = 'https://your-worker.workers.dev';

Push.sendReal = function (title, body, url, tag) {
  fetch(PUSH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body, url, tag })
  }).catch(() => {});
};
```

Then in `index.html`, in `_postAnnouncement` and `_postMessage`, add one line
after the existing `_persist(...)` call:

```js
if (window.PorchPush && window.PorchPush.sendReal)
  window.PorchPush.sendReal('📢 New Announcement', msg, './index.html?screen=home');
```

---

### Option B — Firebase Cloud Functions

Same idea, but Cloud Functions requires the **Blaze** (pay-as-you-go) plan.
Realistically free at family-reunion volume, but it needs a card on file.
Trigger on `weekend/announcements` writes and send to `weekend/pushSubs`.

---

## iPhone requirements

Apple supports web push only when:

1. The device is on **iOS 16.4 or later**
2. The app was added via **Share → Add to Home Screen**
3. It's opened **from that home-screen icon**, not Safari

The app detects this and shows iPhone-specific instructions instead of a
permission button that couldn't work.

## Payload shape

Your sender should POST JSON in this shape — `sw.js` already parses it:

```json
{
  "title": "📢 New Announcement",
  "body":  "Dinner moved to 6:30 — meet in the lobby!",
  "url":   "./index.html?screen=home&focus=announcements",
  "tag":   "porch-announce"
}
```

`tag` matters: reusing one replaces the previous notification instead of
stacking five copies on the lock screen.

## Testing

1. Open the app, allow notifications
2. Go to Family Board → "Send test" next to the 🔔 row
3. For the real path: post an announcement from a second device — the first
   should get a notification within a second or two
