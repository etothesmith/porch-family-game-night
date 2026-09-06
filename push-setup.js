/* ============================================================
   PORCH FAMILY — notifications front end
   - registers the service worker
   - asks permission with a friendly pre-prompt
   - detects iOS (web push needs Add-to-Home-Screen first)
   - subscribes to Web Push when a VAPID key is configured
   - shows notifications for announcements / messages
   ============================================================ */
(function () {
  if (window.__PORCH_PUSH__) return; window.__PORCH_PUSH__ = true;

  // ---- paste your VAPID PUBLIC key here once you set up a sender (see README-PUSH.md)
  const VAPID_PUBLIC_KEY = null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                    || window.navigator.standalone === true;
  const supported = 'serviceWorker' in navigator && 'Notification' in window;

  let swReg = null;

  const Push = window.PorchPush = {
    supported,
    isIOS,
    isStandalone,
    // iOS only allows web push once the app is on the home screen
    iosNeedsInstall: isIOS && !isStandalone,
    permission: supported ? Notification.permission : 'unsupported',
    ready: false,

    async init() {
      if (!supported) return;
      try {
        swReg = await navigator.serviceWorker.register('sw.js');
        await navigator.serviceWorker.ready;
        this.ready = true;
        if (Notification.permission === 'granted') this.subscribe();
      } catch (e) { console.warn('[PorchPush] SW register failed:', e.message); }

      // service worker asks the page to navigate after a notification tap
      navigator.serviceWorker.addEventListener('message', ev => {
        if (ev.data && ev.data.type === 'PORCH_NAV') routeFromUrl(ev.data.url);
      });
    },

    async request() {
      if (!supported) return 'unsupported';
      if (this.iosNeedsInstall) return 'ios-install-required';
      let p = Notification.permission;
      if (p === 'default') p = await Notification.requestPermission();
      this.permission = p;
      try { localStorage.setItem('pfw_notifAsked', '1'); } catch (e) {}
      if (p === 'granted') { this.subscribe(); this.show('Notifications on', "You'll hear about announcements and messages."); }
      return p;
    },

    // Web Push subscription — only meaningful once a sender exists
    async subscribe() {
      if (!swReg || !VAPID_PUBLIC_KEY) return null;
      try {
        const sub = await swReg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        // store it so your sender can find it
        if (window.firebase && firebase.database) {
          const id = subId(sub);
          firebase.database().ref('weekend/pushSubs/' + id).set(JSON.parse(JSON.stringify(sub)));
        }
        return sub;
      } catch (e) { console.warn('[PorchPush] subscribe failed:', e.message); return null; }
    },

    /* Show a notification now. Goes through the service worker so it lands in the
       notification centre (and survives the tab being backgrounded). */
    show(title, body, url, tag) {
      if (!supported || Notification.permission !== 'granted') return;
      const payload = { type: 'PORCH_NOTIFY', title, body, url: url || './index.html', tag: tag || 'porch' };
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(payload);
      } else if (swReg) {
        swReg.showNotification(title, { body, icon: 'sprites/freddie_face.png', tag: payload.tag, data: { url: payload.url } });
      }
    },

    announcement(text) {
      this.show('📢 New Announcement', snip(text), './index.html?screen=home&focus=announcements', 'porch-announce');
    },
    message(name, text) {
      this.show('💬 New message from ' + name, snip(text), './index.html?screen=board', 'porch-board');
    },
    reply(name, text) {
      this.show('↩️ ' + name + ' replied', snip(text), './index.html?screen=board', 'porch-board');
    }
  };

  function snip(t) { t = String(t || ''); return t.length > 110 ? t.slice(0, 107) + '…' : t; }
  function subId(sub) { return btoa(sub.endpoint).replace(/[^a-zA-Z0-9]/g, '').slice(-40); }
  function urlB64ToUint8Array(b64) {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }
  function routeFromUrl(url) {
    try {
      const q = new URL(url, location.href).searchParams;
      const screen = q.get('screen');
      const app = window.__porchApp;
      if (screen && app && app._go) app._go(screen);
    } catch (e) {}
  }

  // deep link on cold start: index.html?screen=board
  window.addEventListener('load', () => {
    Push.init();
    const q = new URLSearchParams(location.search);
    const screen = q.get('screen');
    if (screen) {
      let tries = 0;
      const t = setInterval(() => {
        const app = window.__porchApp;
        if (app && app._go) { app._go(screen); clearInterval(t); }
        if (++tries > 40) clearInterval(t);
      }, 150);
    }
  });
})();
