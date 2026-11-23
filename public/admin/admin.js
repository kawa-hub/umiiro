(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var M = window.UmiMap;
  var site = null, sel = 0, dirty = false;

  function api(path, opts) {
    opts = opts || {};
    return fetch(path, Object.assign({ credentials: "same-origin", cache: "no-store" }, opts)).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
    });
  }
  function setStatus(msg, kind) { var s = $("status"); s.textContent = msg; s.setAttribute("data-kind", kind || ""); }
  function markDirty() { dirty = true; setStatus("Unsaved changes", "warn"); }
  function cur() { return site && site.spots[sel]; }

  /* ---------- Session ---------- */
  function showLogin() { $("app").hidden = true; $("login").hidden = false; $("pw").focus(); }
  function boot() {
    api("/api/me").then(function (r) {
      if (r.data && r.data.admin) load(); else showLogin();
    });
  }
  function load() {
    api("/api/site").then(function (r) {
      if (!r.ok) { showLogin(); return; }
      site = r.data; sel = 0; dirty = false;
      $("login").hidden = true; $("app").hidden = false;
      renderAll(); setStatus("Loaded", "");
    });
  }

  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    $("loginErr").textContent = ""; $("loginBtn").disabled = true;
    api("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: $("pw").value }) })
      .then(function (r) {
        $("loginBtn").disabled = false;
        if (r.ok) { $("pw").value = ""; load(); }
        else $("loginErr").textContent = (r.data && r.data.error) || "Could not log in.";
      });
  });
  $("logout").addEventListener("click", function () {
    api("/api/login", { method: "DELETE" }).then(function () { dirty = false; showLogin(); });
  });
  addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- Render ---------- */
  function renderAll() { renderSettings(); renderList(); renderForm(); }

  function renderSettings() {
    $("s_ig").value = site.settings.instagramUrl || "";
    $("s_line").value = site.settings.lineUrl || "";
    $("s_credit").value = site.settings.credit || "";
  }
  [["s_ig", "instagramUrl"], ["s_line", "lineUrl"], ["s_credit", "credit"]].forEach(function (p) {
    $(p[0]).addEventListener("input", function () { site.settings[p[1]] = $(p[0]).value; markDirty(); });
  });

  function renderList() {
    var ol = $("spotList");
    ol.innerHTML = site.spots.map(function (s, i) {
      return '<li class="' + (i === sel ? "on" : "") + '">' +
        '<button type="button" class="item" data-act="pick" data-i="' + i + '">' + (i + 1) + ". " + esc(s.name || "Untitled") + "</button>" +
        '<button type="button" class="mini" data-act="up" data-i="' + i + '" aria-label="Move up"' + (i === 0 ? " disabled" : "") + ">↑</button>" +
        '<button type="button" class="mini" data-act="down" data-i="' + i + '" aria-label="Move down"' + (i === site.spots.length - 1 ? " disabled" : "") + ">↓</button>" +
        '<button type="button" class="mini del" data-act="del" data-i="' + i + '" aria-label="Delete spot">×</button></li>';
    }).join("");
  }
  $("spotList").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    var i = Number(b.getAttribute("data-i")), act = b.getAttribute("data-act"), a = site.spots;
    if (act === "pick") { sel = i; }
    else if (act === "up" && i > 0) { var t = a[i - 1]; a[i - 1] = a[i]; a[i] = t; if (sel === i) sel = i - 1; else if (sel === i - 1) sel = i; markDirty(); }
    else if (act === "down" && i < a.length - 1) { var t2 = a[i + 1]; a[i + 1] = a[i]; a[i] = t2; if (sel === i) sel = i + 1; else if (sel === i + 1) sel = i; markDirty(); }
    else if (act === "del") {
      if (!confirm('Delete "' + (a[i].name || "this spot") + '"? Its photos are removed when you save.')) return;
      a.splice(i, 1); sel = Math.max(0, Math.min(sel, a.length - 1)); markDirty();
    }
    renderList(); renderForm();
  });
  $("addSpot").addEventListener("click", function () {
    site.spots.push({ id: "spot-" + Date.now().toString(36), name: "New spot", short: "New", region: "", desc: "", season: "", lat: 36, lon: 138, dir: "r", images: [] });
    sel = site.spots.length - 1; markDirty(); renderList(); renderForm();
  });

  /* ---------- Spot form ---------- */
  var FIELDS = [["f_name", "name"], ["f_short", "short"], ["f_region", "region"], ["f_season", "season"], ["f_desc", "desc"], ["f_dir", "dir"]];

  function renderForm() {
    var s = cur();
    $("spotForm").hidden = !s;
    if (!s) return;
    FIELDS.forEach(function (p) { $(p[0]).value = s[p[1]] || ""; });
    $("f_lat").value = s.lat; $("f_lon").value = s.lon;
    renderPicker(); renderThumbs();
  }
  FIELDS.forEach(function (p) {
    $(p[0]).addEventListener("input", function () {
      var s = cur(); if (!s) return;
      s[p[1]] = $(p[0]).value; markDirty();
      if (p[1] === "name") renderList();
    });
  });
  function setCoords(lat, lon) {
    var s = cur(); if (!s) return;
    s.lat = Math.min(46, Math.max(24, lat)); s.lon = Math.min(146, Math.max(122, lon));
    $("f_lat").value = s.lat.toFixed(2); $("f_lon").value = s.lon.toFixed(2);
    s.lat = Number(s.lat.toFixed(2)); s.lon = Number(s.lon.toFixed(2));
    markDirty(); renderPicker();
  }
  ["f_lat", "f_lon"].forEach(function (id) {
    $(id).addEventListener("input", function () {
      var lat = parseFloat($("f_lat").value), lon = parseFloat($("f_lon").value), s = cur();
      if (!s || isNaN(lat) || isNaN(lon)) return;
      s.lat = lat; s.lon = lon; markDirty(); renderPicker();
    });
  });

  function renderPicker() {
    var svg = $("pick"), h = M.baseSVG();
    site.spots.forEach(function (s, i) {
      if (i === sel) return;
      var p = M.px(s.lon, s.lat); h += '<circle class="other" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="5"/>';
    });
    var c = cur();
    if (c) { var q = M.px(c.lon, c.lat); h += '<circle class="cur" cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="9"/>'; }
    svg.innerHTML = h;
  }
  $("pick").addEventListener("click", function (e) {
    var svg = $("pick"), pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    var p = pt.matrixTransform(svg.getScreenCTM().inverse());
    var ll = M.inv(p.x, p.y);
    setCoords(ll[1], ll[0]);
  });

  /* ---------- Photos ---------- */
  function renderThumbs() {
    var s = cur(); if (!s) return;
    $("thumbs").innerHTML = s.images.map(function (id, i) {
      return "<figure><div class=\"wrapimg\">" + (i === 0 ? '<span class="cover">Cover</span>' : "") +
        '<img loading="lazy" src="/img/' + esc(id) + '" alt="Photo ' + (i + 1) + '"></div>' +
        '<div class="row">' + (i > 0 ? '<button type="button" data-act="cover" data-i="' + i + '">Make cover</button>' : "") +
        '<button type="button" data-act="rm" data-i="' + i + '">Remove</button></div></figure>';
    }).join("");
  }
  $("thumbs").addEventListener("click", function (e) {
    var b = e.target.closest("button"), s = cur(); if (!b || !s) return;
    var i = Number(b.getAttribute("data-i"));
    if (b.getAttribute("data-act") === "rm") s.images.splice(i, 1);
    else if (b.getAttribute("data-act") === "cover") s.images.unshift(s.images.splice(i, 1)[0]);
    markDirty(); renderThumbs();
  });

  function resize(file) {
    return createImageBitmap(file, { imageOrientation: "from-image" }).then(function (bmp) {
      var scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
      var c = document.createElement("canvas");
      c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      return new Promise(function (res, rej) { c.toBlob(function (b) { b ? res(b) : rej(new Error("encode")); }, "image/jpeg", 0.86); });
    });
  }

  $("files").addEventListener("change", function () {
    var s = cur(), files = Array.prototype.slice.call($("files").files);
    $("files").value = "";
    if (!s || !files.length) return;
    var done = 0, failed = 0;
    files.reduce(function (chain, file) {
      return chain.then(function () {
        setStatus("Uploading " + (done + failed + 1) + " of " + files.length + "…", "warn");
        return resize(file)
          .then(function (blob) {
            return api("/api/upload", { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
          })
          .then(function (r) {
            if (r.status === 401) { showLogin(); throw new Error("auth"); }
            if (r.ok && r.data && r.data.id) { s.images.push(r.data.id); done++; renderThumbs(); }
            else failed++;
          }, function () { failed++; });
      });
    }, Promise.resolve()).then(function () {
      if (done) markDirty();
      if (failed) setStatus(failed + " photo(s) could not be uploaded. Use JPEG, PNG or WebP.", "err");
      else setStatus("Uploaded. Remember to save.", "warn");
    }, function () {});
  });

  /* ---------- Save ---------- */
  $("save").addEventListener("click", function () {
    $("save").disabled = true; setStatus("Saving…", "warn");
    api("/api/site", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(site) })
      .then(function (r) {
        $("save").disabled = false;
        if (r.status === 401) { showLogin(); return; }
        if (!r.ok) { setStatus((r.data && r.data.error) || "Could not save.", "err"); return; }
        site = r.data.site; sel = Math.min(sel, Math.max(0, site.spots.length - 1)); dirty = false;
        renderAll(); setStatus("Saved. The site updates within a minute.", "ok");
      });
  });

  boot();
})();
