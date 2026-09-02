/* ============================================================
   LIVE SYNC — persists admin edits to Firebase and pushes
   changes to everyone's phone in real time.

   Degrades safely: with no config, this file does nothing at all
   and the app behaves exactly as it did before.
   ============================================================ */
(function(){
  if (window.__PORCH_LIVE__) return; window.__PORCH_LIVE__ = true;

  var CFG = window.PORCH_FIREBASE_CONFIG;
  var KEYS = ['customSchedule','customPlaces','customContacts','customQuiz','announcements','bingoState','auctionLive','runnerBoard'];
  var db = null, ready = false, muted = false;

  function setStatus(txt, ok){
    var el = document.getElementById('pfw-livedot');
    if(!el) return;
    el.textContent = txt;
    el.style.background = ok ? '#16A34A' : '#9CA3AF';
    el.title = ok ? 'Live sync on — edits reach everyone' : 'Local only — edits stay on this phone';
  }

  /* No config: stay dormant. */
  if (!CFG || !CFG.databaseURL){
    window.PorchLive = { on:false, push:function(){}, status:'not configured' };
    document.addEventListener('DOMContentLoaded', function(){ setStatus('Local', false); });
    return;
  }

  /* Load the Firebase SDK (compat build — no bundler needed) */
  function script(src){
    return new Promise(function(res, rej){
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = function(){ rej(new Error('failed to load '+src)); };
      document.head.appendChild(s);
    });
  }

  var CDN = 'https://www.gstatic.com/firebasejs/10.12.2/';
  script(CDN+'firebase-app-compat.js')
    .then(function(){ return script(CDN+'firebase-database-compat.js'); })
    .then(function(){
      firebase.initializeApp(CFG);
      db = firebase.database();
      ready = true;
      setStatus('Live', true);

      /* Pull existing data + subscribe to changes */
      KEYS.forEach(function(key){
        db.ref('weekend/'+key).on('value', function(snap){
          var val = snap.val();
          if (val == null) return;
          var app = window.__porchApp;
          if (!app) return;
          muted = true;                       // don't echo this back up
          var patch = {}; patch[key] = val;
          app.setState(patch);
          setTimeout(function(){ muted = false; }, 60);
        });
      });

      /* Connection indicator */
      db.ref('.info/connected').on('value', function(s){ setStatus(s.val()?'Live':'Offline', !!s.val()); });
    })
    .catch(function(err){
      console.error('[PorchLive]', err.message);
      setStatus('Local', false);
      window.PorchLive.on = false;
    });

  /* Called by the app whenever an admin edit is saved */
  window.PorchLive = {
    on: true,
    status: 'connecting',
    push: function(key, value){
      if (!ready || !db || muted) return;
      if (KEYS.indexOf(key) < 0) return;
      db.ref('weekend/'+key).set(value).catch(function(e){
        console.error('[PorchLive] write failed:', e.message);
      });
    }
  };
})();
