(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var M = window.UmiMap;

  var ICON = {
    ig: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/></svg>',
    line: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 4C7.6 4 4 6.9 4 10.5c0 2.2 1.4 4.1 3.5 5.3l-.4 2.7 3-1.7c.6.1 1.2.2 1.9.2 4.4 0 8-2.9 8-6.5S16.4 4 12 4z"/></svg>'
  };
  var WAVES = '<svg viewBox="0 0 120 40" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M4 14q10-12 20 0t20 0 20 0 20 0 20 0"/><path d="M4 28q10-12 20 0t20 0 20 0 20 0 20 0" opacity=".5"/></svg>';

  var SPOTS = [], SETTINGS = {}, selected = null, filter = "all", lbList = [], lbIndex = 0;

  /* ---------- Load ---------- */
  fetch("/api/site")
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (data) {
      SPOTS = data.spots || [];
      SETTINGS = data.settings || {};
      selected = SPOTS.length ? SPOTS[0].id : null;
      renderAll();
    })
    .catch(function () {
      $("panel").innerHTML = '<p class="desc">The content could not be loaded. Please try again in a moment.</p>';
      buildMap();
    });

  function renderAll() {
    renderSocial();
    renderCoords();
    buildMap();
    paintMap();
    paintPanel();
    paintPhotos();
  }

  /* ---------- Social links ---------- */
  function renderSocial() {
    var links = [];
    if (SETTINGS.instagramUrl) links.push({ k: "ig", label: "Instagram", cta: "Follow on Instagram", url: SETTINGS.instagramUrl });
    if (SETTINGS.lineUrl) links.push({ k: "line", label: "LINE", cta: "Add us on LINE", url: SETTINGS.lineUrl });
    var a = function (x, cls, inner) {
      return '<a class="' + cls + '" href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer"' + (cls === "ico" ? ' aria-label="' + x.label + '"' : "") + ">" + inner + "</a>";
    };
    $("socialTop").innerHTML = links.map(function (x) { return a(x, "ico", ICON[x.k]); }).join("");
    $("socialHero").innerHTML = links.map(function (x) { return a(x, "btn ghost", ICON[x.k] + "<span>" + x.cta + "</span>"); }).join("");
    $("socialFoot").innerHTML = links.map(function (x) { return a(x, "", x.label); }).join("");
    $("credit").textContent = SETTINGS.credit || "";
  }

  function renderCoords() {
    var el = $("coords");
    if (!SPOTS.length) { el.textContent = ""; return; }
    var s = SPOTS.slice().sort(function (a, b) { return a.lat - b.lat; });
    var f = function (p) { return p.lat.toFixed(1) + "°N " + p.lon.toFixed(1) + "°E"; };
    el.textContent = f(s[0]) + " — " + f(s[s.length - 1]);
  }

  /* ---------- Map ---------- */
  function buildMap() {
    var svg = $("mapsvg"), h = M.baseSVG();
    SPOTS.forEach(function (s, i) {
      var p = M.px(s.lon, s.lat);
      h += '<g class="pin" data-id="' + esc(s.id) + '" tabindex="0" role="button" aria-label="' + (i + 1) + ". " + esc(s.name) + '" transform="translate(' + p[0].toFixed(1) + "," + p[1].toFixed(1) + ')">' +
        '<circle class="halo" r="11"/><circle class="dot" r="10"/><text y="5">' + (i + 1) + "</text></g>";
    });
    h += '<text class="maplabel" id="maplabel"></text>';
    svg.innerHTML = h;
    svg.querySelectorAll(".pin").forEach(function (g) {
      g.addEventListener("click", function () { select(g.getAttribute("data-id")); });
      g.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(g.getAttribute("data-id")); }
      });
    });
  }

  function spotById(id) { return SPOTS.filter(function (s) { return s.id === id; })[0]; }

  function paintMap() {
    var L = $("maplabel");
    if (!L) return;
    var s = spotById(selected);
    document.querySelectorAll(".pin").forEach(function (g) {
      g.classList.toggle("on", g.getAttribute("data-id") === selected);
    });
    if (!s) { L.textContent = ""; return; }
    var p = M.px(s.lon, s.lat);
    var off = { r: [16, 6, "start"], l: [-16, 6, "end"], b: [0, 30, "middle"] }[s.dir] || [16, 6, "start"];
    L.setAttribute("x", (p[0] + off[0]).toFixed(1));
    L.setAttribute("y", (p[1] + off[1]).toFixed(1));
    L.setAttribute("text-anchor", off[2]);
    L.textContent = s.short;
    var g = document.querySelector('.pin[data-id="' + selected + '"]');
    if (g) L.parentNode.insertBefore(g, L);
  }

  /* ---------- Spot panel ---------- */
  function paintPanel() {
    var panel = $("panel");
    var s = spotById(selected);
    if (!s) { panel.innerHTML = '<p class="desc">No spots yet. Check back soon.</p>'; return; }
    var idx = SPOTS.indexOf(s) + 1;
    var n = s.images.length;
    var html = "";
    if (n) html += '<img class="cover" src="/img/' + esc(s.images[0]) + '" alt="' + esc(s.name) + '">';
    html += '<p class="eyebrow"><span class="badge">' + idx + "</span>" + esc(s.region) + "</p>" +
      "<h3>" + esc(s.name) + "</h3>" +
      '<p class="desc">' + esc(s.desc) + "</p>" +
      '<dl class="meta">' +
      (s.season ? "<dt>Highlight season</dt><dd>" + esc(s.season) + "</dd>" : "") +
      "<dt>Photos</dt><dd>" + (n ? n : "Coming soon") + "</dd></dl>";
    if (n) html += '<a class="btn primary" href="#photos" id="goPhotos">See photos from here</a>';
    html += '<ul class="spotlist">' + SPOTS.map(function (x, i) {
      return '<li><button type="button" data-id="' + esc(x.id) + '" aria-pressed="' + (x.id === selected) + '"><span class="n">' +
        String(i + 1).padStart(2, "0") + "</span>" + esc(x.short) + "</button></li>";
    }).join("") + "</ul>";
    panel.innerHTML = html;
    var go = $("goPhotos");
    if (go) go.addEventListener("click", function () { filter = selected; paintPhotos(); });
    panel.querySelectorAll(".spotlist button").forEach(function (b) {
      b.addEventListener("click", function () { select(b.getAttribute("data-id")); });
    });
  }

  function select(id) { selected = id; paintMap(); paintPanel(); }

  /* ---------- Photos ---------- */
  function paintPhotos() {
    var withPhotos = SPOTS.filter(function (s) { return s.images.length; });
    if (filter !== "all" && !withPhotos.some(function (s) { return s.id === filter; })) filter = "all";

    var chips = $("chips");
    chips.innerHTML = withPhotos.length
      ? '<button class="chip" type="button" data-f="all" aria-pressed="' + (filter === "all") + '">All</button>' +
        withPhotos.map(function (s) {
          return '<button class="chip" type="button" data-f="' + esc(s.id) + '" aria-pressed="' + (filter === s.id) + '">' + esc(s.short) + "</button>";
        }).join("")
      : "";
    chips.querySelectorAll(".chip").forEach(function (b) {
      b.addEventListener("click", function () { filter = b.getAttribute("data-f"); paintPhotos(); });
    });

    lbList = [];
    withPhotos.forEach(function (s) {
      if (filter !== "all" && s.id !== filter) return;
      s.images.forEach(function (id, i) { lbList.push({ id: id, spot: s, n: i + 1 }); });
    });

    var grid = $("grid");
    if (!lbList.length) {
      grid.innerHTML = '<div class="empty">' + WAVES + "<b>Photos are on the way</b><span>Underwater photos will appear here soon.</span></div>";
      return;
    }
    grid.innerHTML = lbList.map(function (p, i) {
      return '<button type="button" class="shot" data-i="' + i + '" aria-label="' + esc(p.spot.name) + ', photo ' + p.n + '">' +
        '<img loading="lazy" src="/img/' + esc(p.id) + '" alt="' + esc(p.spot.name) + ' underwater photo ' + p.n + '">' +
        '<span class="cap">' + esc(p.spot.short) + "</span></button>";
    }).join("");
    grid.querySelectorAll(".shot").forEach(function (b) {
      b.addEventListener("click", function () { openLb(Number(b.getAttribute("data-i"))); });
    });
  }

  /* ---------- Lightbox ---------- */
  var lb = $("lb");
  function showLb() {
    var p = lbList[lbIndex];
    if (!p) return;
    $("lbImg").src = "/img/" + p.id;
    $("lbImg").alt = p.spot.name + " underwater photo " + p.n;
    $("lbCap").textContent = p.spot.name + (p.spot.region ? " · " + p.spot.region : "");
  }
  function openLb(i) {
    lbIndex = i; showLb();
    if (typeof lb.showModal === "function") lb.showModal();
  }
  function stepLb(d) {
    if (!lbList.length) return;
    lbIndex = (lbIndex + d + lbList.length) % lbList.length;
    showLb();
  }
  $("lbClose").addEventListener("click", function () { lb.close(); });
  $("lbPrev").addEventListener("click", function () { stepLb(-1); });
  $("lbNext").addEventListener("click", function () { stepLb(1); });
  lb.addEventListener("click", function (e) { if (e.target === lb || e.target.classList.contains("lb-in")) lb.close(); });
  lb.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") stepLb(-1);
    if (e.key === "ArrowRight") stepLb(1);
  });
  lb.addEventListener("close", function () { $("lbImg").removeAttribute("src"); });

  /* ---------- Depth gauge ---------- */
  var ticking = false;
  function gauge() {
    var max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    var p = Math.min(1, Math.max(0, scrollY / max));
    $("gDepth").textContent = Math.round(p * 40);
    $("gMark").style.top = p * 100 + "%";
    ticking = false;
  }
  addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(gauge); } }, { passive: true });
  addEventListener("resize", gauge);
  gauge();

  /* ---------- Marine snow ---------- */
  (function () {
    var cv = $("snow"), cx = cv.getContext("2d"), W, H, P = [];
    var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    function size() { var d = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; cx.setTransform(d, 0, 0, d, 0, 0); }
    function init() {
      P = []; var n = Math.round(Math.min(90, W / 14));
      for (var i = 0; i < n; i++) P.push({ x: Math.random() * W, y: Math.random() * H, r: 0.6 + Math.random() * 1.7, v: 0.12 + Math.random() * 0.32, dx: (Math.random() - 0.5) * 0.18 });
    }
    function draw() {
      cx.clearRect(0, 0, W, H);
      P.forEach(function (p) { cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fillStyle = "rgba(220,245,250," + (0.14 + p.r * 0.1) + ")"; cx.fill(); });
    }
    function step() {
      P.forEach(function (p) {
        p.y += p.v; p.x += p.dx;
        if (p.y > H + 4) { p.y = -4; p.x = Math.random() * W; }
        if (p.x < -4) p.x = W + 4;
        if (p.x > W + 4) p.x = -4;
      });
      draw(); requestAnimationFrame(step);
    }
    size(); init(); draw();
    addEventListener("resize", function () { size(); init(); draw(); });
    if (!reduce) requestAnimationFrame(step);
  })();
})();
