/* ═══════════════════════════════════════════════════════════════════
   Chart Lab · energy charts — js/chart_energy.js
   Self-contained IIFE. Exposes window.ChartEnergy = { render(hostEl, opts) }.
   Builds its own DOM inside the host element supplied by the page.

   Expects (script order):
     1. vendor/echarts.min.js   (window.echarts)
     2. js/data.js              (window.RPT)
     3. js/sources.js           (window.SRCS)
     4. css/energy.css          (.en-* classes)
     5. js/chart_energy.js      (this file)
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var RPT = window.RPT || {};
  var SRCS = window.SRCS || [];
  var SRC_MAP = {};
  SRCS.forEach(function (s) { SRC_MAP[s.k] = s; });

  var REDUCED = false;
  try { REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var ANIM = !REDUCED;

  var INK = "#10222f", INK_MD = "#42566a", INK_LO = "#6b7f92";
  var BLUE = "#2251ff", GREEN = "#0d8a5f", RED = "#c22f4e", AMBER = "#b57a00";
  var MONO = "SFMono-Regular, ui-monospace, Roboto Mono, Menlo, Consolas, monospace";

  /* ── tiny DOM helper ── */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ── dated source links (K anchors from js/sources.js) ── */
  function srcLinks(ks) {
    if (!ks || !ks.length) return "";
    return ks.map(function (k) {
      var s = SRC_MAP[k];
      if (!s) return '<span class="en-k">' + esc(k) + "</span>";
      var lab = esc(k) + (s.date ? " · " + esc(s.date) : "");
      var title = esc(s.cite || "") + (s.fact ? " — " + esc(s.fact) : "");
      if (s.url) {
        return '<a class="en-k" href="' + esc(s.url) + '" target="_blank" rel="noopener" title="' + title + '">' + lab + "</a>";
      }
      return '<span class="en-k" title="' + title + '">' + lab + "</span>";
    }).join(" ");
  }

  /* ── section scaffold: header, toolbar, chart + side panel, expand-below, table ── */
  function buildSection(root, cfg) {
    var sec = el("section", "en-sec");
    sec.setAttribute("data-chart", cfg.id);

    var head = el("div", "en-head");
    head.appendChild(el("p", "en-kicker", esc(cfg.kicker)));
    head.appendChild(el("h3", "en-title", esc(cfg.title)));
    head.appendChild(el("p", "en-howto", cfg.howto)); // plain-English "how to read this"
    head.appendChild(el("p", "en-srcline", "Sources: " + srcLinks(cfg.src)));
    sec.appendChild(head);

    var tools = el("div", "en-tools");
    sec.appendChild(tools);

    var main = el("div", "en-main");
    var chartCol = el("div", "en-chart-col");
    var chartEl = el("div", "en-chart" + (cfg.tall ? " en-tall" : ""));
    chartEl.setAttribute("role", "img");
    chartEl.setAttribute("aria-label", cfg.title);
    chartCol.appendChild(chartEl);
    if (cfg.footnote) chartCol.appendChild(el("p", "en-srcline", cfg.footnote));
    var tableWrap = el("div", "en-table-wrap");
    chartCol.appendChild(tableWrap);
    var side = el("aside", "en-side");
    side.innerHTML = '<p class="en-hint">Hover the chart for a quick read. Click any ' +
      esc(cfg.clickNoun) + " for the full story here — and open the detail strip below the chart.</p>";
    main.appendChild(chartCol);
    main.appendChild(side);
    sec.appendChild(main);

    var expand = el("div", "en-expand");
    sec.appendChild(expand);

    root.appendChild(sec);
    return { sec: sec, tools: tools, chartEl: chartEl, side: side, expand: expand,
             tableWrap: tableWrap, chart: null, cfg: cfg };
  }

  function toolButton(ctx, label, pressed) {
    var b = el("button", "en-btn", esc(label));
    b.type = "button";
    b.setAttribute("aria-pressed", pressed ? "true" : "false");
    ctx.tools.appendChild(b);
    return b;
  }

  /* click-for-detail: fills BOTH the right-side panel and the expand-below strip */
  function setDetail(ctx, html, expandHtml) {
    ctx.side.innerHTML = html;
    ctx.expand.innerHTML = expandHtml || html;
    if (!ctx.expand.classList.contains("en-open")) {
      ctx.expand.classList.add("en-open");
      if (ctx.expandBtn) ctx.expandBtn.setAttribute("aria-pressed", "true");
    }
  }

  function addExpandToggle(ctx) {
    var b = toolButton(ctx, "Detail strip ▾", false);
    ctx.expandBtn = b;
    b.addEventListener("click", function () {
      var open = ctx.expand.classList.toggle("en-open");
      b.setAttribute("aria-pressed", open ? "true" : "false");
      if (open && !ctx.expand.innerHTML) {
        ctx.expand.innerHTML = '<p class="en-hint">Click a ' + esc(ctx.cfg.clickNoun) +
          " in the chart and its story appears here.</p>";
      }
    });
  }

  /* ── sortable table view ── */
  function buildTable(wrap, cols, rows, onRow) {
    var table = el("table", "en-table");
    var thead = el("thead");
    var trh = el("tr");
    var sortState = { col: -1, dir: 1 };
    cols.forEach(function (c, i) {
      var th = el("th", null, esc(c.label) + '<span class="en-arrow" aria-hidden="true"></span>');
      th.setAttribute("scope", "col");
      th.setAttribute("tabindex", "0");
      th.setAttribute("role", "button");
      th.setAttribute("aria-label", "Sort by " + c.label);
      function doSort() {
        if (sortState.col === i) sortState.dir *= -1; else { sortState.col = i; sortState.dir = 1; }
        trh.querySelectorAll(".en-arrow").forEach(function (a) { a.textContent = ""; });
        th.querySelector(".en-arrow").textContent = sortState.dir === 1 ? "▲" : "▼";
        var idx = rows.map(function (r, j) { return j; });
        idx.sort(function (a, b) {
          var va = cols[i].sortVal(rows[a]), vb = cols[i].sortVal(rows[b]);
          if (va == null && vb == null) return 0;
          if (va == null) return 1;
          if (vb == null) return -1;
          if (typeof va === "string") return sortState.dir * va.localeCompare(String(vb));
          return sortState.dir * (va - vb);
        });
        renderBody(idx);
      }
      th.addEventListener("click", doSort);
      th.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); doSort(); } });
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);

    function renderBody(order) {
      tbody.innerHTML = "";
      order.forEach(function (j) {
        var r = rows[j];
        var tr = el("tr", onRow ? "en-row-click" : "");
        cols.forEach(function (c) {
          var td = el("td", c.num ? "en-num" : "", c.cell(r));
          tr.appendChild(td);
        });
        if (onRow) {
          tr.addEventListener("click", function () { onRow(r); });
          tr.setAttribute("tabindex", "0");
          tr.addEventListener("keydown", function (ev) { if (ev.key === "Enter") onRow(r); });
        }
        tbody.appendChild(tr);
      });
    }
    renderBody(rows.map(function (_, j) { return j; }));
    wrap.innerHTML = "";
    wrap.appendChild(table);
  }

  function addTableToggle(ctx, buildFn) {
    var b = toolButton(ctx, "Table view", false);
    var built = false;
    b.addEventListener("click", function () {
      var showTable = !ctx.tableWrap.classList.contains("en-open");
      if (showTable && !built) { buildFn(); built = true; }
      ctx.tableWrap.classList.toggle("en-open", showTable);
      ctx.chartEl.style.display = showTable ? "none" : "";
      b.setAttribute("aria-pressed", showTable ? "true" : "false");
      if (!showTable && ctx.chart) ctx.chart.resize();
    });
  }

  function applyOption(ctx, option) {
    option.animation = ANIM;
    option.animationDuration = ANIM ? 500 : 0;
    option.animationDurationUpdate = ANIM ? 350 : 0;
    if (!ctx.chart) return makeChart(ctx, option);
    ctx.chart.setOption(option, { notMerge: true });
    return ctx.chart;
  }

  /* ── ECharts lifecycle: init, observe resize, reduced-motion ── */
  function makeChart(ctx, option) {
    if (!window.echarts) {
      ctx.chartEl.innerHTML = '<div class="en-fallback">Interactive chart library (ECharts) did not load — use the Table view for the same data.</div>';
      return null;
    }
    var ch = echarts.init(ctx.chartEl, null, { renderer: "canvas" });
    option.animation = ANIM;
    option.animationDuration = ANIM ? 500 : 0;
    option.animationDurationUpdate = ANIM ? 350 : 0;
    ch.setOption(option);
    ctx.chart = ch;
    if (window.ResizeObserver) {
      var t = null;
      new ResizeObserver(function () {
        clearTimeout(t);
        t = setTimeout(function () { ch.resize(); }, 60);
      }).observe(ctx.chartEl);
    }
    return ch;
  }

  function baseTooltip() {
    return {
      confine: true,
      backgroundColor: "#ffffff",
      borderColor: "#dbe2ea",
      textStyle: { color: INK, fontSize: 12 },
      extraCssText: "box-shadow:0 2px 10px rgba(16,34,47,.14);max-width:320px;white-space:normal;"
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     1 · ENERGY CROSSOVER — net kWh/m³ vs feed strength (COD)
     ═══════════════════════════════════════════════════════════════ */
  function hubY(cod) { return 18 - (78 / 160) * cod; } // hub_line [[0,18],[160,-60]]

  function renderCrossover(root) {
    var D = RPT.crossover;
    if (!D) return;
    var ctx = buildSection(root, {
      id: "crossover",
      kicker: "Chart 1 · Energy crossover",
      title: "Richer waste means free energy: above ~35–40 g/L COD the plant powers itself",
      howto: "How to read this: each step right means a stronger (dirtier) feed, measured as grams of chemical " +
        "oxygen demand per litre (COD). Each step up means more electricity bought per cubic metre treated; below the " +
        "zero line the plant makes power instead. The sloping blue line is a 1,000 m³/day plant with power recovery. " +
        "The grey band is a small 10 m³/day module — it never crosses zero. Dots are real waste streams placed where " +
        "their strength lands on the line; green dots are rich enough to make their own energy.",
      src: D.src,
      clickNoun: "stream dot"
    });

    /* "which feeds make their own energy" toggle */
    var hlOn = false;
    var hlBtn = toolButton(ctx, "Highlight self-fueling feeds", false);
    hlBtn.addEventListener("click", function () {
      hlOn = !hlOn;
      hlBtn.setAttribute("aria-pressed", hlOn ? "true" : "false");
      draw();
    });
    addExpandToggle(ctx);

    function streamPoint(s) {
      var mid = (s.cod[0] + s.cod[1]) / 2;
      return { name: s.name, value: [mid, hubY(mid)], stream: s };
    }
    var LABEL_POS = {
      "Brewery wastewater": "top", "Fab bulk wastewater": "bottom",
      "Produced water": "right", "Corn-ethanol stillage": "bottom",
      "Dewatered sewage sludge": "right", "Brazilian raw vinasse": "bottom",
      "Molasses vinasse": "top", "Pharma mother liquors": "bottom"
    };
    var LABEL_DIST = { "Fab bulk wastewater": 22, "Corn-ethanol stillage": 27 }; // clear the zero line / neighbours in the low-COD cluster

    function draw() {
      var rich = function (s) { return s.cod[1] >= D.net_zero; };
      var richPts = [], poorPts = [];
      D.streams.map(streamPoint).forEach(function (p) {
        var isRich = rich(p.stream);
        var dim = hlOn && !isRich;
        var item = {
          name: p.stream.name, value: p.value, stream: p.stream,
          itemStyle: { color: isRich ? GREEN : INK_MD, opacity: dim ? 0.22 : 1, borderColor: "#fff", borderWidth: 1.5 },
          label: {
            show: true, position: LABEL_POS[p.stream.name] || "top", distance: LABEL_DIST[p.stream.name] || 5,
            fontSize: 10, color: dim ? "#b7c2cd" : INK,
            textBorderColor: "#ffffff", textBorderWidth: 2.5, // halo so whiskers/line never strike through text
            formatter: p.stream.name
          }
        };
        (isRich ? richPts : poorPts).push(item);
      });
      function whiskerData() {
        return D.streams.map(function (s) {
          var mid = (s.cod[0] + s.cod[1]) / 2;
          return { value: [s.cod[0], s.cod[1], hubY(mid)] };
        });
      }
      var option = {
        grid: { left: 56, right: 24, top: 46, bottom: 46, containLabel: false },
        legend: {
          top: 2, left: 8, itemWidth: 16, itemHeight: 8,
          textStyle: { fontSize: 10.5, color: INK_MD },
          data: ["1,000 m³/day plant (power recovery)", "10 m³/day module band", "Waste stream — self-fueling", "Waste stream — needs power"]
        },
        tooltip: Object.assign(baseTooltip(), {
          formatter: function (p) {
            if (p.seriesType === "scatter" && p.data.stream) {
              var s = p.data.stream;
              var cod = s.cod[0] === s.cod[1] ? s.cod[0] + " g/L" : s.cod[0] + "–" + s.cod[1] + " g/L";
              return "<b>" + esc(s.name) + "</b><br>Feed strength: " + cod +
                " COD<br>Lands at ≈ " + Math.round(hubY((s.cod[0] + s.cod[1]) / 2)) +
                " kWh/m³ on the plant line<br><span style='color:" + INK_LO + "'>" + esc(s.note) +
                "</span><br><span style='color:" + BLUE + "'>Click for the full story →</span>";
            }
            if (p.seriesName === "1,000 m³/day plant (power recovery)") {
              return "Plant line at " + p.value[0] + " g/L: <b>" + Math.round(p.value[1]) + " kWh/m³</b> net";
            }
            return esc(p.name || "");
          }
        }),
        xAxis: {
          type: "value", min: 0, max: 210, name: "Feed strength (g/L COD)", nameLocation: "middle", nameGap: 30,
          nameTextStyle: { fontSize: 11, color: INK_MD },
          axisLabel: { fontSize: 10.5, color: INK_LO },
          splitLine: { lineStyle: { color: "#eef1f6" } }
        },
        yAxis: {
          type: "value", min: -70, max: 260, name: "Net kWh/m³ (+ buys power · − makes power)",
          nameLocation: "middle", nameGap: 42,
          nameTextStyle: { fontSize: 11, color: INK_MD },
          axisLabel: { fontSize: 10.5, color: INK_LO },
          splitLine: { lineStyle: { color: "#eef1f6" } }
        },
        series: [
          { // module band (stacked-area trick: invisible lower line + shaded gap)
            name: "mb-lo", type: "line", stack: "mb", silent: true, symbol: "none",
            lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 },
            data: D.module_band.map(function (d) { return [d[0], d[2]]; }),
            tooltip: { show: false }, legendHoverLink: false
          },
          {
            name: "10 m³/day module band", type: "line", stack: "mb", silent: true, symbol: "none",
            lineStyle: { opacity: 0.55, color: INK_LO, type: "dashed", width: 1 },
            areaStyle: { color: "rgba(107,127,146,.13)" },
            data: D.module_band.map(function (d) { return [d[0], d[1] - d[2]]; }),
            tooltip: { show: false }
          },
          {
            name: "1,000 m³/day plant (power recovery)", type: "line", symbol: "none",
            lineStyle: { color: BLUE, width: 2.5 },
            itemStyle: { color: BLUE },
            data: D.hub_line,
            markLine: {
              silent: true, symbol: "none",
              data: [
                { yAxis: 0, lineStyle: { color: INK, width: 1.2 }, label: { show: true, formatter: "zero — buys none, sells none", position: "insideEndTop", fontSize: 9.5, color: INK_MD } },
                { xAxis: D.net_zero, lineStyle: { color: GREEN, type: "dashed", width: 1.5 },
                  label: { show: true, formatter: "makes its own energy ≈35–40 g/L", position: "end", fontSize: 9.5, color: GREEN, distance: 4 } },
                { xAxis: D.export_from, lineStyle: { color: GREEN, width: 1.5 },
                  label: { show: true, formatter: "export territory ≥60 g/L", position: "insideStartBottom", fontSize: 9.5, color: GREEN, distance: 4 } }
              ]
            },
            markArea: hlOn ? {
              silent: true,
              itemStyle: { color: "rgba(13,138,95,.08)" },
              label: { show: true, formatter: "feeds in here make their own energy", position: "insideTop", fontSize: 10, color: GREEN },
              data: [[{ xAxis: D.net_zero }, { xAxis: 210 }]]
            } : undefined
          },
          { // COD-range whiskers
            name: "range", type: "custom", silent: true, z: 3,
            renderItem: function (params, api) {
              var s = D.streams[params.dataIndex];
              var lo = api.coord([api.value(0), api.value(2)]);
              var hi = api.coord([api.value(1), api.value(2)]);
              return {
                type: "line",
                shape: { x1: lo[0], y1: lo[1], x2: hi[0], y2: hi[1] },
                style: { stroke: rich(s) ? GREEN : INK_MD, lineWidth: 2, opacity: (hlOn && !rich(s)) ? 0.15 : 0.45 }
              };
            },
            data: whiskerData(),
            tooltip: { show: false }
          },
          { // stream dots below the crossover line (clickable)
            name: "Waste stream — needs power", type: "scatter", z: 4,
            symbolSize: 13, cursor: "pointer", itemStyle: { color: INK_MD },
            data: poorPts,
            labelLayout: { hideOverlap: true },
            emphasis: { scale: 1.4, label: { fontWeight: 700 } }
          },
          { // stream dots in self-fueling territory (clickable)
            name: "Waste stream — self-fueling", type: "scatter", z: 4,
            symbolSize: 13, cursor: "pointer", itemStyle: { color: GREEN },
            data: richPts,
            labelLayout: { hideOverlap: true },
            emphasis: { scale: 1.4, label: { fontWeight: 700 } }
          }
        ]
      };
      applyOption(ctx, option);
    }
    draw();

    ctx.chart && ctx.chart.on("click", function (p) {
      if (p.seriesType === "scatter" && p.data.stream) showStream(p.data.stream);
    });

    function showStream(s) {
      var mid = (s.cod[0] + s.cod[1]) / 2;
      var isRich = s.cod[1] >= D.net_zero;
      var cod = s.cod[0] === s.cod[1] ? s.cod[0] + " g/L" : s.cod[0] + "–" + s.cod[1] + " g/L";
      var head = '<span class="en-tag ' + (isRich ? "en-tag-pos" : "en-tag-neg") + '">' +
        (isRich ? "Makes its own energy" : "Needs outside energy") + "</span>" +
        "<h4>" + esc(s.name) + "</h4>" +
        '<span class="en-stat">' + cod + ' COD · lands at ≈' + Math.round(hubY(mid)) + " kWh/m³</span>";
      var body = "<p>" + esc(s.note) + "</p><p>" + srcLinks(s.src) + "</p>";
      var extra = "<h5>" + esc(s.name) + " — the full story</h5>" + "<p>" + esc(s.note) + "</p>" +
        "<p>On a 1,000 m³/day plant with power recovery, this feed lands at roughly <b>" + Math.round(hubY(mid)) +
        " kWh per cubic metre</b> — " + (isRich ?
          "below the zero line, so the waste's own chemistry supplies the energy and the surplus can be exported." :
          "above the zero line, so every cubic metre still needs bought electricity; the process does not pay for itself in energy here.") +
        "</p><p style='font-size:12px;color:#6b7f92'>" + esc(D.ceiling) + "</p><p>" + srcLinks(s.src.concat(D.src)) + "</p>";
      setDetail(ctx, head + body, extra);
    }

    addTableToggle(ctx, function () {
      buildTable(ctx.tableWrap, [
        { label: "Waste stream", sortVal: function (r) { return r.name; }, cell: function (r) { return "<b>" + esc(r.name) + "</b>"; } },
        { label: "COD (g/L)", num: true, sortVal: function (r) { return (r.cod[0] + r.cod[1]) / 2; },
          cell: function (r) { return r.cod[0] === r.cod[1] ? String(r.cod[0]) : r.cod[0] + "–" + r.cod[1]; } },
        { label: "Net kWh/m³ at plant", num: true, sortVal: function (r) { return hubY((r.cod[0] + r.cod[1]) / 2); },
          cell: function (r) { return String(Math.round(hubY((r.cod[0] + r.cod[1]) / 2))); } },
        { label: "Energy verdict", sortVal: function (r) { return r.cod[1] >= D.net_zero ? 1 : 0; },
          cell: function (r) { return r.cod[1] >= D.net_zero ? "Makes its own energy" : "Needs outside energy"; } },
        { label: "Story", sortVal: function (r) { return r.note; }, cell: function (r) { return esc(r.note); } },
        { label: "Sources", sortVal: function (r) { return r.src.join(""); }, cell: function (r) { return srcLinks(r.src); } }
      ], D.streams, showStream);
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     2 · HEAT-ALLOCATION CASCADE — where 16.1 MW of reaction heat goes
     ═══════════════════════════════════════════════════════════════ */
  function renderTrigen(root) {
    var D = RPT.trigen;
    if (!D) return;
    var ctx = buildSection(root, {
      id: "trigen",
      kicker: "Chart 2 · Heat-allocation cascade",
      title: "One tonne of waste heat, three paydays: preheat first, then power and cooling",
      howto: "How to read this: the reaction releases 16.1 MW of heat at a 1,000 m³/day plant. The widest band keeps " +
        "6.5 MW inside the plant to preheat incoming waste — that is the price of running on the waste's own energy. " +
        "The 9.6 MW left over is split between making electricity (1.4 MW) and driving an absorption chiller for " +
        "cooling (4.9 MW of cooling from 8.2 MW of heat). Bands are sized by megawatts. Click any stage for what it " +
        "means and what the output is worth.",
      src: D.src,
      clickNoun: "stage",
      footnote: "Basis: " + esc(D.basis) + ". Also recovered: " + esc(D.water) +
        ". Optimal cascade value ≈ " + esc(D.value) + " vs " + esc(D.value_cooling_only) + " if all surplus went to cooling alone.",
      tall: true
    });

    addExpandToggle(ctx);

    var STORIES = {
      "gross": {
        stat: "16.1 MW of heat, continuously",
        tag: ["en-tag-mid", "Starting point"],
        what: "Destroying 100 g/L of organic carbon per cubic metre releases 13.88 kJ per gram — 16.1 MW of " +
          "continuous heat at this plant size. This is the whole energy budget; everything downstream is a way " +
          "of spending it."
      },
      "preheat": {
        stat: "6.5 MW (~60% of gross) stays inside",
        tag: ["en-tag-mid", "Non-negotiable"],
        what: "Incoming waste must be heated from ~25 °C to ~400 °C at 25 MPa before the reaction starts. That " +
          "duty — about 6.5 MW — is recycled from the reactor's own exhaust. It is what makes the plant run on " +
          "the waste's own chemistry instead of bought fuel, and it is spent before any export is possible."
      },
      "surplus": {
        stat: "9.6 MW exportable (6.4–11.2 MW)",
        tag: ["en-tag-pos", "The prize"],
        what: "What remains after preheat is exportable heat. The 6.4–11.2 MW range reflects 70–85% heat-recovery " +
          "efficiency — underwrite the low end. Every dollar this chart earns comes out of this 9.6 MW, so the " +
          "split between power and cooling is the real design decision."
      },
      "power": {
        stat: "1.4 MW of electricity",
        tag: ["en-tag-mid", "High-temperature slice"],
        what: "A small back-pressure/extraction turbine turns the hottest slice into roughly 1.4 MW of power " +
          "(15–20% efficiency). At $0.10/kWh industrial that heat is worth $15–20 per MWh of heat. Simple, " +
          "bankable — but the lowest-value use per unit of heat."
      },
      "coolheat": {
        stat: "8.2 MW of heat at 150–180 °C",
        tag: ["en-tag-mid", "Mid-temperature slice"],
        what: "The rest of the surplus feeds an absorption chiller generator at 150–180 °C. Drive temperature " +
          "decides the chiller chemistry: lithium-bromide/water (70–120 °C, building-safe, above freezing only) " +
          "or ammonia/water (95–180 °C, reaches −60 °C, but toxic and regulated above 10,000 lb)."
      },
      "cooling": {
        stat: "4.9 MW of cooling ≈ 1,392 refrigeration tons",
        tag: ["en-tag-pos", "Highest value — with caveats"],
        what: "At COP 0.6 the chiller turns 8.2 MW of heat into 4.9 MW of cooling. Sold as district chilled water " +
          "(Singapore Marina Bay / Dubai Empower tariffs) it earns $30–48 per MWh of heat — leapfrogging power. " +
          "But field-measured ammonia absorption COP on waste heat came in at 0.28–0.45, you need ≥500 RT of " +
          "continuous load, and full electric backup is built regardless."
      }
    };
    var KEY2NODE = [
      ["gross", "Reaction heat\n16.1 MW"],
      ["preheat", "Preheat waste\n6.5 MW"],
      ["surplus", "Exportable surplus\n9.6 MW"],
      ["power", "Electricity\n1.4 MWₑ"],
      ["coolheat", "Heat to chiller\n8.2 MW"],
      ["cooling", "Cooling\n4.9 MWc"]
    ];
    var NODE_COLORS = { gross: INK, preheat: INK_LO, surplus: BLUE, power: AMBER, coolheat: "#7b5cd6", cooling: GREEN };

    var option = {
      tooltip: Object.assign(baseTooltip(), {
        formatter: function (p) {
          if (p.dataType === "node") {
            var key = p.data.key;
            var st = STORIES[key];
            return "<b>" + p.name.replace(/\n/g, " ") + "</b><br><span style='color:" + INK_LO + "'>" +
              esc(st ? st.stat : "") + "</span><br><span style='color:" + BLUE + "'>Click for what this stage means →</span>";
          }
          return esc(p.data.source.replace(/\n/g, " ")) + " → " + esc(p.data.target.replace(/\n/g, " ")) +
            ": <b>" + p.data.value + " MW</b>";
        }
      }),
      series: [{
        type: "sankey",
        left: 12, right: 130, top: 16, bottom: 16,
        nodeWidth: 16, nodeGap: 22,
        nodeAlign: "justify",
        emphasis: { focus: "adjacency" },
        lineStyle: { color: "gradient", curveness: 0.5, opacity: 0.35 },
        label: { fontSize: 11, color: INK, lineHeight: 15, fontFamily: "Helvetica Neue, Arial, sans-serif",
          textBorderColor: "#ffffff", textBorderWidth: 3 },
        levels: [
          { depth: 0, label: { position: "right" } },
          { depth: 1, label: { position: "right" } },
          { depth: 2, label: { position: "right" } }
        ],
        data: KEY2NODE.map(function (kv) {
          return { name: kv[1], key: kv[0], itemStyle: { color: NODE_COLORS[kv[0]] } };
        }),
        links: [
          { source: KEY2NODE[0][1], target: KEY2NODE[1][1], value: D.preheat },
          { source: KEY2NODE[0][1], target: KEY2NODE[2][1], value: D.surplus },
          { source: KEY2NODE[2][1], target: KEY2NODE[3][1], value: D.power },
          { source: KEY2NODE[2][1], target: KEY2NODE[4][1], value: D.cooling_heat },
          { source: KEY2NODE[4][1], target: KEY2NODE[5][1], value: D.cooling }
        ]
      }]
    };
    makeChart(ctx, option);

    function showStage(key) {
      var st = STORIES[key];
      if (!st) return;
      var hi = "<h4>" + esc(KEY2NODE.filter(function (kv) { return kv[0] === key; })[0][1].replace(/\n/g, " ")) + "</h4>" +
        '<span class="en-tag ' + st.tag[0] + '">' + esc(st.tag[1]) + "</span>" +
        '<span class="en-stat">' + esc(st.stat) + "</span><p>" + esc(st.what) + "</p>";
      var valRows = D.hierarchy.map(function (h) {
        return "<p><b>" + esc(h.form) + ":</b> " + esc(h.val) + " per " + esc(h.per) + " — " + esc(h.note) + "</p>";
      }).join("");
      var chil = "<h5>The two chiller chemistries</h5>" + D.chillers.map(function (c) {
        return "<p><b>" + esc(c.chem) + "</b> — COP " + esc(c.cop) + ", driven by " + esc(c.drive) +
          ", floor " + esc(c.floor) + ". Duty: " + esc(c.duty) + ". " + esc(c.safety) + ". " + srcLinks(c.src) + "</p>";
      }).join("");
      var extra = "<h5>What each megawatt of heat is worth</h5>" + valRows +
        "<p style='font-size:12px;color:#6b7f92'><b>Reality check:</b> " + esc(D.limits) + "</p>" +
        (key === "coolheat" || key === "cooling" ? chil : "") +
        "<p>" + srcLinks(D.src) + "</p>";
      setDetail(ctx, hi, "<h5>" + esc(KEY2NODE.filter(function (kv) { return kv[0] === key; })[0][1].replace(/\n/g, " ")) + "</h5><p>" + esc(st.what) + "</p>" + extra);
    }

    ctx.chart && ctx.chart.on("click", function (p) {
      if (p.dataType === "node" && p.data.key) showStage(p.data.key);
      else if (p.dataType === "edge") { // links overlay much of the flow area; resolve to the stage they feed
        var tgt = KEY2NODE.filter(function (kv) { return kv[1] === p.data.target; });
        if (tgt.length) showStage(tgt[0][0]);
      }
    });

    addTableToggle(ctx, function () {
      var rows = KEY2NODE.map(function (kv) {
        return { key: kv[0], name: kv[1].replace(/\n/g, " "), mw: STORIES[kv[0]].stat, what: STORIES[kv[0]].what };
      });
      buildTable(ctx.tableWrap, [
        { label: "Stage", sortVal: function (r) { return r.name; }, cell: function (r) { return "<b>" + esc(r.name) + "</b>"; } },
        { label: "Size", num: true, sortVal: function (r) { return parseFloat(r.mw); }, cell: function (r) { return esc(r.mw); } },
        { label: "What it means", sortVal: function (r) { return r.what; }, cell: function (r) { return esc(r.what); } }
      ], rows, function (r) { showStage(r.key); });
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     3 · SCALE LADDER — net energy by plant class (cost withheld)
     ═══════════════════════════════════════════════════════════════ */
  var SCALE_FIT = { // qualitative best-fit summary derived from each rung's note + scale_meta
    10:   "Pilot and demonstration sites; small concentrate generators (the AirSCWO 6 field unit is this class).",
    100:  "Industrial hubs and biosolids (sewage sludge) — the rung where the technology enters treatment-market price territory.",
    1000: "Plant-scale, self-fueling sites where a vapor power cycle pays: refinery residuals, distillery spent wash, large biosolids.",
    1900: "Regional-hub concept only (500k gpd). No single train above ~306 t/day has ever operated — this rung is a study, not a plant."
  };

  function renderScale(root) {
    var D = RPT.scale_ladder;
    if (!D) return;
    var M = RPT.scale_meta || {};
    var ctx = buildSection(root, {
      id: "scale",
      kicker: "Chart 3 · Scale ladder",
      title: "Bigger plants need less energy per cubic metre — capital cost figures are withheld",
      howto: "How to read this: each bar is a plant size class, from a 10 m³/day module to a 1,900 m³/day regional hub. " +
        "The bar shows the range of net electricity used per cubic metre treated — lower is better, and below zero a " +
        "plant would make power. Scale buys heat-recovery area, so energy falls as plants grow. Capital cost figures " +
        "are deliberately withheld until the manufacturer's cost model is published. Click a bar or a class chip for detail.",
      src: ["K70", "K74", "K75", "K76", "K79"],
      clickNoun: "bar or class chip",
      footnote: "Cost figures: withheld — earlier numbers came from a modeled industry stack, not the manufacturer; HCSP cost model pending."
    });

    /* scale-class selector chips */
    var chips = el("div", "en-chips");
    ctx.tools.parentNode.insertBefore(chips, ctx.tools);
    var chipBtns = D.map(function (d, i) {
      var b = el("button", "en-chip", esc(d.name) + " · " + d.m3d.toLocaleString("en-US") + " m³/day");
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () { select(i); });
      chips.appendChild(b);
      return b;
    });

    addExpandToggle(ctx);
    var selected = -1;

    function draw() {
      var option = {
        grid: { left: 56, right: 24, top: 34, bottom: 52, containLabel: false },
        tooltip: Object.assign(baseTooltip(), {
          formatter: function (p) {
            var d = D[p.dataIndex];
            return "<b>" + esc(d.name) + "</b> — " + d.m3d.toLocaleString("en-US") + " m³/day<br>" +
              "Net energy: <b>" + d.kwh[0] + "–" + d.kwh[1] + " kWh/m³</b><br>" +
              "<span style='color:" + INK_LO + "'>" + esc(d.note) + "</span><br>" +
              "<span style='color:" + BLUE + "'>Click for class detail →</span>";
          }
        }),
        xAxis: {
          type: "category",
          data: D.map(function (d) { return d.name + "\n" + d.m3d.toLocaleString("en-US") + " m³/day"; }),
          axisLabel: { fontSize: 10.5, color: INK_MD, interval: 0, lineHeight: 14 },
          axisTick: { show: false }
        },
        yAxis: {
          type: "value", min: 0, max: 260, name: "Net kWh/m³ (lower is better)",
          nameLocation: "middle", nameGap: 40,
          nameTextStyle: { fontSize: 11, color: INK_MD },
          axisLabel: { fontSize: 10.5, color: INK_LO },
          splitLine: { lineStyle: { color: "#eef1f6" } }
        },
        series: [
          { // transparent base of the floating range bar
            name: "base", type: "bar", stack: "rng", silent: true,
            itemStyle: { color: "transparent" }, emphasis: { itemStyle: { color: "transparent" } },
            data: D.map(function (d) { return d.kwh[0]; }),
            tooltip: { show: false }, barWidth: 56
          },
          {
            name: "Net energy range", type: "bar", stack: "rng", cursor: "pointer",
            itemStyle: {
              color: function (p) { return p.dataIndex === selected ? BLUE : "rgba(34,81,255,.55)"; },
              borderColor: BLUE, borderWidth: 1, borderRadius: [3, 3, 0, 0]
            },
            label: {
              show: true, position: "top", fontSize: 10.5, color: INK, fontFamily: MONO,
              textBorderColor: "#ffffff", textBorderWidth: 2.5,
              formatter: function (p) { var d = D[p.dataIndex]; return d.kwh[0] + "–" + d.kwh[1]; }
            },
            data: D.map(function (d) { return d.kwh[1] - d.kwh[0]; })
          },
          { // dashed connector between class midpoints
            name: "mid", type: "line", silent: true, symbol: "circle", symbolSize: 5,
            lineStyle: { color: INK_LO, type: "dashed", width: 1 },
            itemStyle: { color: INK_LO },
            data: D.map(function (d) { return (d.kwh[0] + d.kwh[1]) / 2; }),
            tooltip: { show: false }
          }
        ]
      };
      applyOption(ctx, option);
    }
    draw();

    function select(i) {
      selected = i;
      chipBtns.forEach(function (b, j) { b.setAttribute("aria-pressed", j === i ? "true" : "false"); });
      draw();
      var d = D[i];
      var side = "<h4>" + esc(d.name) + " — " + d.m3d.toLocaleString("en-US") + " m³/day</h4>" +
        '<span class="en-stat">Net energy ' + d.kwh[0] + "–" + d.kwh[1] + " kWh/m³</span>" +
        '<span class="en-tag en-tag-tbd">Capital cost withheld</span>' +
        "<p>" + esc(d.note) + "</p>" +
        "<p><b>Best-fit verticals:</b> " + esc(SCALE_FIT[d.m3d] || "—") + "</p>" +
        "<p>" + srcLinks(d.src) + "</p>";
      var extra = "<h5>" + esc(d.name) + " class — detail</h5>" +
        "<p>Net energy range <b>" + d.kwh[0] + "–" + d.kwh[1] + " kWh/m³</b>. " + esc(d.note) + "</p>" +
        "<p><b>Best-fit verticals:</b> " + esc(SCALE_FIT[d.m3d] || "—") + "</p>" +
        "<p><b>Capital cost:</b> figures are withheld — earlier numbers came from a modeled industry stack, not the manufacturer. The HCSP cost model is pending.</p>" +
        "<p><b>Why scale helps:</b> " + esc(M.physics || "") + "</p>" +
        "<p><b>Cost scaling basis (not HCSP pricing):</b> " + esc(M.exponent || "") + "</p>" +
        "<p style='color:#b57a00'><b>Hard limit:</b> " + esc(M.limit || "") + "</p>" +
        "<p>" + srcLinks(d.src.concat(M.src || [])) + "</p>";
      setDetail(ctx, side, extra);
    }

    ctx.chart && ctx.chart.on("click", function (p) {
      if (p.seriesName === "Net energy range") select(p.dataIndex);
    });

    addTableToggle(ctx, function () {
      buildTable(ctx.tableWrap, [
        { label: "Class", sortVal: function (r) { return r.name; }, cell: function (r) { return "<b>" + esc(r.name) + "</b>"; } },
        { label: "Capacity (m³/day)", num: true, sortVal: function (r) { return r.m3d; }, cell: function (r) { return r.m3d.toLocaleString("en-US"); } },
        { label: "Net kWh/m³ low", num: true, sortVal: function (r) { return r.kwh[0]; }, cell: function (r) { return String(r.kwh[0]); } },
        { label: "Net kWh/m³ high", num: true, sortVal: function (r) { return r.kwh[1]; }, cell: function (r) { return String(r.kwh[1]); } },
        { label: "Capital cost", sortVal: function () { return ""; }, cell: function () { return '<span class="en-tag en-tag-tbd">Withheld — cost model pending</span>'; } },
        { label: "Best-fit verticals", sortVal: function (r) { return SCALE_FIT[r.m3d] || ""; }, cell: function (r) { return esc(SCALE_FIT[r.m3d] || "—"); } },
        { label: "Note", sortVal: function (r) { return r.note; }, cell: function (r) { return esc(r.note); } },
        { label: "Sources", sortVal: function (r) { return r.src.join(""); }, cell: function (r) { return srcLinks(r.src); } }
      ], D, function (r) { select(D.indexOf(r)); });
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     4 · SAVINGS BY VERTICAL — incumbent baselines (payback pending)
     Bars show today's incumbent cost range — the gross-savings
     ceiling. Earn-back years are pending the manufacturer cost model.
     Native units are normalised to ≈$/m³ for one axis (derived):
     1 m³ = 264.172 US gal; 1 wet tonne ≈ 1 m³; ₹83.5 ≈ $1.
     ═══════════════════════════════════════════════════════════════ */
  var GAL = 264.172, INR = 83.5;
  var PAY = [ // keyed to RPT.payback by .key; conversions derived, flagged in UI
    { key: "haz",    lo: 5 * GAL,        hi: 20 * GAL,       short: "Hazardous solvents (halogenated)",  lab: "$5–20/gal",      native: "$5–20/gal (to $50+ specialty)" },
    { key: "pharma", lo: 1.5 * GAL,      hi: 15 * GAL,       short: "Pharma / biotech high-strength",    lab: "$1.5–15/gal",    native: "$1.5–3/gal baseline · $5–15/gal hazardous-rated" },
    { key: "pfas",   lo: 5 * GAL,        hi: 10 * GAL,       short: "PFAS concentrates",                 lab: "$5–10/gal",      native: "$5–10/gal incineration · $6–10/gal existing SCWO" },
    { key: "ref",    lo: 500,            hi: 1000,           short: "Refinery residuals (K-listed)",     lab: "$500–1,000/t",   native: "$500/t mid-point · $700–1,000/t service" },
    { key: "semi",   lo: 1.5 * GAL,      hi: 4 * GAL,        short: "Semiconductor side-streams",        lab: "$1.5–4/gal",     native: "$1.5–4/gal blended" },
    { key: "bio",    lo: 350,            hi: 500,            short: "Sewage sludge (biosolids)",          lab: "$350–500/wet t", native: "$350–500/wet t (crisis zones)" },
    { key: "islands", lo: 300,           hi: null,           short: "Islands / resorts (diesel)",        lab: "≥$300/wet t",    native: "≥$300/wet t threshold (plus diesel ≥$0.35/kWh)" },
    { key: "fnb",    lo: 45 * GAL / 1000, hi: 120 * GAL / 1000, short: "Food & beverage side-streams",   lab: "$45–120/1k gal", native: "$45–120 per 1,000 gal hauled" },
    { key: "tex",    lo: 180 / INR,      hi: 350 / INR,      short: "Textile clusters — India ZLD",      lab: "₹180–350/m³",    native: "₹180–350/m³ (India zero-liquid-discharge train)" },
    { key: "distill", lo: null,          hi: null,           short: "Distillery spent wash — India",     lab: "",               native: "~$1.3–2.7M/yr per site (not a per-volume price)" },
    { key: "cea",    lo: null,           hi: null,           short: "Indoor agriculture / CEA",          lab: "",               native: "No standalone equipment case — service model only" }
  ];

  function fmtUsdM3(v) {
    if (v == null) return "—";
    if (v >= 1000) return "$" + (v / 1000).toFixed(1).replace(/\.0$/, "") + "k/m³";
    if (v >= 100) return "$" + Math.round(v) + "/m³";
    return "$" + v.toFixed(1).replace(/\.0$/, "") + "/m³";
  }

  function renderPayback(root) {
    var D = RPT.payback;
    if (!D) return;
    var byKey = {};
    D.forEach(function (d) { byKey[d.key] = d; });
    var ctx = buildSection(root, {
      id: "payback",
      kicker: "Chart 4 · Savings by vertical",
      title: "What each industry pays today to make the problem go away (the savings ceiling)",
      howto: "How to read this: each bar is the cost range an industry already pays existing suppliers to destroy or " +
        "dispose of its waste — that incumbent bill is the ceiling on what a better process could save (gross-savings " +
        "basis). Units differ by industry, so everything is converted to rough US dollars per cubic metre on a " +
        "logarithmic scale; the native units are printed on each bar. Earn-back years are deliberately absent — they " +
        "need the manufacturer's cost model, which is pending. Click a bar for the incumbent baseline it displaces.",
      src: ["K33", "K21", "K37", "K40", "K47", "K43", "K42", "K46", "K61", "K65", "K35"],
      clickNoun: "bar",
      footnote: "Conversions for one shared axis (derived, flagged): 1 m³ = 264.172 US gal · 1 wet tonne ≈ 1 m³ · ₹83.5 ≈ $1. " +
        "Earn-back years: pending the manufacturer cost model — no HCSP price is implied by these bars."
    });

    addExpandToggle(ctx);

    var rows = PAY.filter(function (p) { return byKey[p.key]; }).map(function (p) {
      var d = byKey[p.key];
      return { key: p.key, name: d.name, short: p.short, lab: p.lab, lo: p.lo, hi: p.hi, native: p.native, basis: d.basis, kind: d.kind, src: d.src,
               mid: (p.lo != null && p.hi != null) ? Math.sqrt(p.lo * p.hi) : (p.lo || null) };
    });
    var barRows = rows.filter(function (r) { return r.lo != null; }).sort(function (a, b) { return b.mid - a.mid; });
    var specialRows = rows.filter(function (r) { return r.lo == null; });

    /* special-case chips (no per-volume bar) */
    if (specialRows.length) {
      var chips = el("div", "en-chips");
      chips.appendChild(el("span", null, "<span style='font:10px " + MONO + ";color:" + INK_LO + ";letter-spacing:.1em'>SPECIAL CASES&nbsp;</span>"));
      ctx.tools.parentNode.insertBefore(chips, ctx.tools);
      specialRows.forEach(function (r) {
        var b = el("button", "en-chip", esc(r.name.split("—")[0].trim()));
        b.type = "button";
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", function () { show(r); });
        chips.appendChild(b);
      });
    }

    function draw() {
      var option = {
        grid: { left: 8, right: 150, top: 30, bottom: 40, containLabel: true },
        tooltip: Object.assign(baseTooltip(), {
          formatter: function (p) {
            var idx = (p.data && p.data.barIndex != null) ? p.data.barIndex : p.dataIndex;
            var r = barRows[idx];
            if (!r) return "";
            return "<b>" + esc(r.name) + "</b><br>Incumbent baseline: <b>" + esc(r.native) + "</b><br>" +
              "≈ " + fmtUsdM3(r.lo) + " – " + fmtUsdM3(r.hi) + "<br>" +
              "<span style='color:" + INK_LO + "'>Earn-back years pending manufacturer cost model</span><br>" +
              "<span style='color:" + BLUE + "'>Click for the incumbent baseline story →</span>";
          }
        }),
        xAxis: {
          type: "log", min: 1, max: 30000, name: "Incumbent cost, ≈ US$/m³ (log scale)",
          nameLocation: "middle", nameGap: 28,
          nameTextStyle: { fontSize: 11, color: INK_MD },
          axisLabel: { fontSize: 10.5, color: INK_LO, hideOverlap: true,
            formatter: function (v) { return v >= 1000 ? "$" + (v / 1000) + "k" : "$" + v; } },
          splitLine: { lineStyle: { color: "#eef1f6" } }
        },
        yAxis: {
          type: "category", inverse: true,
          data: barRows.map(function (r) { return r.short; }),
          axisLabel: { fontSize: 10.5, color: INK_MD },
          axisTick: { show: false }
        },
        series: [
          { name: "base", type: "bar", stack: "pb", silent: true,
            itemStyle: { color: "transparent" }, emphasis: { itemStyle: { color: "transparent" } },
            data: barRows.map(function (r) { return r.lo; }), tooltip: { show: false }, barWidth: 18 },
          { name: "Incumbent baseline range", type: "bar", stack: "pb", cursor: "pointer",
            itemStyle: { color: "rgba(34,81,255,.55)", borderColor: BLUE, borderWidth: 1, borderRadius: [0, 3, 3, 0] },
            label: { show: true, position: "right", fontSize: 10, color: INK_MD, fontFamily: MONO, distance: 5,
              textBorderColor: "#ffffff", textBorderWidth: 2.5,
              formatter: function (p) { return barRows[p.dataIndex].lab; } },
            labelLayout: { hideOverlap: true },
            data: barRows.map(function (r) { return r.hi != null ? r.hi - r.lo : 0; }) },
          { name: "marker", type: "scatter", cursor: "pointer", symbol: "triangle", symbolSize: 12,
            itemStyle: { color: AMBER },
            label: { show: true, position: "right", fontSize: 10, color: INK_MD, fontFamily: MONO, distance: 8,
              textBorderColor: "#ffffff", textBorderWidth: 2.5,
              formatter: function (p) { return barRows[p.data.barIndex].lab + " threshold"; } },
            data: barRows.map(function (r, i) { return r.hi == null ? { value: [r.lo, i], barIndex: i } : null; }).filter(Boolean),
            tooltip: { show: true } }
        ]
      };
      applyOption(ctx, option);
    }
    draw();

    function show(r) {
      var kindTag = r.kind === "gap" ? ["en-tag-neg", "Gap — no standalone case"] :
        r.kind === "disposal" ? ["en-tag-mid", "Disposal baseline"] : ["en-tag-pos", "Destruction baseline"];
      var head = "<h4>" + esc(r.name) + "</h4>" +
        '<span class="en-tag ' + kindTag[0] + '">' + kindTag[1] + "</span>" +
        '<span class="en-stat">' + esc(r.native) + "</span>";
      var body = "<p><b>Incumbent baseline displaced:</b> " + esc(r.basis) + "</p>" +
        (r.lo != null ? "<p>On the shared axis that is ≈ " + fmtUsdM3(r.lo) + (r.hi != null ? " – " + fmtUsdM3(r.hi) : " and up") +
          " per cubic metre (converted for comparability).</p>" : "") +
        "<p style='color:#b57a00'><b>Earn-back years: pending</b> — needs the manufacturer cost model. The bar shows the gross-savings ceiling, not an HCSP price.</p>" +
        "<p>" + srcLinks(r.src) + "</p>";
      setDetail(ctx, head + body, "<h5>" + esc(r.name) + " — incumbent baseline</h5>" + body);
    }

    ctx.chart && ctx.chart.on("click", function (p) {
      if (p.componentType !== "series") return;
      var idx = (p.data && p.data.barIndex != null) ? p.data.barIndex : p.dataIndex;
      if (barRows[idx] && p.seriesName !== "base") show(barRows[idx]);
    });

    addTableToggle(ctx, function () {
      buildTable(ctx.tableWrap, [
        { label: "Vertical", sortVal: function (r) { return r.name; }, cell: function (r) { return "<b>" + esc(r.name) + "</b>"; } },
        { label: "Incumbent baseline (native units)", sortVal: function (r) { return r.native; }, cell: function (r) { return esc(r.native); } },
        { label: "≈ $/m³ low", num: true, sortVal: function (r) { return r.lo; }, cell: function (r) { return r.lo != null ? fmtUsdM3(r.lo) : "—"; } },
        { label: "≈ $/m³ high", num: true, sortVal: function (r) { return r.hi; }, cell: function (r) { return r.hi != null ? fmtUsdM3(r.hi) : "—"; } },
        { label: "Kind", sortVal: function (r) { return r.kind; }, cell: function (r) { return esc(r.kind); } },
        { label: "Earn-back years", sortVal: function () { return ""; }, cell: function () { return '<span class="en-tag en-tag-tbd">Pending cost model</span>'; } },
        { label: "Sources", sortVal: function (r) { return r.src.join(""); }, cell: function (r) { return srcLinks(r.src); } }
      ], rows, show);
    });
  }

  /* ═══ public entry ═══ */
  window.ChartEnergy = {
    render: function (hostEl, opts) {
      opts = opts || {};
      var host = typeof hostEl === "string" ? document.querySelector(hostEl) : hostEl;
      if (!host) return null;
      var root = el("div", "en-root");
      host.appendChild(root);
      var renderers = { crossover: renderCrossover, trigen: renderTrigen, scale: renderScale, payback: renderPayback };
      var order = opts.charts;
      if (!order) { // convention shared with sibling chart modules: host's data-chart can pick one chart
        var dc = host.getAttribute && host.getAttribute("data-chart");
        if (dc) order = dc.split(",").map(function (s) { return s.trim(); });
      }
      order = order || ["crossover", "trigen", "scale", "payback"];
      order.forEach(function (id) { if (renderers[id]) renderers[id](root); });
      return { root: root };
    }
  };
})();
