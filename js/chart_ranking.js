/* ═══ Chart Lab — ranking charts ═══
   window.ChartRanking = { render(hostEl, opts) }
   opts.chart: "ranking" (composite fit score, default) | "savings" (who pays the most) | "both".
   Self-contained: builds its own DOM inside hostEl. Requires js/data.js (window.RPT)
   and js/sources.js (window.SRCS / window.KLINK) loaded first. Styles: css/ranking.css.
   Plain English throughout; every figure links to a dated source anchor. */
(function () {
  "use strict";
  if (!window.RPT) { console.warn("ChartRanking: window.RPT missing — load js/data.js first."); return; }

  var RPT = window.RPT;
  var KLINK = window.KLINK || function (ids) { return (ids || []).join(", "); };
  var FIT = RPT.league_fit || {};
  var TIERS = {};
  (RPT.tiers || []).forEach(function (t) { TIERS[t.tier] = t; });
  var REDUCE = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ── merged per-industry records (composite league ⨝ savings ladder on key) ── */
  var savByKey = {};
  (RPT.savings_ladder || []).forEach(function (s) { savByKey[s.key] = s; });
  var varByName = {};
  (RPT.variants || []).forEach(function (v) { varByName[v.v] = v; });
  var RECS = (RPT.league || []).map(function (l) {
    return Object.assign({}, l, { sav: savByKey[l.key] || null });
  });
  var recByKey = {};
  RECS.forEach(function (r) { recByKey[r.key] = r; });
  var ORDER = {
    composite: RECS.map(function (r) { return r.key; }),
    savings: (RPT.savings_ladder || []).map(function (s) { return s.key; })
  };

  /* ── formatting helpers ── */
  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fv(v) { return String(parseFloat(v.toFixed(3))); }
  function fmtScore(s) { return (Math.round(s * 10) === Math.round(s) * 10) ? s.toFixed(1) : String(s); }
  function band(s) { return "$" + fv(s.lo) + "–" + fv(s.hi) + (s.plus ? "+" : "") + "/gal"; }
  function uniq(a) { var seen = {}, out = []; a.forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } }); return out; }
  var LOGMIN = 0.005, LOGMAX = 100;
  function lpct(v) { return (Math.log10(v) - Math.log10(LOGMIN)) / (Math.log10(LOGMAX) - Math.log10(LOGMIN)) * 100; }
  function cleanNote(n) {
    return String(n || "")
      .replace(/;?\s*sparse data — LOW CONFIDENCE flag\.?/i, " (sparse data — low confidence).")
      .replace("..", ".")
      .replace("Top-3 under BOTH lenses — the most robust finding.", "Top-3 under both rankings.")
      .replace("NOT a $/gal savings play", "not a per-gallon savings play");
  }
  function firstSentence(t) { var m = String(t || "").match(/^.+?[.!?](?=\s|$)/); return m ? m[0] : t; }

  /* ── per-industry regulatory drivers (dated, sourced) ── */
  var REG = {
    pfas: [
      { t: "2024 — the first federal drinking-water limits (4 parts per trillion) made PFAS removal a legal duty for every US water utility.", src: ["K5"] },
      { t: "2024 — PFAS became a designated hazardous substance under the Superfund law: anyone holding the waste stays liable until it is destroyed.", src: ["K6"] },
      { t: "2026–2028 — federal limits on PFAS in landfill wastewater are expected to finalize, making ~2,600 landfills mandatory buyers.", src: ["K7"] }
    ],
    defense: [
      { t: "Oct 2026 — federal law phases out PFAS firefighting foam across ~1,000 facilities and 6,000+ vehicles; the old stockpiles must be destroyed.", src: ["K14", "K15"] },
      { t: "The Defense Department owes more than $9.3B of PFAS cleanup across 718 installations.", src: ["K13"] }
    ],
    textile: [
      { t: "Indian courts enforce zero liquid discharge; Tirupur built 18 treatment plants (~$120M) and still has no way to destroy the leftover brine and sludge.", src: ["K42", "K39"] }
    ],
    chem: [
      { t: "Only ~24 federally licensed hazardous-waste incinerators serve the whole US, running at 88–92% of capacity.", src: ["K34"] },
      { t: "Halogenated solvents carry the strictest disposal rules — and the highest prices, $15–50+/gal.", src: ["K33"] }
    ],
    pharma: [
      { t: "2024 — the first global (WHO) guidance on antibiotic-factory waste pushes drug makers toward proven destruction.", src: ["K45"] },
      { t: "EU rules make drug and cosmetics makers pay at least 80% of micropollutant treatment, phasing in to 2045.", src: ["K38"] }
    ],
    distill: [
      { t: "Jan 2023 — India's pollution board ordered ~270 molasses distilleries to run zero-discharge plants under threat of closure.", src: ["K62", "K63"] }
    ],
    semi: [
      { t: "New US chip fabs face PFAS permit fights — every side-stream needs a documented destruction route.", src: ["K40"] }
    ],
    bio: [
      { t: "PFAS scrutiny is closing land application — the cheapest historical disposal route for sewage sludge.", src: ["K43", "K44"] }
    ],
    fnb: [
      { t: "No mandate drives this stream — it is economics only: hauling concentrated side-streams costs $45–120 per 1,000 gallons.", src: ["K46"] }
    ],
    islands: [
      { t: "No mandate — purely economics: diesel power at $0.30–0.52/kWh and water priced like desalination.", src: ["K65"] }
    ],
    og: [
      { t: "Earthquake limits on injection wells constrain Permian disposal; the Marcellus/Utica trucking corridor ($3–15/barrel) is the real opening.", src: ["K93", "K94"] }
    ],
    cea: [
      { t: "2027 — the Netherlands mandates near-zero nitrogen discharge in the world's most advanced greenhouse sector.", src: ["K35"] },
      { t: "Sewer-discharge restrictions already force hauling in parts of California.", src: ["K36"] }
    ],
    cafo: [
      { t: "Government credits (California's low-carbon standard, federal renewable-fuel credits) already pay digesters generously for the same waste.", src: ["K66"] }
    ],
    mining: [
      { t: "No mandate — sites buy when commodity prices allow; diesel ($0.30–1.10/kWh) and hauling premiums set the value.", src: ["K67"] }
    ],
    dc: [
      { t: "4–7-year grid connection queues make on-site power, cooling, and reclaimed water valuable — but the waste itself is the wrong kind.", src: ["K68", "K69"] }
    ]
  };

  /* ── which HCSP variant fits each industry ── */
  var VARMAP = {
    pfas: "HCSP-PFAS", defense: "HCSP-PFAS", pharma: "HCSP-RX", semi: "HCSP-FAB",
    chem: "HCSP-HAZ", bio: "HCSP-BIO", cea: "HCSP-AG", distill: "HCSP-VIN",
    fnb: "HCSP-TRI", islands: "HCSP-ISL", mining: "HCSP-ISL"
  };
  var VARNONE = {
    textile: "No dedicated variant yet — a standard concentrate-and-destroy train bolted behind the zero-discharge plants the courts already require.",
    og: "No dedicated variant — standard core only, in salt-first shale-region hubs; a niche pending the manufacturer's cost model.",
    cafo: "No dedicated variant — the wedge is eliminating digester leftovers in land-constrained dairy belts, not replacing digesters.",
    dc: "None — data centers buy the output (power, cooling, reclaimed water), not the machine. The plant sits at a waste-rich host across the fence."
  };

  /* ── per-lens presentation ── */
  var LENS = {
    composite: {
      title: "Which industries fit HCSP best?",
      howto: "<b>How to read this:</b> each bar is one industry — the longer the bar, the stronger the overall fit, scored out of 10 across six tests. Hover for the reason and source; click for the full story.",
      axisCap: "SCORE OUT OF 10",
      ticks: [0, 2, 4, 6, 8, 10].map(function (v) { return { pct: v * 10, lab: String(v) }; }),
      foot: "The score combines six tests: regulation, disposal price, waste strength, market size, buying speed, and proof. Fit groups: <b>Pursue now</b> (7.4 and up) · <b>Develop</b> (6.5–7.4) · <b>Conditional / regional</b> (4.5–6.4) · <b>Weak fit</b> (below 4.5). Sources: the report's industry studies (2026-09) — click any bar for dated links."
    },
    savings: {
      title: "Who pays the most to dispose of waste?",
      howto: "<b>How to read this:</b> each bar shows what existing cleanup suppliers charge per gallon of that industry's waste — the bright segment is the typical range. The scale is logarithmic: each step is ten times the one before. Hover for detail; click for the full story.",
      axisCap: "$ PER GALLON · LOG SCALE",
      ticks: [0.01, 0.1, 1, 10, 100].map(function (v) { return { pct: lpct(v), lab: "$" + fv(v) }; }),
      foot: "HCSP's own price per gallon is not set — the manufacturer has not published a cost model, so no figure is attached to HCSP. Bars show only what existing suppliers charge today. Remember: margin × volume = pool — $50/gal on a tiny stream can be a smaller prize than $5/gal on a ubiquitous one. Reference: " + KLINK(["K150"])
    }
  };

  var measureCtx = document.createElement("canvas").getContext("2d");
  function measure(el) {
    measureCtx.font = getComputedStyle(el).font;
    return measureCtx.measureText(el.textContent).width;
  }

  /* K-anchor links WITH publication dates (tooltip/detail requirement) */
  function srcDated(ids) {
    return uniq(ids).map(function (id) {
      var s = window.K ? window.K(id) : null;
      if (!s) return esc(id);
      var label = String(s.cite || "").split(",")[0].split("(")[0].trim();
      var date = s.date ? " (" + esc(s.date) + ")" : "";
      if (s.url) {
        return '<a class="src-link" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' +
          esc(s.k) + " · " + esc(label) + " ↗</a>" + date;
      }
      return '<span class="src-derived">' + esc(s.k) + " · " + esc(label) + date +
        " — derived analysis (no external source)</span>";
    }).join(" · ");
  }

  /* ── detail card (shared by side panel and expand-below) ── */
  function detailHTML(rec) {
    var s = rec.sav;
    var tier = TIERS[rec.tier];
    var vname = VARMAP[rec.key];
    var v = vname ? varByName[vname] : null;
    var reg = REG[rec.key] || [];
    var srcs = uniq([].concat(rec.src || [], s ? s.src : [],
      reg.reduce(function (a, g) { return a.concat(g.src || []); }, []),
      v ? v.src : []));
    var pay;
    if (!s) pay = "Not assessed in the cost ranking.";
    else if (s.na) pay = "Nothing — there is no waste stream to destroy here. The opportunity is inverted: sell the data center power, cooling, and reclaimed water made at waste-rich sites.";
    else pay = "<b>" + esc(band(s)) + "</b> — " + esc(cleanNote(s.note));
    var variant = v
      ? "<b>" + esc(v.v) + "</b> — " + esc(v.model) + ". First buyers: " + esc(v.first) + "."
      : esc(VARNONE[rec.key] || "No dedicated variant.");
    return '' +
      '<div class="rk-detail-card">' +
        '<h4>#' + rec.rank + " of 15 · " + esc(rec.name) + "</h4>" +
        '<p class="rk-dsub">' + fmtScore(rec.score) + " / 10 — " + esc(FIT[rec.tier] || "") +
          (tier ? " · " + esc(tier.name) : "") +
          (s ? " · Existing disposal: " + (s.na ? "no stream to treat" : esc(band(s))) : "") + "</p>" +
        "<h5>Why this rank</h5><p>" + esc(rec.why) + "</p>" +
        "<h5>What customers pay today</h5><p>" + pay + "</p>" +
        "<h5>Regulatory drivers</h5><ul>" +
          reg.map(function (g) { return "<li>" + esc(g.t) + " " + srcDated(g.src) + "</li>"; }).join("") +
        "</ul>" +
        "<h5>Which HCSP variant fits</h5><p>" + variant + "</p>" +
        "<p><em>Earn-back time is not calculated yet — the manufacturer's cost model has not been published.</em></p>" +
        '<div class="rk-dsrc">Sources (dated, clickable): ' + srcDated(srcs) + "</div>" +
      "</div>";
  }

  /* ═══ chart factory ═══ */
  function buildChart(host, defaultLens) {
    var state = {
      lens: defaultLens,
      view: "chart",
      mode: "panel",
      selected: null,
      sort: { col: "rank", dir: 1 },
      q: ""
    };
    try { state.mode = sessionStorage.getItem("rk-detail-mode") || "panel"; } catch (e) {}

    var root = document.createElement("section");
    root.className = "rk-root" + (REDUCE ? " rk-static" : "");
    root.setAttribute("aria-label", LENS[defaultLens].title);
    root.innerHTML =
      '<h3 class="rk-title"></h3>' +
      '<p class="rk-howto"></p>' +
      '<div class="rk-tools">' +
        '<div class="rk-seg" role="group" aria-label="Ranking order">' +
          '<span class="rk-seg-lab">RANK BY</span>' +
          '<button type="button" data-lens="composite">Overall fit score</button>' +
          '<button type="button" data-lens="savings">Disposal cost $/gal</button>' +
        "</div>" +
        '<div class="rk-seg" role="group" aria-label="View">' +
          '<span class="rk-seg-lab">VIEW</span>' +
          '<button type="button" data-view="chart">Chart</button>' +
          '<button type="button" data-view="table">Table</button>' +
        "</div>" +
        '<div class="rk-seg" role="group" aria-label="Detail opens as">' +
          '<span class="rk-seg-lab">DETAIL</span>' +
          '<button type="button" data-mode="panel">Side panel</button>' +
          '<button type="button" data-mode="expand">Under the bar</button>' +
        "</div>" +
        '<label class="rk-search"><input type="search" placeholder="Find an industry…" aria-label="Find an industry"><button type="button" class="rk-clear" aria-label="Clear search">×</button></label>' +
        '<span class="rk-count"></span>' +
      "</div>" +
      '<div class="rk-body">' +
        '<div class="rk-main">' +
          '<div class="rk-axis" aria-hidden="true"></div>' +
          '<div class="rk-rows-wrap" style="position:relative">' +
            '<div class="rk-gridlayer" aria-hidden="true"></div>' +
            '<ol class="rk-rows"></ol>' +
          "</div>" +
          '<p class="rk-empty">No industries match — try another word.</p>' +
          '<div class="rk-tablewrap" hidden></div>' +
        "</div>" +
        '<aside class="rk-panel" aria-live="polite"></aside>' +
      "</div>" +
      '<p class="rk-foot"></p>';
    host.appendChild(root);

    var titleEl = root.querySelector(".rk-title");
    var howtoEl = root.querySelector(".rk-howto");
    var axisEl = root.querySelector(".rk-axis");
    var gridEl = root.querySelector(".rk-gridlayer");
    var rowsEl = root.querySelector(".rk-rows");
    var emptyEl = root.querySelector(".rk-empty");
    var tableWrap = root.querySelector(".rk-tablewrap");
    var panelEl = root.querySelector(".rk-panel");
    var bodyEl = root.querySelector(".rk-body");
    var footEl = root.querySelector(".rk-foot");
    var countEl = root.querySelector(".rk-count");
    var searchBox = root.querySelector(".rk-search");
    var searchInput = searchBox.querySelector("input");

    /* ── tooltip ── */
    var tip = document.createElement("div");
    tip.className = "rk-tip";
    root.appendChild(tip);
    var tipKey = null, hoverKey = null;
    function tipHTML(rec) {
      var s = rec.sav;
      var val, basis;
      if (state.lens === "composite") {
        val = fmtScore(rec.score) + " / 10 — " + (FIT[rec.tier] || "");
        basis = "Basis: six weighted tests — regulation, disposal price, waste strength, market size, buying speed, and proof. " + (tier3(rec) ? "Posture: " + tier3(rec).posture : "");
      } else if (s && s.na) {
        val = '<span class="rk-risk-val">No stream to treat</span>';
        basis = "Basis: " + cleanNote(s.note);
      } else if (s) {
        val = band(s) + (s.lowConf ? " · low confidence" : "");
        basis = "Basis: " + cleanNote(s.note);
      }
      var srcs = uniq([].concat(state.lens === "composite" ? rec.src : (s ? s.src : []),
        state.lens === "composite" ? (s ? s.src.slice(0, 1) : []) : rec.src.slice(0, 1)));
      return '<p class="rk-tip-name">' + esc(rec.name) + "</p>" +
        '<p class="rk-tip-val' + (state.lens === "savings" && s && s.na ? " rk-risk" : "") + '">' + val + "</p>" +
        "<p>" + esc(state.lens === "composite" ? rec.plain : (s ? firstSentence(cleanNote(s.note)) : rec.plain)) + "</p>" +
        '<p class="rk-tip-basis">' + esc(basis) + "</p>" +
        '<div class="rk-tip-src">Sources: ' + srcDated(srcs) + "</div>" +
        '<p class="rk-tip-hint">Click the bar for the full story.</p>';
    }
    function tier3(rec) { return TIERS[rec.tier]; }
    function showTip(rec, x, y) {
      tipKey = rec.key;
      tip.innerHTML = tipHTML(rec);
      tip.classList.add("show");
      placeTip(x, y);
    }
    function placeTip(x, y) {
      var rw = root.clientWidth;
      var tw = tip.offsetWidth, th = tip.offsetHeight;
      var lx = x + 18, ly = y - 10;
      if (lx + tw > rw - 10) lx = x - tw - 18;
      if (lx < 6) lx = 6;
      var rh = root.scrollHeight;
      if (ly + th > rh - 6) ly = Math.max(6, rh - th - 6);
      tip.style.left = lx + "px";
      tip.style.top = ly + "px";
    }
    function hideTip() { tipKey = null; tip.classList.remove("show"); }
    tip.addEventListener("mouseleave", hideTip);

    /* ── rows (built once, keyed by industry) ── */
    var rowByKey = {};
    RECS.forEach(function (rec) {
      var li = document.createElement("li");
      li.className = "rk-row";
      li.dataset.key = rec.key;
      li.innerHTML =
        '<div class="rk-rowline" role="button" tabindex="0" aria-haspopup="true">' +
          '<span class="rk-rank"></span>' +
          '<div class="rk-track">' +
            '<div class="rk-fill"></div>' +
            '<div class="rk-band" style="display:none"></div>' +
            '<span class="rk-name"></span>' +
            '<span class="rk-val"></span>' +
          "</div>" +
        "</div>" +
        '<p class="rk-why"></p>' +
        '<div class="rk-flags"></div>' +
        '<div class="rk-expand"><div class="rk-expand-in"></div></div>';
      var r = {
        rec: rec, el: li,
        rank: li.querySelector(".rk-rank"),
        track: li.querySelector(".rk-track"),
        fill: li.querySelector(".rk-fill"),
        band: li.querySelector(".rk-band"),
        name: li.querySelector(".rk-name"),
        val: li.querySelector(".rk-val"),
        why: li.querySelector(".rk-why"),
        flags: li.querySelector(".rk-flags"),
        expand: li.querySelector(".rk-expand"),
        expandIn: li.querySelector(".rk-expand-in"),
        pctEnd: 0, valText: ""
      };
      rowByKey[rec.key] = r;
      li.addEventListener("click", function (e) {
        if (e.target.closest("a,button,.rk-expand")) return;
        select(rec.key === state.selected ? null : rec.key);
      });
      li.querySelector(".rk-rowline").addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(rec.key === state.selected ? null : rec.key); }
      });
      li.addEventListener("mousemove", function (e) {
        if (e.target.closest(".rk-expand")) { hoverKey = null; if (tipKey) hideTip(); return; }
        hoverKey = rec.key;
        var rect = root.getBoundingClientRect();
        if (tipKey !== rec.key) showTip(rec, e.clientX - rect.left, e.clientY - rect.top);
        else placeTip(e.clientX - rect.left, e.clientY - rect.top);
      });
      li.addEventListener("mouseleave", function (e) {
        if (tip.contains(e.relatedTarget)) return;
        hoverKey = null;
        hideTip();
      });
    });

    /* ── per-row content for a lens ── */
    function updateRow(r, lens) {
      var rec = r.rec, s = rec.sav, li = r.el;
      li.classList.remove("rk-na", "rk-lowconf");
      r.name.textContent = rec.name;
      if (lens === "composite") {
        li.dataset.tone = rec.tier;
        r.rank.textContent = rec.rank;
        r.pctEnd = rec.score / 10 * 100;
        r.valText = fmtScore(rec.score) + " / 10";
        r.band.style.display = "none";
        r.why.textContent = rec.plain;
        setFlags(r, FIT[rec.tier] ? [{ t: FIT[rec.tier], cls: rec.tier === 1 ? "blue" : "" }] : []);
        li.querySelector(".rk-rowline").setAttribute("aria-label",
          "#" + rec.rank + " " + rec.name + ", score " + fmtScore(rec.score) + " out of 10. " + rec.plain);
      } else if (s && s.na) {
        li.dataset.tone = 3;
        li.classList.add("rk-na");
        r.rank.textContent = s.srank;
        r.pctEnd = 30;
        r.valText = "No stream to treat";
        r.band.style.display = "none";
        r.why.textContent = "Data centers buy the output — power, cooling, reclaimed water — rather than paying for disposal.";
        setFlags(r, [{ t: "Buyer of the output", cls: "risk" }]);
        li.querySelector(".rk-rowline").setAttribute("aria-label",
          "#" + s.srank + " " + rec.name + ", no waste stream to treat — buyer of the output.");
      } else if (s) {
        li.dataset.tone = s.srank <= 3 ? 1 : 3;
        li.classList.toggle("rk-lowconf", !!s.lowConf);
        r.rank.textContent = s.srank;
        r.pctEnd = lpct(s.hi);
        r.band.style.display = "";
        r.band.style.left = lpct(s.lo) + "%";
        r.band.style.width = Math.max(0.4, lpct(s.hi) - lpct(s.lo)) + "%";
        r.valText = band(s);
        r.why.textContent = firstSentence(cleanNote(s.note));
        var fl = [];
        if (s.lowConf) fl.push({ t: "Low confidence — sparse data", cls: "risk" });
        fl.push({ t: "Fit rank #" + rec.rank, cls: "" });
        setFlags(r, fl);
        li.querySelector(".rk-rowline").setAttribute("aria-label",
          "#" + s.srank + " " + rec.name + ", existing disposal " + band(s) + ". " + firstSentence(cleanNote(s.note)));
      }
      r.fill.style.width = r.pctEnd + "%";
    }
    function setFlags(r, flags) {
      r.flags.innerHTML = "";
      flags.forEach(function (f) {
        var c = document.createElement("span");
        c.className = "rk-chip" + (f.cls === "risk" ? " rk-chip-risk" : f.cls === "blue" ? " rk-chip-blue" : "");
        c.textContent = f.t;
        r.flags.appendChild(c);
      });
    }

    /* ── label placement (name on bar, value at bar end, no overlap) ── */
    function layoutRow(r) {
      if (r.el.classList.contains("rk-hide")) return;
      var Wt = r.track.clientWidth;
      if (!Wt) return;
      var fillPx = r.pctEnd / 100 * Wt;
      var isNa = r.el.classList.contains("rk-na");
      r.name.style.maxWidth = "";
      var nameW = measure(r.name) + 26;
      var onFill = !isNa && nameW <= fillPx;
      var nameLeft = onFill ? 12 : Math.min(fillPx + 10, Math.max(12, Wt - nameW - 8));
      var nameEnd = nameLeft + nameW;
      r.name.classList.toggle("rk-onfill", onFill);
      r.name.style.left = nameLeft + "px";
      var valW = measure(r.val) + 4;
      var solid = !isNa && !r.el.classList.contains("rk-lowconf");
      r.val.classList.remove("rk-inside");
      var outX = Math.max(fillPx + 10, nameEnd + 12);
      if (outX + valW <= Wt - 4) {
        // outside, at the bar end (or just past the name if the name sits beside a small bar)
        r.val.style.left = outX + "px"; r.val.style.right = "auto";
      } else if (solid && fillPx - 12 - valW >= nameEnd + 8) {
        // inside the fill, right edge — only when the name is clear of it
        r.val.style.left = "auto"; r.val.style.right = (Wt - fillPx + 10) + "px";
        r.val.classList.add("rk-inside");
      } else {
        // last resort: right edge of the track; shrink the name if needed so nothing overlaps
        r.val.style.left = "auto"; r.val.style.right = "6px";
        var room = Wt - 6 - valW - 14 - nameLeft;
        if (room < nameW) r.name.style.maxWidth = Math.max(60, room) + "px";
        else r.name.style.maxWidth = "";
      }
      if (onFill) r.name.style.maxWidth = Math.max(60, fillPx - 24) + "px";
      r.val.textContent = r.valText;
    }
    function layoutAll() { ORDER[state.lens].forEach(function (k) { layoutRow(rowByKey[k]); }); }

    /* ── axis + gridlines per lens ── */
    function renderAxis() {
      var L = LENS[state.lens];
      axisEl.innerHTML = L.ticks.map(function (t) {
        return '<span style="left:' + t.pct + '%">' + esc(t.lab) + "</span>";
      }).join("") + '<b class="rk-axis-cap">' + esc(L.axisCap) + "</b>";
      gridEl.innerHTML = L.ticks.slice(1, -1).map(function (t) {
        return '<i style="left:' + t.pct + '%"></i>';
      }).join("");
    }

    /* ── animated lens switch: bars glide to the new order ── */
    function applyLens(lens, animate) {
      state.lens = lens;
      root.querySelectorAll("[data-lens]").forEach(function (b) {
        b.classList.toggle("on", b.dataset.lens === lens);
        b.setAttribute("aria-pressed", b.dataset.lens === lens ? "true" : "false");
      });
      var L = LENS[lens];
      if (REDUCE) { titleEl.textContent = L.title; howtoEl.innerHTML = L.howto; }
      else {
        root.classList.add("rk-fade-title");
        setTimeout(function () {
          titleEl.textContent = L.title; howtoEl.innerHTML = L.howto;
          root.classList.remove("rk-fade-title");
        }, 140);
      }
      root.setAttribute("aria-label", L.title);
      footEl.innerHTML = L.foot;
      renderAxis();
      var rows = ORDER[lens].map(function (k) { return rowByKey[k]; });
      if (animate && !REDUCE) {
        var first = rows.map(function (r) { return r.el.getBoundingClientRect().top; });
        rows.forEach(function (r) { rowsEl.appendChild(r.el); updateRow(r, lens); });
        layoutAll();
        rows.forEach(function (r, i) {
          var dy = first[i] - r.el.getBoundingClientRect().top;
          if (dy) {
            r.el.style.transition = "none";
            r.el.style.transform = "translateY(" + dy + "px)";
          }
        });
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            rows.forEach(function (r) { r.el.style.transition = ""; r.el.style.transform = ""; });
          });
        });
      } else {
        rows.forEach(function (r) { rowsEl.appendChild(r.el); updateRow(r, lens); });
        layoutAll();
      }
      rebuildTable();
      applySearch();
    }

    /* ── detail: side panel OR expand below the bar ── */
    function select(key) {
      hideTip();
      state.selected = key;
      syncDetail();
    }
    function syncDetail() {
      var key = state.selected;
      Object.keys(rowByKey).forEach(function (k) {
        var r = rowByKey[k];
        var on = k === key;
        r.el.classList.toggle("rk-selected", on);
        if (on && state.mode === "expand" && state.view === "chart") {
          r.expandIn.innerHTML = detailHTML(r.rec) + modeSwapBtn();
          r.expand.classList.add("open");
          wireModeSwap(r.expandIn);
        } else {
          r.expand.classList.remove("open");
        }
      });
      if (key && state.mode === "panel") {
        bodyEl.classList.add("has-panel");
        panelEl.innerHTML =
          '<div class="rk-panel-head"><span class="rk-panel-lab">Industry detail</span>' +
          '<button type="button" class="rk-close">Close ✕</button></div>' +
          detailHTML(recByKey[key]) + modeSwapBtn();
        panelEl.querySelector(".rk-close").addEventListener("click", function () { select(null); });
        wireModeSwap(panelEl);
      } else {
        bodyEl.classList.remove("has-panel");
        panelEl.innerHTML = "";
      }
      if (state.view === "table") rebuildTable();
      layoutAllSoon();
    }
    function modeSwapBtn() {
      var other = state.mode === "panel" ? "expand" : "panel";
      var lab = state.mode === "panel" ? "Show under the bar instead" : "Show in a side panel instead";
      return '<button type="button" class="rk-dmode" data-swap="' + other + '">' + lab + "</button>";
    }
    function wireModeSwap(scope) {
      var b = scope.querySelector(".rk-dmode");
      if (b) b.addEventListener("click", function (e) {
        e.stopPropagation();
        setMode(b.dataset.swap);
      });
    }
    function setMode(mode) {
      state.mode = mode;
      try { sessionStorage.setItem("rk-detail-mode", mode); } catch (e) {}
      root.querySelectorAll("[data-mode]").forEach(function (b) {
        b.classList.toggle("on", b.dataset.mode === mode);
      });
      if (state.selected) { var k = state.selected; state.selected = null; select(k); }
    }

    /* ── search / filter ── */
    function matches(rec, q) {
      var s = rec.sav;
      var hay = (rec.name + " " + rec.plain + " " + rec.why + " " +
        (s ? s.vertical + " " + s.note : "")).toLowerCase();
      return q.split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
    }
    function applySearch() {
      var q = state.q;
      searchBox.classList.toggle("has-q", !!q);
      var n = 0;
      RECS.forEach(function (rec) {
        var show = !q || matches(rec, q);
        rowByKey[rec.key].el.classList.toggle("rk-hide", !show);
        if (show) n++;
      });
      countEl.textContent = q ? n + " of " + RECS.length + " industries" : "";
      emptyEl.classList.toggle("show", n === 0 && state.view === "chart");
      if (state.selected && q && !matches(recByKey[state.selected], q)) select(null);
      if (state.view === "table") rebuildTable();
      layoutAllSoon();
    }
    searchInput.addEventListener("input", function () { state.q = searchInput.value.trim().toLowerCase(); applySearch(); });
    searchBox.querySelector(".rk-clear").addEventListener("click", function () {
      searchInput.value = ""; state.q = ""; applySearch(); searchInput.focus();
    });

    /* ── sortable table view ── */
    function sortVal(rec, col) {
      var s = rec.sav;
      if (col === "rank") return state.lens === "composite" ? rec.rank : (s ? s.srank : 99);
      if (col === "name") return rec.name.toLowerCase();
      if (col === "value") {
        if (state.lens === "composite") return rec.score;
        return s && !s.na ? s.hi : -Infinity;
      }
      return 0;
    }
    function rebuildTable() {
      var comp = state.lens === "composite";
      var cols = comp
        ? [["rank", "Rank", 1], ["name", "Industry", 1], ["value", "Score (of 10)", 1], [null, "Fit group"], [null, "Why"], [null, "Sources"]]
        : [["rank", "Rank", 1], ["name", "Industry", 1], ["value", "Existing disposal cost", 1], [null, "Fit rank"], [null, "Why"], [null, "Sources"]];
      var rows = RECS.filter(function (r) { return !state.q || matches(r, state.q); });
      if (state.sort.col) {
        rows = rows.slice().sort(function (a, b) {
          var va = sortVal(a, state.sort.col), vb = sortVal(b, state.sort.col);
          return (va < vb ? -1 : va > vb ? 1 : 0) * state.sort.dir;
        });
      }
      var html = '<table class="rk-table"><thead><tr>' + cols.map(function (c) {
        var arrow = state.sort.col === c[0] ? ' <span class="rk-arrow">' + (state.sort.dir > 0 ? "▲" : "▼") + "</span>" : "";
        return c[0]
          ? '<th class="rk-sortable" data-col="' + c[0] + '" aria-sort="' + (state.sort.col === c[0] ? (state.sort.dir > 0 ? "ascending" : "descending") : "none") + '" tabindex="0">' + esc(c[1]) + arrow + "</th>"
          : "<th>" + esc(c[1]) + "</th>";
      }).join("") + "</tr></thead><tbody>";
      rows.forEach(function (rec) {
        var s = rec.sav;
        html += '<tr data-key="' + rec.key + '"' + (state.selected === rec.key ? ' class="rk-selected"' : "") + ">";
        if (comp) {
          html += '<td class="rk-num">' + rec.rank + "</td>" +
            "<td><b>" + esc(rec.name) + "</b></td>" +
            '<td class="rk-num">' + fmtScore(rec.score) + " / 10</td>" +
            "<td>" + esc(FIT[rec.tier] || "") + "</td>" +
            '<td class="rk-t-reason">' + esc(rec.plain) + "</td>";
        } else {
          html += '<td class="rk-num">' + (s ? s.srank : "—") + "</td>" +
            "<td><b>" + esc(rec.name) + "</b></td>" +
            '<td class="rk-num">' + (s ? (s.na ? "No stream to treat" : esc(band(s)) + (s.lowConf ? " ⚠ low conf." : "")) : "—") + "</td>" +
            '<td class="rk-num">#' + rec.rank + " · " + fmtScore(rec.score) + "/10</td>" +
            '<td class="rk-t-reason">' + esc(s ? firstSentence(cleanNote(s.note)) : rec.plain) + "</td>";
        }
        var srcs = uniq([].concat(comp ? rec.src : (s ? s.src : []), ["K150"]));
        html += '<td class="rk-t-src">' + KLINK(srcs) + "</td></tr>";
        if (state.selected === rec.key && state.mode === "expand") {
          html += '<tr class="rk-expand-row"><td colspan="' + cols.length + '">' + detailHTML(rec) + modeSwapBtn() + "</td></tr>";
        }
      });
      html += "</tbody></table>";
      if (!rows.length) html = '<p class="rk-empty show" style="margin-left:0">No industries match — try another word.</p>';
      tableWrap.innerHTML = html;
      tableWrap.querySelectorAll("th.rk-sortable").forEach(function (th) {
        function go() {
          var c = th.dataset.col;
          if (state.sort.col === c) state.sort.dir *= -1;
          else state.sort = { col: c, dir: 1 };
          rebuildTable();
        }
        th.addEventListener("click", go);
        th.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
      });
      tableWrap.querySelectorAll("tbody tr[data-key]").forEach(function (tr) {
        tr.addEventListener("click", function (e) {
          if (e.target.closest("a,button")) return;
          select(tr.dataset.key === state.selected ? null : tr.dataset.key);
        });
      });
      wireModeSwap(tableWrap);
    }

    /* ── view switch ── */
    function setView(v) {
      state.view = v;
      root.querySelectorAll("[data-view]").forEach(function (b) { b.classList.toggle("on", b.dataset.view === v); });
      var isChart = v === "chart";
      root.querySelector(".rk-rows-wrap").hidden = !isChart;
      axisEl.hidden = !isChart;
      tableWrap.hidden = isChart;
      emptyEl.classList.toggle("show", false);
      if (!isChart) rebuildTable();
      syncDetail();
      applySearch();
    }

    /* ── wiring ── */
    root.querySelectorAll("[data-lens]").forEach(function (b) {
      b.addEventListener("click", function () { if (b.dataset.lens !== state.lens) applyLens(b.dataset.lens, true); });
    });
    root.querySelectorAll("[data-view]").forEach(function (b) {
      b.addEventListener("click", function () { setView(b.dataset.view); });
    });
    root.querySelectorAll("[data-mode]").forEach(function (b) {
      b.addEventListener("click", function () { setMode(b.dataset.mode); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.selected) select(null);
    });
    root.addEventListener("mouseleave", function () { hoverKey = null; hideTip(); });
    // A scroll during a programmatic hover (Playwright, touchpad inertia) must not
    // kill a tooltip the user is still pointing at — only hide when nothing is hovered.
    window.addEventListener("scroll", function () { if (!hoverKey) hideTip(); }, { passive: true });

    var raf = 0;
    function layoutAllSoon() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(layoutAll);
    }
    if (window.ResizeObserver) {
      new ResizeObserver(layoutAllSoon).observe(root);
    } else {
      window.addEventListener("resize", layoutAllSoon);
    }

    /* ── initial render: bars grow in when first visible (skipped in reading mode) ── */
    applyLens(defaultLens, false);
    setMode(state.mode);
    var fillsReady = false;
    function growIn() {
      if (fillsReady) return;
      fillsReady = true;
      if (REDUCE) { layoutAll(); return; }
      ORDER[state.lens].forEach(function (k, i) {
        var r = rowByKey[k];
        r.fill.style.transitionDelay = (i * 45) + "ms";
        r.fill.style.width = r.pctEnd + "%";
        setTimeout(function () { r.fill.style.transitionDelay = ""; }, 900 + i * 45);
      });
      layoutAllSoon();
    }
    // widths were applied synchronously by applyLens — zero them before paint, then grow
    ORDER[state.lens].forEach(function (k) {
      var r = rowByKey[k];
      r.fill.style.transition = "none";
      r.fill.style.width = "0%";
    });
    if (window.IntersectionObserver && !REDUCE) {
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          if (en.isIntersecting) {
            io.disconnect();
            ORDER[state.lens].forEach(function (k) { var r = rowByKey[k]; r.fill.style.transition = ""; });
            growIn();
          }
        });
      }, { threshold: 0.15 });
      io.observe(root);
    } else {
      ORDER[state.lens].forEach(function (k) { var r = rowByKey[k]; r.fill.style.transition = ""; r.fill.style.width = r.pctEnd + "%"; });
      growIn();
    }
    layoutAllSoon();
    return { root: root, select: select, applyLens: applyLens };
  }

  /* ═══ public API ═══ */
  window.ChartRanking = {
    render: function (hostEl, opts) {
      if (!hostEl) return;
      opts = opts || {};
      var chart = opts.chart || (hostEl.dataset && hostEl.dataset.chart) || "both";
      if (chart === "both") {
        buildChart(hostEl, "composite");
        buildChart(hostEl, "savings");
        return;
      }
      buildChart(hostEl, chart === "savings" ? "savings" : "composite");
    }
  };
})();
