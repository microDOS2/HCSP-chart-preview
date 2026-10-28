// ═══ Chart 5 — "Four rising platforms" (real 3D, Three.js r147 vendored) ═══
// RPT.scale_ladder — four plant sizes (10 / 100 / 1,000 / 1,900 m³/day) as four
// rising 3D platforms, each carrying a floating energy-range column
// (130–250 / 80–160 / 45–110 / 35–88 kWh/m³) and best-fit industry tags.
// Continuous animation on load: an eased camera tour visits each platform while
// energy particles rise inside each column; the user can click any platform to
// jump straight to it. PAUSE button · Reading Mode / prefers-reduced-motion →
// static assembled frame · rendering paused offscreen (IntersectionObserver).
// Self-contained IIFE: exposes window.C3Scale.render(hostEl). Injects its own CSS.
// Integration: vendor/three.min.js + vendor/OrbitControls.js + js/data.js +
// js/sources.js must load first; host is an empty element (e.g. #host-scale-3d).
(function () {
  "use strict";

  /* ── injected styles (namespaced .c3s-*) ── */
  var CSS = `
.c3s-root{--ink:#10222f;--ink-md:#42566a;--ink-lo:#6b7f92;--line:#dbe2ea;--bg:#fff;--bg-soft:#f5f7fa;
--blue:#2251ff;--green:#0d8a5f;--red:#c22f4e;--amber:#b57a00;
--mono:"SFMono-Regular",ui-monospace,"Roboto Mono",Menlo,Consolas,monospace;
font-family:"Helvetica Neue",Arial,"Segoe UI",sans-serif;color:var(--ink);max-width:1180px;margin:0 auto}
.c3s-sec{background:var(--bg);border:1px solid var(--line);border-radius:8px;margin:0 0 28px;padding:18px 20px 16px;box-sizing:border-box}
.c3s-kicker{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-lo);margin:0 0 4px}
.c3s-title{font-size:19px;line-height:1.3;font-weight:700;margin:0 0 6px}
.c3s-howto{font-size:13px;line-height:1.5;color:var(--ink-md);margin:0 0 6px;max-width:72ch}
.c3s-srcline{font-family:var(--mono);font-size:10.5px;line-height:1.6;color:var(--ink-lo);margin:0 0 8px;word-wrap:break-word}
.c3s-k{display:inline-block;border:1px solid var(--line);border-radius:3px;padding:0 4px;margin:0 2px 2px 0;background:var(--bg-soft);white-space:nowrap}
a.c3s-k{background:#eef2ff;border-color:#c8d4ff;color:var(--blue);text-decoration:none}
a.c3s-k:hover{text-decoration:underline}
.c3s-tools{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px;align-items:center}
.c3s-btn{font-family:var(--mono);font-size:12px;padding:5px 12px;border:1px solid var(--line);border-radius:6px;background:#fff;color:var(--ink-md);cursor:pointer}
.c3s-btn:hover{border-color:var(--blue);color:var(--blue)}
.c3s-btn[aria-pressed="true"]{background:var(--blue);border-color:var(--blue);color:#fff}
.c3s-btn.c3s-pause{border-color:var(--amber);color:var(--amber);min-width:92px}
.c3s-btn.c3s-pause[aria-pressed="true"]{background:var(--amber);border-color:var(--amber);color:#fff}
.c3s-chip{font-size:12px;padding:5px 10px;border:1px solid var(--line);border-radius:14px;background:var(--bg-soft);color:var(--ink-md);cursor:pointer}
.c3s-chip[aria-pressed="true"]{background:#eef2ff;border-color:var(--blue);color:var(--blue);font-weight:600}
.c3s-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:14px}
.c3s-stage-col{position:relative;min-height:560px}
.c3s-stage{width:100%;height:560px;display:block;border:1px solid var(--line);border-radius:8px;background:linear-gradient(#fbfcfe,#eef2f7);cursor:grab;touch-action:none}
.c3s-stage:active{cursor:grabbing}
.c3s-hint{font-family:var(--mono);font-size:10px;letter-spacing:.12em;color:var(--ink-lo);margin:6px 2px 0;text-transform:uppercase}
.c3s-label{position:absolute;left:-999px;top:-999px;transform:translate(-50%,-120%);font-size:12px;font-weight:600;color:var(--ink-md);
background:rgba(255,255,255,.92);border:1px solid var(--line);border-radius:4px;padding:2px 7px;white-space:nowrap;pointer-events:none;box-shadow:0 1px 3px rgba(16,34,47,.08)}
.c3s-label.c3s-lb-big{font-size:13px;font-weight:700;color:var(--ink)}
.c3s-label.c3s-lb-blue{color:var(--blue);border-color:#c8d4ff;background:rgba(238,242,255,.94)}
.c3s-label.c3s-lb-red{color:var(--red);border-color:#f2c7d0;background:rgba(255,255,255,.94)}
.c3s-label.c3s-lb-dim{font-weight:400;color:var(--ink-lo)}
.c3s-panel{border:1px solid var(--line);border-radius:8px;background:var(--bg-soft);padding:14px 16px;font-size:13px;line-height:1.55;color:var(--ink-md);overflow-y:auto;max-height:560px}
.c3s-panel h3{font-size:16px;margin:0 0 4px;color:var(--ink)}
.c3s-panel h4{font-size:12px;font-family:var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-lo);margin:14px 0 4px}
.c3s-panel p{margin:0 0 8px}
.c3s-panel ul{margin:0 0 8px;padding-left:18px}
.c3s-stat{display:inline-block;font-family:var(--mono);font-size:12px;border:1px solid var(--line);border-radius:4px;padding:2px 7px;margin:0 4px 6px 0;background:#fff;color:var(--ink)}
.c3s-tag-tbd{display:inline-block;font-size:11px;font-weight:700;border:1px dashed var(--amber);color:var(--amber);border-radius:4px;padding:2px 7px;margin:0 4px 6px 0;background:#fffaf0}
.c3s-warn{border-left:3px solid var(--red);background:#fdf3f5;padding:7px 10px;border-radius:0 6px 6px 0;margin:8px 0}
.c3s-table-wrap{margin-top:12px;overflow-x:auto}
.c3s-table{border-collapse:collapse;width:100%;font-size:12.5px}
.c3s-table th{font-family:var(--mono);font-size:11px;letter-spacing:.05em;text-align:left;color:var(--ink-lo);border-bottom:2px solid var(--line);padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap}
.c3s-table th:hover{color:var(--blue)}
.c3s-table td{border-bottom:1px solid #eef1f6;padding:6px 8px;vertical-align:top;color:var(--ink-md)}
.c3s-table tr:hover td{background:#f7f9fc}
.c3s-table td.c3s-num{font-family:var(--mono);text-align:right}
.c3s-foot{font-size:11.5px;color:var(--ink-lo);margin:10px 0 0;line-height:1.5}
@media (max-width:980px){.c3s-grid{grid-template-columns:1fr}.c3s-panel{max-height:none}}
@media (prefers-reduced-motion:reduce){.c3s-root *{animation:none!important;transition:none!important}}
`;

  var esc = function (s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };
  var SRC_MAP = {};
  (window.SRCS || []).forEach(function (s) { SRC_MAP[s.k] = s; });
  function srcLinks(ks) {
    if (!ks || !ks.length) return "";
    return ks.map(function (k) {
      var s = SRC_MAP[k];
      if (!s) return '<span class="c3s-k">' + esc(k) + "</span>";
      var lab = esc(k) + (s.date ? " · " + esc(s.date) : "");
      var title = esc(s.cite || "") + (s.fact ? " — " + esc(s.fact) : "");
      if (s.url) return '<a class="c3s-k" href="' + esc(s.url) + '" target="_blank" rel="noopener" title="' + title + '">' + lab + "</a>";
      return '<span class="c3s-k" title="' + title + '">' + lab + "</span>";
    }).join(" ");
  }

  // qualitative best-fit summary derived from each rung's note + scale_meta
  // (same mapping the 2D energy module uses)
  var SCALE_FIT = {
    10:   "Pilot and demonstration sites; small concentrate generators (the AirSCWO 6 field unit is this class).",
    100:  "Industrial hubs and biosolids (sewage sludge) — the rung where the technology enters treatment-market price territory.",
    1000: "Plant-scale, self-fueling sites where a vapor power cycle pays: refinery residuals, distillery spent wash, large biosolids.",
    1900: "Regional-hub concept only (500k gpd). No single train above ~306 t/day has ever operated — this rung is a study, not a plant."
  };

  function render(host) {
    if (!host) return;
    if (!window.THREE || !window.RPT || !RPT.scale_ladder) {
      host.innerHTML = "<p style='padding:24px;font-size:13px'>3D scale ladder unavailable — Three.js or report data not loaded.</p>";
      return;
    }
    if (!document.getElementById("c3s-style")) {
      var st = document.createElement("style"); st.id = "c3s-style"; st.textContent = CSS;
      document.head.appendChild(st);
    }
    var D = RPT.scale_ladder, M = RPT.scale_meta || {};
    var REDUCED = false;
    try { REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
    function stillMode() { return REDUCED || document.documentElement.classList.contains("reader"); }

    /* ── DOM scaffold ── */
    var root = document.createElement("div"); root.className = "c3s-root";
    var sec = document.createElement("section"); sec.className = "c3s-sec";
    root.appendChild(sec); host.appendChild(root);
    sec.innerHTML =
      '<div class="c3s-head">' +
        '<p class="c3s-kicker">Chart 5 · The scale ladder · real 3D</p>' +
        '<h3 class="c3s-title">Four sizes of the same machine — bigger plants need less energy per cubic meter</h3>' +
        '<p class="c3s-howto">What this shows: each rising platform is one plant size (10, 100, 1,000 and 1,900 cubic meters of waste a day). ' +
        'The blue column floating above it is the range of electricity needed to treat one cubic meter at that size — it shrinks as the plant grows. ' +
        'The camera tours the four platforms on its own; click any platform to jump straight to it.</p>' +
        '<p class="c3s-srcline">Sources: ' + srcLinks(["K70", "K18", "K71", "K72", "K76"]) + "</p>" +
      "</div>";

    var tools = document.createElement("div"); tools.className = "c3s-tools"; sec.appendChild(tools);
    var pauseBtn = document.createElement("button");
    pauseBtn.type = "button"; pauseBtn.className = "c3s-btn c3s-pause";
    pauseBtn.setAttribute("aria-pressed", "false"); pauseBtn.textContent = "❚❚ Pause";
    tools.appendChild(pauseBtn);
    var tourBtn = document.createElement("button");
    tourBtn.type = "button"; tourBtn.className = "c3s-btn";
    tourBtn.setAttribute("aria-pressed", "true"); tourBtn.textContent = "Camera tour: on";
    tools.appendChild(tourBtn);
    var tableBtn = document.createElement("button");
    tableBtn.type = "button"; tableBtn.className = "c3s-btn";
    tableBtn.setAttribute("aria-pressed", "false"); tableBtn.textContent = "Table view";
    tools.appendChild(tableBtn);
    var chipBtns = D.map(function (d, i) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "c3s-chip";
      b.textContent = d.name + " · " + d.m3d.toLocaleString("en-US") + " m³/day";
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () { select(i, true); });
      tools.appendChild(b);
      return b;
    });

    var grid = document.createElement("div"); grid.className = "c3s-grid"; sec.appendChild(grid);
    var stageCol = document.createElement("div"); stageCol.className = "c3s-stage-col"; grid.appendChild(stageCol);
    var canvas = document.createElement("canvas"); canvas.className = "c3s-stage";
    canvas.setAttribute("aria-label", "Interactive 3D scene: four rising platforms show plant sizes of 10, 100, 1000 and 1900 cubic meters per day, each with a floating energy range column");
    stageCol.appendChild(canvas);
    var hint = document.createElement("p"); hint.className = "c3s-hint";
    hint.textContent = "Camera tours automatically · drag to orbit · scroll to zoom · click a platform";
    stageCol.appendChild(hint);
    var panel = document.createElement("aside"); panel.className = "c3s-panel";
    panel.setAttribute("aria-live", "polite"); grid.appendChild(panel);
    var tableWrap = document.createElement("div"); tableWrap.className = "c3s-table-wrap";
    tableWrap.style.display = "none"; sec.appendChild(tableWrap);
    var foot = document.createElement("p"); foot.className = "c3s-foot";
    foot.textContent = "Energy figures are energy-balance model outputs, not bills. Capital cost is withheld: earlier figures came from a modeled industry stack, not the manufacturer — the HCSP cost model is pending (TBD).";
    sec.appendChild(foot);

    /* ── three.js scene ── */
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true,
        preserveDrawingBuffer: /[?&]qa=1\b/.test(location.search) /* QA frame capture */ });
    var QA_THROTTLE = /[?&]qa=1\b/.test(location.search), lastRender = 0;
    } catch (e) {
      stageCol.innerHTML = "<p style='padding:40px;font-size:13px'>WebGL is unavailable in this browser — the 3D scale ladder cannot start.</p>";
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xf2f5f9, 34, 90);
    var camera = new THREE.PerspectiveCamera(40, 2, 0.1, 200);
    camera.position.set(0, 13, 30);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xdde4ec, 0.95));
    var sun = new THREE.DirectionalLight(0xffffff, 0.75); sun.position.set(8, 14, 10); scene.add(sun);

    var MAT = {
      plat:  new THREE.MeshStandardMaterial({ color: 0xdde4ec, roughness: 0.7, metalness: 0.15 }),
      platHi:new THREE.MeshStandardMaterial({ color: 0xc8d4ff, roughness: 0.6, metalness: 0.2 }),
      trim:  new THREE.MeshStandardMaterial({ color: 0x2251ff, roughness: 0.4, metalness: 0.2 }),
      band:  new THREE.MeshStandardMaterial({ color: 0x2251ff, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.34 }),
      bandHi:new THREE.MeshStandardMaterial({ color: 0x2251ff, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.62 }),
      edge:  new THREE.LineBasicMaterial({ color: 0x2251ff }),
      axis:  new THREE.MeshBasicMaterial({ color: 0x6b7f92 }),
      ground:new THREE.MeshBasicMaterial({ color: 0xeef1f6, transparent: true, opacity: 0.85 })
    };

    var group = new THREE.Group(); scene.add(group);
    var clickable = [], labels = [], particles = [], bands = [], plats = [];

    var ground = new THREE.Mesh(new THREE.CircleGeometry(30, 64), MAT.ground);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.06; group.add(ground);
    var gridH = new THREE.GridHelper(64, 32, 0xd8dfe9, 0xe8edf4);
    gridH.position.y = -0.05; group.add(gridH);

    // layout — platforms widen and rise with scale (log-ish progression, visually honest)
    var X0 = -14.4, DX = 9.6;
    var KMAX = 260; // kWh/m³ axis max
    function ky(kwh) { return 0.9 + (kwh / KMAX) * 5.4; } // height above platform top offset

    D.forEach(function (d, i) {
      var x = X0 + i * DX;
      var w = 2.6 + i * 1.7;          // footprint grows with class
      var hp = 0.9 + i * 0.55;        // podium height grows with class
      var g = new THREE.Group(); g.position.set(x, 0, 0); group.add(g);

      var pod = new THREE.Mesh(new THREE.BoxGeometry(w, hp, w), MAT.plat.clone());
      pod.position.y = hp / 2; g.add(pod);
      var trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.12, w + 0.1), MAT.trim);
      trim.position.y = hp + 0.06; g.add(trim);
      plats.push({ pod: pod, trim: trim, w: w, hp: hp, x: x });

      // energy-range column: floats from lo to hi above the podium
      var yLo = hp + ky(d.kwh[0]), yHi = hp + ky(d.kwh[1]);
      var bh = Math.max(0.3, yHi - yLo);
      var band = new THREE.Mesh(new THREE.BoxGeometry(1.7, bh, 1.7), MAT.band.clone());
      band.position.set(0, (yLo + yHi) / 2, 0); g.add(band);
      var eg = new THREE.LineSegments(new THREE.EdgesGeometry(band.geometry), MAT.edge);
      band.add(eg);
      bands.push(band);
      // faint stem from podium to the range floor — the "below the range" zone
      var stem = new THREE.Mesh(new THREE.BoxGeometry(0.18, Math.max(0.05, yLo - hp), 0.18),
        new THREE.MeshBasicMaterial({ color: 0x9db4ff, transparent: true, opacity: 0.4 }));
      stem.position.set(0, hp + (yLo - hp) / 2, 0); g.add(stem);

      // rising energy particles inside the column (continuous motion)
      for (var p = 0; p < 6; p++) {
        var s = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8),
          new THREE.MeshBasicMaterial({ color: 0x2251ff }));
        s.userData = { t: p / 6, yLo: yLo, yHi: yHi, x0: x };
        g.add(s); particles.push(s);
      }

      pod.userData.idx = trim.userData.idx = i;
      clickable.push(pod, trim);

      // floating labels (DOM billboards — always face camera)
      label(d.name + " — " + d.m3d.toLocaleString("en-US") + " m³/day", "c3s-lb-big", x, yHi + 0.85, 0);
      label(d.kwh[0] + "–" + d.kwh[1] + " kWh/m³", "c3s-lb-blue", x, yHi + 0.25, 0);
      label("energy per m³ falls as plants grow", "c3s-lb-dim", x, yLo - 0.5, 0);
    });

    // scale-up caution on the largest rung
    var lastX = X0 + (D.length - 1) * DX, lastHp = 0.9 + (D.length - 1) * 0.55;
    var lastKhi = D[D.length - 1].kwh[1];
    label("Caution: largest single train ever operated ≈ 306 t/day — the top platform is a study, not a plant",
      "c3s-lb-red", lastX, lastHp + ky(lastKhi) + 1.55, 0);

    // kWh axis pole to the left of the first platform
    var axX = X0 - 3.6, axTop = ky(KMAX) + 0.9;
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, axTop, 8), MAT.axis);
    pole.position.set(axX, axTop / 2, 0); group.add(pole);
    [0, 100, 200].forEach(function (k) {
      var tick = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.045, 0.045), MAT.axis);
      tick.position.set(axX + 0.25, ky(k) + 0.9, 0); group.add(tick);
      label(k + " kWh/m³", "c3s-lb-dim", axX + 0.35, ky(k) + 1.05, 0, 26, 0);
    });

    function label(text, cls, x, y, z, dx, dy) {
      var el = document.createElement("div");
      el.className = "c3s-label" + (cls ? " " + cls : "");
      el.textContent = text;
      stageCol.appendChild(el);
      labels.push({ el: el, v: new THREE.Vector3(x, y, z), dx: dx || 0, dy: dy || 0 });
    }

    /* ── detail panel ── */
    var selected = -1;
    function select(i, jump) {
      selected = i;
      var d = D[i];
      chipBtns.forEach(function (b, j) { b.setAttribute("aria-pressed", j === i ? "true" : "false"); });
      bands.forEach(function (b, j) { b.material = j === i ? MAT.bandHi : MAT.band; });
      plats.forEach(function (p, j) { p.pod.material = j === i ? MAT.platHi : MAT.plat; });
      panel.innerHTML =
        "<h3>" + esc(d.name) + " — " + d.m3d.toLocaleString("en-US") + " m³/day</h3>" +
        '<span class="c3s-stat">Energy ' + d.kwh[0] + "–" + d.kwh[1] + " kWh/m³</span>" +
        '<span class="c3s-tag-tbd">Capital cost withheld — TBD (manufacturer cost model pending)</span>' +
        "<h4>What this size means</h4><p>" + esc(d.note) + "</p>" +
        "<h4>Best-fit industries</h4><p>" + esc(SCALE_FIT[d.m3d] || "—") + "</p>" +
        "<h4>Scale-up caution</h4><div class='c3s-warn'>" + esc(M.limit || "") + "</div>" +
        "<h4>Why scale helps</h4><p>" + esc(M.physics || "") + "</p>" +
        "<p>" + srcLinks((d.src || []).concat(M.src || [])) + "</p>";
      if (jump) { tourTo(i + 1); setTour(true); }
      dirty = true; poke();
    }
    function overview() {
      selected = -1;
      chipBtns.forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
      bands.forEach(function (b) { b.material = MAT.band; });
      plats.forEach(function (p) { p.pod.material = MAT.plat; });
      panel.innerHTML =
        "<h3>How to read the four platforms</h3>" +
        "<p>Each platform is a plant size. The blue column above it is the electricity needed to treat one cubic meter of waste water at that size — it falls from up to 250 kWh/m³ at the smallest size to as low as 35 kWh/m³ at the largest.</p>" +
        "<h4>Capital cost</h4><p><span class='c3s-tag-tbd'>Withheld — TBD</span> Earlier cost figures came from a modeled industry stack, not the manufacturer. The HCSP cost model is pending.</p>" +
        "<h4>Scale-up caution</h4><div class='c3s-warn'>" + esc(M.limit || "") + "</div>" +
        "<h4>Cost-scaling basis (not HCSP pricing)</h4><p>" + esc(M.exponent || "") + "</p>" +
        "<p>Click a platform — or one of the chips above — for its detail.</p>" +
        "<p>" + srcLinks(M.src || []) + "</p>";
      dirty = true; poke();
    }

    /* ── sortable table view ── */
    var tableBuilt = false;
    function buildTable() {
      var cols = [
        { lab: "Class", key: function (r) { return r.name; }, cell: function (r) { return "<b>" + esc(r.name) + "</b>"; } },
        { lab: "Capacity (m³/day)", num: true, key: function (r) { return r.m3d; }, cell: function (r) { return r.m3d.toLocaleString("en-US"); } },
        { lab: "kWh/m³ low", num: true, key: function (r) { return r.kwh[0]; }, cell: function (r) { return r.kwh[0]; } },
        { lab: "kWh/m³ high", num: true, key: function (r) { return r.kwh[1]; }, cell: function (r) { return r.kwh[1]; } },
        { lab: "Capital cost", key: function () { return ""; }, cell: function () { return '<span class="c3s-tag-tbd">Withheld — TBD</span>'; } },
        { lab: "Best-fit industries", key: function (r) { return SCALE_FIT[r.m3d] || ""; }, cell: function (r) { return esc(SCALE_FIT[r.m3d] || "—"); } },
        { lab: "Note", key: function (r) { return r.note; }, cell: function (r) { return esc(r.note); } },
        { lab: "Sources", key: function (r) { return r.src.join(""); }, cell: function (r) { return srcLinks(r.src); } }
      ];
      var sortI = 1, sortDir = 1;
      var tbl = document.createElement("table"); tbl.className = "c3s-table";
      function draw() {
        var rows = D.slice().sort(function (a, b) {
          var va = cols[sortI].key(a), vb = cols[sortI].key(b);
          return (va < vb ? -1 : va > vb ? 1 : 0) * sortDir;
        });
        tbl.innerHTML = "<thead><tr>" + cols.map(function (c, i) {
          return "<th data-i='" + i + "'>" + esc(c.lab) + (i === sortI ? (sortDir > 0 ? " ▲" : " ▼") : "") + "</th>";
        }).join("") + "</tr></thead><tbody>" + rows.map(function (r) {
          return "<tr data-m3d='" + r.m3d + "'>" + cols.map(function (c) {
            return "<td class='" + (c.num ? "c3s-num" : "") + "'>" + c.cell(r) + "</td>";
          }).join("") + "</tr>";
        }).join("") + "</tbody>";
        tbl.querySelectorAll("th").forEach(function (th) {
          th.addEventListener("click", function () {
            var i = +th.dataset.i;
            if (i === sortI) sortDir *= -1; else { sortI = i; sortDir = 1; }
            draw();
          });
        });
        tbl.querySelectorAll("tbody tr").forEach(function (tr) {
          tr.addEventListener("click", function () {
            var i = D.findIndex(function (r) { return String(r.m3d) === tr.dataset.m3d; });
            if (i >= 0) select(i, true);
          });
        });
      }
      draw();
      tableWrap.innerHTML = ""; tableWrap.appendChild(tbl);
      tableBuilt = true;
    }
    tableBtn.addEventListener("click", function () {
      var show = tableWrap.style.display === "none";
      tableWrap.style.display = show ? "" : "none";
      tableBtn.setAttribute("aria-pressed", show ? "true" : "false");
      if (show && !tableBuilt) buildTable();
    });

    /* ── camera tour ── */
    // waypoints: 0 = overview, 1..4 = platforms
    var waypoints = [{ pos: new THREE.Vector3(0, 13, 30), tgt: new THREE.Vector3(0, 3.2, 0) }];
    D.forEach(function (d, i) {
      var p = plats[i];
      waypoints.push({
        pos: new THREE.Vector3(p.x + 5.5, p.hp + 7.5, 12.5),
        tgt: new THREE.Vector3(p.x, p.hp + 2.6, 0)
      });
    });
    var tourOn = true, tourI = 0, tourPhase = "dwell", tourT = 0;
    var DWELL = 4.2, MOVE = 2.4;
    var fromPos = camera.position.clone(), fromTgt = new THREE.Vector3(0, 3.2, 0);
    function tourTo(i) {
      fromPos.copy(camera.position); fromTgt.copy(controls.target);
      tourI = i % waypoints.length; tourPhase = "move"; tourT = 0;
      // when motion is off (paused / reading mode), snap instantly so a click still "jumps"
      if (paused || stillMode()) {
        var w = waypoints[tourI];
        camera.position.copy(w.pos); controls.target.copy(w.tgt);
        tourPhase = "dwell"; dirty = true; poke();
      }
    }
    function setTour(on) {
      tourOn = on;
      tourBtn.setAttribute("aria-pressed", on ? "true" : "false");
      tourBtn.textContent = "Camera tour: " + (on ? "on" : "off");
      controls.autoRotate = false;
    }
    function ease(u) { return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }
    function tourStep(dt) {
      if (!tourOn) return;
      tourT += dt;
      if (tourPhase === "move") {
        var u = Math.min(1, tourT / MOVE), e = ease(u);
        var w = waypoints[tourI];
        camera.position.copy(fromPos).lerp(w.pos, e);
        controls.target.copy(fromTgt).lerp(w.tgt, e);
        if (u >= 1) { tourPhase = "dwell"; tourT = 0; }
      } else {
        // dwell: slow drift around the current target so motion never stops
        var w2 = waypoints[tourI];
        var ang = tourT * 0.12;
        var r = camera.position.clone().sub(w2.tgt);
        var rr = Math.hypot(r.x, r.z), phi = Math.atan2(r.z, r.x) + dt * 0.1;
        camera.position.set(w2.tgt.x + rr * Math.cos(phi), camera.position.y, w2.tgt.z + rr * Math.sin(phi));
        if (tourT >= DWELL) { tourI = (tourI + 1) % waypoints.length; tourTo(tourI); }
      }
    }

    /* ── controls ── */
    var controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.target.set(0, 3.2, 0);
    controls.minDistance = 6; controls.maxDistance = 46;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.addEventListener("start", function () { if (tourOn) setTour(false); });

    // QA hook: world→screen projection for automated click tests
    canvas._project = function (x, y, z) {
      var r = canvas.getBoundingClientRect();
      var v = new THREE.Vector3(x, y, z).project(camera);
      return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height, behind: v.z > 1 };
    };

    var paused = false;
    pauseBtn.addEventListener("click", function () {
      paused = !paused;
      pauseBtn.setAttribute("aria-pressed", paused ? "true" : "false");
      pauseBtn.textContent = paused ? "▶ Resume" : "❚❚ Pause";
      poke();
    });

    // click (not drag) → select platform
    var ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), downAt = null;
    canvas.addEventListener("pointerdown", function (e) { downAt = [e.clientX, e.clientY]; });
    canvas.addEventListener("pointerup", function (e) {
      if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) { downAt = null; return; }
      downAt = null;
      var r = canvas.getBoundingClientRect();
      ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ptr, camera);
      var hit = ray.intersectObjects(clickable, false)[0];
      if (hit && hit.object.userData.idx != null) select(hit.object.userData.idx, true);
    });

    /* ── render loop: continuous unless paused / reading mode / offscreen ── */
    var dirty = true, inView = false, raf = 0, lastT = 0;
    function poke() { if (inView && !raf) raf = requestAnimationFrame(frame); }
    controls.addEventListener("change", function () { dirty = true; poke(); });
    function resize() {
      var w = stageCol.clientWidth, h = canvas.clientHeight || 560;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      dirty = true; poke();
    }
    addEventListener("resize", resize, { passive: true });

    function animate(t) {
      var dt = Math.min(0.05, (t - lastT) / 1000 || 0); lastT = t;
      tourStep(dt);
      particles.forEach(function (s) {
        s.userData.t = (s.userData.t + dt * 0.22) % 1;
        var u = s.userData;
        s.position.set(Math.sin(u.t * 12.6) * 0.55, u.yLo + u.t * (u.yHi - u.yLo), Math.cos(u.t * 12.6) * 0.55);
      });
      dirty = true;
    }

    function placeLabels() {
      var w = stageCol.clientWidth, h = canvas.clientHeight || 560;
      // project all labels, then resolve overlaps top-to-bottom (and back up
      // if the stack hits the canvas floor) so no two labels ever collide
      var items = [];
      labels.forEach(function (L) {
        var p = L.v.clone(); p.project(camera);
        if (p.z > 1) { L.el.style.display = "none"; return; }
        L.el.style.display = "";
        var halfW = L.el.offsetWidth / 2 || 50, halfH = L.el.offsetHeight || 16;
        var px = Math.max(halfW + 4, Math.min(w - halfW - 4, (p.x * 0.5 + 0.5) * w + L.dx));
        var py = Math.max(halfH + 2, Math.min(h - halfH - 2, (-p.y * 0.5 + 0.5) * h + L.dy));
        items.push({ L: L, x: px, y: py, hw: halfW, hh: halfH });
      });
      function hits(a, b) {
        return (Math.min(a.x + a.hw, b.x + b.hw) - Math.max(a.x - a.hw, b.x - b.hw) > 2) &&
               (Math.min(a.y + a.hh, b.y + b.hh) - Math.max(a.y - a.hh, b.y - b.hh) > 2);
      }
      items.sort(function (a, b) { return a.y - b.y; });
      for (var pass = 0; pass < 4; pass++) {           // push down
        for (var i = 1; i < items.length; i++) {
          for (var j = 0; j < i; j++) {
            if (hits(items[i], items[j])) items[i].y = items[j].y + items[j].hh + items[i].hh + 4;
          }
        }
      }
      for (var pass2 = 0; pass2 < 4; pass2++) {        // push back up if past the floor
        for (var i2 = items.length - 2; i2 >= 0; i2--) {
          if (items[i2 + 1].y + items[i2 + 1].hh > h - 2) items[i2 + 1].y = h - 2 - items[i2 + 1].hh;
          if (hits(items[i2], items[i2 + 1]) && items[i2 + 1].y + items[i2 + 1].hh >= h - 2) {
            items[i2].y = items[i2 + 1].y - items[i2 + 1].hh - items[i2].hh - 4;
          }
          if (items[i2].y - items[i2].hh < 2) items[i2].y = 2 + items[i2].hh;
        }
      }
      items.forEach(function (it) {
        it.L.el.style.left = it.x + "px"; it.L.el.style.top = it.y + "px";
      });
    }

    function frame(t) {
      raf = 0;
      if (!inView) return;
      if (QA_THROTTLE && t != null && t - lastRender < 80) { raf = requestAnimationFrame(frame); return; }
      lastRender = t || 0;
      var animating = !paused && !stillMode();
      if (animating && t != null) animate(t);
      if (controls.enableDamping) controls.update();
      if (dirty || animating) {
        renderer.render(scene, camera);
        placeLabels();
        dirty = false;
      }
      if (animating) raf = requestAnimationFrame(frame);
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        inView = e.isIntersecting;
        if (inView) { dirty = true; poke(); }
      });
    }, { threshold: 0.05 });
    io.observe(root);

    overview();
    resize();
  }

  window.C3Scale = { render: render };
})();
