// =============================================================
// Sandbox mode — a safe copy of the dashboard to show people.
//
// Open any page with ?sandbox on the end, e.g.
//     https://your-site/index.html?sandbox
// and that browser tab switches to sandbox mode:
//   - cloud sync is switched off, so nothing is read from or
//     written to the real Supabase data
//   - everything is saved under a separate "sandbox:" prefix in
//     the browser, so the real local data is never touched
//   - the pages start with made-up sample data
// The mode sticks for the tab while you move between pages. Use
// the Exit button in the banner (or ?exit-sandbox) to leave.
//
// This file must load BEFORE the Supabase script and the page's
// own scripts, so keep it first in <head> and without `defer`.
// =============================================================
(function () {
  'use strict';

  var FLAG = 'dash_sandbox';
  var qs;
  try { qs = new URLSearchParams(window.location.search); } catch (e) { return; }
  try {
    if (qs.has('exit-sandbox')) sessionStorage.removeItem(FLAG);
    else if (qs.has('sandbox')) sessionStorage.setItem(FLAG, '1');
  } catch (e) {}
  var on = false;
  try { on = sessionStorage.getItem(FLAG) === '1'; } catch (e) {}
  if (!on) return;
  window.DASH_SANDBOX = true;

  // ---- 1. Switch cloud sync off: every page skips sync when
  //         window.supabase is missing. ----
  try {
    Object.defineProperty(window, 'supabase', {
      get: function () { return undefined; },
      set: function () {},
      configurable: false
    });
  } catch (e) {}

  // ---- 2. Keep sandbox data apart from the real data. ----
  var P = 'sandbox:';
  var SP = Storage.prototype;
  var rawGet = SP.getItem, rawSet = SP.setItem, rawRemove = SP.removeItem, rawKey = SP.key;
  var rawLength = Object.getOwnPropertyDescriptor(SP, 'length');
  function isLocal(s) { try { return s === window.localStorage; } catch (e) { return false; } }
  function sandboxKeys(s) {
    var out = [], n = rawLength.get.call(s);
    for (var i = 0; i < n; i++) {
      var k = rawKey.call(s, i);
      if (k && k.indexOf(P) === 0) out.push(k.slice(P.length));
    }
    return out;
  }
  SP.getItem = function (k) { return rawGet.call(this, isLocal(this) ? P + k : k); };
  SP.setItem = function (k, v) { return rawSet.call(this, isLocal(this) ? P + k : k, v); };
  SP.removeItem = function (k) { return rawRemove.call(this, isLocal(this) ? P + k : k); };
  SP.key = function (i) {
    if (!isLocal(this)) return rawKey.call(this, i);
    var keys = sandboxKeys(this);
    return i < keys.length ? keys[i] : null;
  };
  Object.defineProperty(SP, 'length', {
    get: function () { return isLocal(this) ? sandboxKeys(this).length : rawLength.get.call(this); },
    configurable: true
  });

  // ---- 3. Sample data (made up), seeded once per browser. ----
  function pad(n) { return String(n).padStart(2, '0'); }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function daysAgo(n) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; }
  function put(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  function seed() {
    // Fitness — Push / Pull / Legs / Rest, four weeks of history.
    // Today is set up as a Push day so there is something to log.
    var ex = [
      { id: 'sb_bench', name: 'Bench press', day: 'push', sets: 2, repMin: 5, repMax: 8, intensity: '1 RIR', step: 2.5, w: 70 },
      { id: 'sb_ohp', name: 'Overhead press', day: 'push', sets: 2, repMin: 6, repMax: 10, intensity: 'Technical failure', step: 2.5, w: 40 },
      { id: 'sb_push', name: 'Triceps pushdown', day: 'push', sets: 2, repMin: 8, repMax: 12, step: 2.5, w: 25 },
      { id: 'sb_pull', name: 'Pull-ups', day: 'pull', sets: 2, repMin: 5, repMax: 10, intensity: 'Technical failure', step: 1, bw: true, w: 0 },
      { id: 'sb_row', name: 'Barbell row', day: 'pull', sets: 2, repMin: 6, repMax: 10, intensity: '1 RIR', step: 2.5, w: 60 },
      { id: 'sb_curl', name: 'Dumbbell curl', day: 'pull', sets: 2, perSide: true, repMin: 8, repMax: 12, step: 2, w: 12 },
      { id: 'sb_squat', name: 'Back squat', day: 'legs', sets: 2, repMin: 5, repMax: 8, intensity: '1 RIR', step: 5, w: 90 },
      { id: 'sb_rdl', name: 'Romanian deadlift', day: 'legs', sets: 2, repMin: 6, repMax: 10, intensity: '1 RIR', step: 5, w: 80 },
      { id: 'sb_press', name: 'Leg press', day: 'legs', sets: 2, repMin: 8, repMax: 12, step: 5, w: 140 }
    ];
    var rotation = ['push', 'pull', 'legs', 'rest'];
    var logs = {}, done = {};
    for (var ago = 28; ago >= 1; ago--) {
      var split = rotation[((-ago) % 4 + 4) % 4]; // today (ago = 0) is index 0 = push
      if (split === 'rest') continue;
      var d = daysAgo(ago), iso = dayKey(d) + 'T12:00:00.000Z';
      var visit = Math.floor((28 - ago) / 4); // 0..6, how many times this split has come round
      done[dayKey(d)] = iso;
      ex.forEach(function (e) {
        if (e.day !== split) return;
        var span = e.repMax - e.repMin + 1;
        var reps = e.repMin + (visit % span);
        var weight = e.bw ? 0 : e.w + Math.floor(visit / span) * e.step;
        if (e.bw) reps = e.repMin + Math.min(visit, span);
        (logs[e.id] = logs[e.id] || []).push({ weight: weight, reps: reps, date: iso });
        logs[e.id].push({ weight: weight, reps: Math.max(1, reps - 1), date: iso });
      });
    }
    put('po_coach_v1', {
      units: 'kg',
      gyms: [{ id: 'home', name: 'Sample Gym' }],
      days: [{ id: 'push', name: 'Push' }, { id: 'pull', name: 'Pull' }, { id: 'legs', name: 'Legs' }],
      exercises: ex.map(function (e) {
        var o = Object.assign({ gym: 'both', startWeight: e.w }, e);
        delete o.w;
        return o;
      }),
      logs: logs,
      filterGym: 'home',
      filterDay: 'push',
      splitRotation: ['Push', 'Pull', 'Legs', 'Rest'],
      splitAnchor: { date: dayKey(daysAgo(0)), index: 0 },
      importVersion: 'tracker-2026-11-22' // skip the real programme/history import
    });
    put('po_coach_workout_done', done);
    var weights = [];
    for (var i = 27; i >= 0; i -= 3) {
      weights.push({ dateKey: dayKey(daysAgo(i)), weight: Math.round((78 + (27 - i) * 0.04) * 10) / 10 });
    }
    put('po_coach_weights', weights);

    // Health — daily and weekly stack.
    put('stack:version', 5);
    put('stack:items', [
      { id: 'sb1', name: 'Creatine monohydrate', dose: '5g', window: 'morning', note: 'Daily, timing does not matter', tag: null, ordered: true },
      { id: 'sb2', name: 'Vitamin D3', dose: '2000 IU', window: 'lunch', note: 'With biggest meal', tag: null, ordered: true },
      { id: 'sb3', name: 'Omega-3 fish oil', dose: '2 caps', window: 'lunch', note: 'With food', tag: null, ordered: true },
      { id: 'sb4', name: 'Magnesium glycinate', dose: '300mg', window: 'evening', note: 'Before bed', tag: null, ordered: true }
    ]);
    put('wstack:items', [
      { id: 'sbw1', name: 'Meal prep', dose: '', day: 6 },
      { id: 'sbw2', name: 'Weigh-in and progress photo', dose: '', day: 0 },
      { id: 'sbw3', name: 'Vitamin B12', dose: '1000mcg', day: 'any' }
    ]);

    // Main — today's goals. Days roll over at 6 AM, like the real page.
    var now = new Date();
    if (now.getHours() < 6) now.setDate(now.getDate() - 1);
    put('goals:' + dayKey(now), [
      { text: 'Morning workout', done: true },
      { text: 'Reply to emails', done: true },
      { text: 'Read 20 pages', done: false },
      { text: 'Plan tomorrow', done: false }
    ]);
  }

  try {
    if (!localStorage.getItem('__seeded')) { seed(); localStorage.setItem('__seeded', '1'); }
  } catch (e) {}

  // ---- 4. Banner so it is obvious this is not the real thing. ----
  function leave(reset) {
    try {
      if (reset) {
        sandboxKeys(window.localStorage).forEach(function (k) { localStorage.removeItem(k); });
      } else {
        sessionStorage.removeItem(FLAG);
      }
    } catch (e) {}
    window.location.href = window.location.pathname;
  }
  function banner() {
    if (document.getElementById('sandboxBanner')) return;
    try { if (window.self !== window.top) return; } catch (e) { return; }
    var bar = document.createElement('div');
    bar.id = 'sandboxBanner';
    bar.style.cssText = 'position:relative;z-index:60;display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;justify-content:center;' +
      'padding:8px 12px;background:#F2C063;color:#0a0a0b;text-align:center;' +
      'font:600 12px/1.3 -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Roboto,sans-serif;';
    var msg = document.createElement('span');
    msg.textContent = 'Sandbox: sample data. Nothing here is saved to the real dashboard.';
    bar.appendChild(msg);
    [['Reset', true], ['Exit', false]].forEach(function (b) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = b[0];
      btn.style.cssText = 'font:inherit;color:inherit;background:rgba(0,0,0,0.12);border:1px solid rgba(0,0,0,0.25);' +
        'border-radius:6px;padding:3px 10px;cursor:pointer;';
      btn.addEventListener('click', function () { leave(b[1]); });
      bar.appendChild(btn);
    });
    document.body.insertBefore(bar, document.body.firstChild);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', banner);
  else banner();
})();
