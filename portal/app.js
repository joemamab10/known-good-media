// Known Good Media parent portal (no framework; all user data is rendered as text, never HTML).
(function () {
  const cfg = window.KGM_CONFIG;
  const B = window.KGM.backend;
  const STATUSES = window.KGM.STATUSES;
  const $app = document.getElementById("app");

  const SPORT_STATS = {
    Baseball: ["B/T", "Exit Velo", "60 YD", "Throwing Velo", "Pop Time"],
    Softball: ["B/T", "Exit Velo", "Home to 1st", "Throwing Velo", "Pitch Velo"],
    Football: ["40 YD", "Shuttle", "Vertical", "Bench", "Squat"],
    Basketball: ["Wingspan", "Vertical", "Standing Reach"],
    Volleyball: ["Approach Touch", "Block Touch", "Standing Reach"],
    Soccer: ["Foot", "Sprint 40"], Lacrosse: ["Hand", "40 YD"], Hockey: ["Shoots", "Sprint"],
    Wrestling: ["Weight Class", "Record"], "Track & Field": ["Event PR", "Event PR 2"],
    Tennis: ["UTR", "Plays"], Golf: ["Scoring Avg", "Handicap"], Other: [],
  };
  const SPORTS = Object.keys(SPORT_STATS);

  // ---------- tiny DOM helper ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style") el.setAttribute("style", v);
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "value") el.value = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }
  const money = (n) => "$" + Number(n || 0).toLocaleString();
  const fmtDate = (s) => new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const fmtSize = (b) => (b > 1e9 ? (b / 1e9).toFixed(1) + " GB" : (b / 1e6).toFixed(1) + " MB");
  const statusOf = (id) => STATUSES.find((s) => s.id === id) || STATUSES[0];
  const pkgOf = (id) => cfg.PACKAGES.find((p) => p.id === id);
  let toastT;
  function toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) { t = h("div", { class: "toast", role: "status" }); document.body.append(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600);
  }
  function pill(status) { return h("span", { class: "pill s-" + status }, statusOf(status).label); }
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

  // ---------- chrome ----------
  async function chrome(me) {
    const top = document.getElementById("top");
    top.replaceChildren(...[
      h("a", { class: "wordmark", href: "../", title: "Known Good Media home", "aria-label": "Known Good Media home" }, "K", h("b", {}, "NOW"), "N"),
      h("a", { class: "tag", href: "#/", style: "text-decoration:none" }, "Parent Portal"),
      h("span", { class: "spacer" }),
      me ? h("span", { class: "who" }, me.email) : null,
      me && me.is_admin ? h("a", { class: "btn ghost sm", href: "#/admin" }, "Orders") : null,
      me ? h("button", { class: "btn ghost sm", onclick: async () => { await B.signOut(); go("#/"); } }, "Sign out") : null,
    ].filter(Boolean));
    document.getElementById("demo").hidden = B.mode !== "demo";
  }

  // ---------- sign in ----------
  function signInView() {
    const email = h("input", { type: "email", id: "email", autocomplete: "email", placeholder: "you@example.com", required: true });
    const msg = h("p", { class: "small muted", "aria-live": "polite" });
    const form = h("form", { class: "stack", onsubmit: async (e) => {
      e.preventDefault();
      const v = email.value.trim();
      if (!/^\S+@\S+\.\S+$/.test(v)) { msg.textContent = "Enter the email address you'd like updates sent to."; return; }
      form.querySelector("button").disabled = true;
      try {
        const r = await B.signIn(v);
        if (r.sent) msg.textContent = `We emailed a sign-in link to ${v}. Open it on this device to continue.`;
        else render();
      } catch (err) { msg.textContent = err.message || "Couldn't send the link. Try again."; }
      form.querySelector("button").disabled = false;
    } },
      h("label", { class: "f", for: "email" }, "Parent email", email),
      h("button", { class: "btn", type: "submit" }, B.mode === "demo" ? "Enter the demo" : "Email me a sign-in link"),
      msg);
    return h("section", { class: "stack", style: "max-width:520px;margin:6vh auto 0" },
      h("p", { class: "eyebrow" }, "Known Good Media"),
      h("h1", { class: "h-xl" }, "Get your athlete known."),
      h("p", { class: "muted" }, "Order a highlight reel, upload film and a player photo, and follow along until it's ready. No password: we email you a link to sign in."),
      h("div", { class: "card" }, form),
      B.mode === "demo" ? h("p", { class: "small muted" }, "Demo tip: sign in with an email containing \"admin\" to see the owner's order screen.") : null);
  }

  // ---------- dashboard ----------
  async function dashboard(me) {
    const [orders, athletes] = await Promise.all([B.listOrders(), B.listAthletes()]);
    const mine = orders.filter((o) => o.parent_id === me.id);
    const photoFor = {};
    await Promise.all(athletes.map(async (a) => (photoFor[a.id] = await B.photoUrl(a).catch(() => null))));
    const rows = mine.map((o) => {
      const url = photoFor[o.athlete_id];
      return h("a", { class: "order-row", href: "#/order/" + o.id },
        h("div", { class: "thumb", style: url ? `background-image:url("${url}")` : null }, url ? "" : initials(o.athlete?.name)),
        h("div", {}, h("div", { class: "h-md" }, o.athlete?.name || "Athlete"),
          h("div", { class: "small muted" }, `${pkgOf(o.package)?.name || o.package} · ordered ${fmtDate(o.created_at)}`)),
        pill(o.status));
    });
    const needs = mine.filter((o) => o.status === "review" || (!o.paid && o.status === "submitted"));
    return h("section", { class: "stack" },
      h("div", { class: "row between" },
        h("div", {}, h("p", { class: "eyebrow" }, "Your reels"), h("h1", { class: "h-lg" }, mine.length ? "Orders" : "Welcome")),
        h("a", { class: "btn", href: "#/new" }, "Order a reel")),
      needs.length ? h("div", { class: "callout" }, h("strong", {}, needs.some((o) => o.status === "review") ? "A draft is ready for your review." : "Finish checkout to get your reel started."),
        " ", h("a", { href: "#/order/" + needs[0].id }, "Open order")) : null,
      rows.length ? h("div", { class: "list" }, rows)
        : h("div", { class: "empty" }, h("p", { class: "h-md" }, "No orders yet"),
            h("p", {}, "Start with your athlete's info and a photo, then send us game film."),
            h("a", { class: "btn", href: "#/new" }, "Order a reel")),
      athletes.filter((a) => a.parent_id === me.id).length ? h("div", { class: "stack" },
        h("h2", { class: "h-md" }, "Athlete profiles"),
        h("div", { class: "row" }, athletes.filter((a) => a.parent_id === me.id).map((a) =>
          h("a", { class: "btn ghost sm", href: "#/athlete/" + a.id }, "Edit " + a.name)))) : null);
  }
  function initials(n) { return (n || "?").split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase(); }

  // ---------- athlete form (shared by wizard and edit page) ----------
  function athleteForm(a) {
    const f = (k, label, opts = {}) => {
      const input = opts.select ? h("select", { id: "a_" + k, name: k },
          h("option", { value: "" }, "Choose…"), opts.select.map((o) => h("option", { value: o, selected: a[k] === o }, o)))
        : h("input", { id: "a_" + k, name: k, value: a[k] ?? "", placeholder: opts.ph || "", inputmode: opts.inputmode, autocomplete: "off" });
      return h("label", { class: "f" + (opts.full ? " full" : ""), for: "a_" + k }, label, input, opts.hint ? h("span", { class: "hint" }, opts.hint) : null);
    };
    const details = h("div", { class: "grid three full", id: "details" });
    const renderDetails = (sport, keep) => {
      const existing = Object.fromEntries((keep || []).map((d) => [d.label, d.value]));
      const labels = [...new Set([...(SPORT_STATS[sport] || []), ...Object.keys(existing)])];
      details.replaceChildren(...labels.map((l, i) => h("label", { class: "f", for: "d_" + i }, l,
        h("input", { id: "d_" + i, "data-label": l, value: existing[l] ?? "", placeholder: "optional" }))));
    };
    renderDetails(a.sport, a.details);
    const grid = h("div", { class: "grid" },
      f("name", "Athlete name", { full: true, ph: "First and last name" }),
      f("sport", "Sport", { select: SPORTS }),
      f("position", "Position", { ph: "e.g. WR, Point guard, Pitcher" }),
      f("grad_year", "Grad year", { ph: "e.g. 2028", inputmode: "numeric" }),
      f("number", "Jersey #", { ph: "e.g. 7", inputmode: "numeric" }),
      f("school", "School or team", { full: true, ph: "High school or club team" }),
      f("height", "Height", { ph: "e.g. 5'10\"" }),
      f("weight", "Weight", { ph: "e.g. 165 lbs" }),
      f("gpa", "GPA", { ph: "e.g. 3.5", hint: "Coaches filter on academics first. It gets highlighted on the card." }),
      f("test_score", "ACT / SAT", { ph: "e.g. ACT 26 (optional)" }),
      h("div", { class: "full stack", style: "gap:8px" }, h("span", { class: "eyebrow", style: "color:var(--muted)" }, "Measurables"),
        h("span", { class: "hint" }, "Fill in what you have; leave the rest blank. Tested numbers (combines, showcases) carry the most weight.")),
      details,
      f("stats", "Season stats line", { full: true, ph: "Your best numbers this season (optional)" }),
      f("profile_link", "Recruiting profile link", { full: true, ph: "Hudl, Perfect Game, MaxPreps (optional)" }));
    // Switching sport swaps in that sport's measurables (e.g. 40 YD -> Exit Velo). What was typed for the
    // previous sport is remembered while the form is open, so switching back restores it.
    const bySport = { [a.sport || ""]: a.details || [] };
    let curSport = a.sport || "";
    grid.querySelector("#a_sport").addEventListener("change", (e) => {
      bySport[curSport] = readDetails();
      curSport = e.target.value;
      renderDetails(curSport, bySport[curSport] || []);
    });
    function readDetails() {
      return [...details.querySelectorAll("input")].map((i) => ({ label: i.dataset.label, value: i.value.trim() })).filter((d) => d.value);
    }
    grid.read = () => {
      const val = (k) => grid.querySelector("#a_" + k).value.trim();
      const out = { ...a };
      for (const k of ["name", "sport", "position", "number", "school", "height", "weight", "gpa", "test_score", "stats", "profile_link"]) out[k] = val(k) || null;
      out.grad_year = parseInt(val("grad_year"), 10) || null;
      out.details = readDetails();
      return out;
    };
    grid.validate = () => {
      const x = grid.read();
      if (!x.name) return "Add the athlete's name.";
      if (!x.sport) return "Choose a sport.";
      if (x.grad_year && (x.grad_year < 2024 || x.grad_year > 2045)) return "Check the grad year.";
      return null;
    };
    return grid;
  }

  // ---------- photo uploader with live player-card preview ----------
  function photoStep(state, onUploaded) {
    const a = state.athlete;
    const card = h("div", { class: "pcard", style: `--card:${state.team_color || "#2F7BFF"}` });
    const checks = h("ul", { class: "checks", "aria-live": "polite" });
    const bar = h("div", { class: "bar-fill" });
    const progress = h("div", { class: "bar-track", hidden: true }, bar);
    const input = h("input", { type: "file", accept: "image/*", id: "photo" });
    const drop = h("label", { class: "drop", for: "photo" }, input,
      h("span", { class: "h-md" }, state.photo_url ? "Replace photo" : "Upload a player photo"),
      h("span", { class: "small muted" }, "Drag a photo here or tap to choose (JPG, PNG or HEIC exported as JPG)"));
    const drawCard = () => {
      const parts = (a.name || "Athlete Name").trim().split(/\s+/);
      const ln = parts.pop(), fn = parts.join(" ");
      const tiles = [["Height", a.height], ["Weight", a.weight], ...(a.details || []).map((d) => [d.label, d.value])].filter((t) => t[1]).slice(0, 5);
      const gpa = a.gpa ? [["GPA", a.gpa, true]] : [];
      card.replaceChildren(
        h("div", { class: "glow" }), h("div", { class: "bar" }),
        a.number ? h("div", { class: "num" }, a.number) : null,
        h("div", { class: "who" },
          h("div", { class: "e" }, [a.sport, a.position, a.grad_year && "Class of " + a.grad_year].filter(Boolean).join(" · ")),
          fn ? h("div", { class: "fn" }, fn) : null, h("div", { class: "ln" }, ln),
          h("div", { class: "sub" }, [a.number && "#" + a.number, a.school].filter(Boolean).join(" · ")),
          h("div", { class: "tiles" }, [...tiles, ...gpa].slice(0, 6).map(([k, v, hl]) => h("div", { class: "tile" + (hl ? " hl" : "") }, h("b", {}, k), h("span", {}, v))))),
        state.photo_url ? h("img", { class: "photo", src: state.photo_url, alt: `Photo of ${a.name || "athlete"}` })
          : h("div", { class: "placeholder" }, "Your photo here"),
        a.number ? h("div", { class: "jersey", "aria-hidden": "true" }, "#" + a.number) : null);
    };
    const check = (file, img) => {
      const out = [];
      const tall = img.naturalHeight >= img.naturalWidth;
      out.push([tall, tall ? "Portrait orientation" : "Landscape photo: a vertical (portrait) shot fills the card better"]);
      out.push([img.naturalHeight >= 1000, img.naturalHeight >= 1000 ? `Sharp enough (${img.naturalWidth}×${img.naturalHeight})` : `Small photo (${img.naturalWidth}×${img.naturalHeight}): it may look soft`]);
      out.push([file.size < 25e6, file.size < 25e6 ? "File size OK" : "Very large file: this may take a while to upload"]);
      checks.replaceChildren(...out.map(([ok, t]) => h("li", { class: ok ? "" : "warn" }, t)));
    };
    const handle = async (file) => {
      if (!file) return;
      if (!/^image\//.test(file.type)) { toast("That isn't an image file"); return; }
      const local = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => check(file, img);
      img.src = local;
      state.photo_url = local; drawCard();
      progress.hidden = false; bar.style.width = "0%";
      try {
        if (!a.id) Object.assign(a, await B.saveAthlete(a));
        const up = await B.uploadPhoto(a.id, file, (p) => (bar.style.width = p + "%"));
        a.photo_path = up.path; if (B.mode === "demo") a.photo_url = up.url;
        Object.assign(a, await B.saveAthlete(a));
        state.photo_url = up.url || local; drawCard();
        toast("Photo uploaded"); onUploaded && onUploaded();
      } catch (e) { toast(e.message || "Upload failed"); }
      progress.hidden = true;
    };
    input.addEventListener("change", () => handle(input.files[0]));
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); handle(e.dataTransfer.files[0]); });
    drawCard();
    return h("div", { class: "photo-wrap" },
      h("div", { class: "stack" }, h("p", { class: "eyebrow" }, "Player card preview"), card,
        h("p", { class: "small muted" }, "We remove the background and animate the photo for the opening of the reel.")),
      h("div", { class: "stack" }, drop, progress, checks,
        h("div", { class: "card tight" }, h("p", { class: "h-md", style: "margin-bottom:6px" }, "Photo tips"),
          h("ul", { class: "tips" },
            h("li", {}, "In uniform, waist-up or full body, facing the camera"),
            h("li", {}, "Face visible (helmet off or visor clear)"),
            h("li", {}, "Good light; any background is fine"),
            h("li", {}, "Just your athlete in the shot, not a team photo")))));
  }

  // ---------- new order wizard ----------
  const STEP_NAMES = ["Athlete", "Photo", "Film", "Package", "Review"];
  async function wizard(me, pkg) {
    const athletes = (await B.listAthletes()).filter((a) => a.parent_id === me.id);
    const state = { step: 0, athlete: {}, films: [], links: [""], notes: "", music: "", team_color: "#2F7BFF", package: pkgOf(pkg) ? pkg : "well-known", rush: false, photo_url: null };
    const root = h("section", { class: "stack" });
    let form;
    const draw = async () => {
      const s = state.step;
      const body = h("div", {});
      const next = h("button", { class: "btn", type: "button" }, s === 4 ? (B.mode === "demo" ? "Place order (demo)" : "Continue to payment") : "Next");
      const back = h("button", { class: "btn ghost", type: "button", onclick: () => { state.step--; draw(); } }, "Back");
      const err = h("p", { class: "err", role: "alert" });
      if (s === 0) {
        const pickRow = athletes.length ? h("div", { class: "stack", style: "margin-bottom:18px" },
          h("span", { class: "eyebrow", style: "color:var(--muted)" }, "Order for"),
          h("div", { class: "row" },
            athletes.map((a) => h("button", { class: "btn sm " + (state.athlete.id === a.id ? "" : "ghost"), type: "button",
              onclick: async () => { state.athlete = { ...a }; state.photo_url = await B.photoUrl(a); draw(); } }, a.name)),
            h("button", { class: "btn sm " + (!state.athlete.id ? "" : "ghost"), type: "button", onclick: () => { state.athlete = {}; state.photo_url = null; draw(); } }, "+ New athlete"))) : null;
        form = athleteForm(state.athlete);
        body.append(pickRow || "", form);
        next.onclick = async () => {
          const e = form.validate(); if (e) { err.textContent = e; return; }
          next.disabled = true;
          try { state.athlete = await B.saveAthlete(form.read()); if (B.mode === "demo") state.photo_url = state.athlete.photo_url || state.photo_url; state.step++; draw(); }
          catch (x) { err.textContent = x.message; next.disabled = false; }
        };
      } else if (s === 1) {
        body.append(photoStep(state, () => (next.textContent = "Next")));
        next.onclick = () => { state.step++; draw(); };
        if (!state.photo_url) next.textContent = "Skip for now";
      } else if (s === 2) {
        body.append(filmStep(state));
        next.onclick = () => {
          const links = state.links.map((l) => l.trim()).filter(Boolean);
          if (!links.length && !state.films.length) { err.textContent = "Add at least one video file or film link."; return; }
          const bad = links.find((l) => !/^https?:\/\//i.test(l));
          if (bad) { err.textContent = `"${bad}" doesn't look like a link. Links start with https://`; return; }
          state.step++; draw();
        };
      } else if (s === 3) {
        body.append(packageStep(state));
        next.onclick = () => { state.step++; draw(); };
      } else {
        body.append(reviewStep(state));
        next.onclick = () => submit(state, next, err);
      }
      root.replaceChildren(
        h("div", {}, h("p", { class: "eyebrow" }, `Step ${s + 1} of 5`), h("h1", { class: "h-lg" }, ["Your athlete", "Player photo", "Game film", "Choose a package", "Review your order"][s])),
        h("ol", { class: "steps", "aria-hidden": "true" }, STEP_NAMES.map((_, i) => h("li", {}, h("div", { class: "step" + (i <= s ? " on" : "") })))),
        h("div", { class: "step-labels" }, STEP_NAMES.map((n, i) => h("span", { class: i === s ? "on" : "" }, n))),
        body, err,
        h("div", { class: "nav-btns" }, s ? back : h("a", { class: "btn ghost", href: "#/" }, "Cancel"), next));
      window.scrollTo({ top: 0 });
    };
    await draw();
    return root;
  }

  function filmStep(state) {
    const list = h("div", { class: "list" });
    const summary = h("p", { class: "small", style: "margin:0" });
    const warn = h("div", { class: "stack", style: "gap:4px" });
    const input = h("input", { type: "file", accept: "video/*", multiple: true, id: "film" });
    const drawList = () => {
      const total = state.films.reduce((a, f) => a + f.file.size, 0);
      summary.textContent = state.films.length
        ? `${state.films.length} video${state.films.length > 1 ? "s" : ""} ready · ${fmtSize(total)} · they upload when you place the order`
        : "No videos added yet.";
      summary.className = state.films.length ? "small" : "small muted";
      list.replaceChildren(...state.films.map((f, i) => {
        f.url = f.url || URL.createObjectURL(f.file);
        const thumb = h("video", { src: f.url + "#t=0.5", muted: true, preload: "metadata", playsinline: true,
          style: "width:96px;height:54px;object-fit:cover;border-radius:6px;background:#000;flex:none" });
        const dur = h("span", { class: "small muted" });
        thumb.addEventListener("loadedmetadata", () => {
          const d = thumb.duration; if (isFinite(d)) dur.textContent = ` · ${Math.floor(d / 60)}:${String(Math.round(d % 60)).padStart(2, "0")}`;
        });
        return h("div", { class: "file", style: "grid-template-columns:auto minmax(0,1fr) auto" },
          thumb,
          h("div", { style: "min-width:0" }, h("div", { class: "name" }, f.file.name), h("span", { class: "small muted" }, fmtSize(f.file.size)), dur),
          h("button", { class: "link", type: "button", "aria-label": `Remove ${f.file.name}`,
            onclick: () => { URL.revokeObjectURL(f.url); state.films.splice(i, 1); drawList(); } }, "Remove"));
      }));
    };
    const add = (files) => {
      const max = (cfg.MAX_UPLOAD_MB || 50) * 1e6;
      let added = 0; const tooBig = [];
      for (const file of files) {
        if (!file.type.startsWith("video/") && !/\.(mp4|mov|m4v|avi|mkv|webm)$/i.test(file.name)) { toast(`${file.name} isn't a video file`); continue; }
        if (file.size > max) { tooBig.push(file); continue; }
        if (state.films.some((f) => f.file.name === file.name && f.file.size === file.size)) continue;
        state.films.push({ file }); added++;
      }
      if (added) toast(`${added} video${added > 1 ? "s" : ""} added`);
      drawList();
      warn.replaceChildren(...tooBig.map((f) => h("p", { class: "small", style: "margin:0;color:var(--warn,#FFB547)" },
        `${f.name} is ${fmtSize(f.size)}, over the ${cfg.MAX_UPLOAD_MB} MB upload limit. Share it with a Google Drive, Dropbox or Hudl link below instead.`)));
    };
    input.addEventListener("change", () => { add(input.files); input.value = ""; });
    const links = h("div", { class: "stack", style: "gap:8px" });
    const drawLinks = () => links.replaceChildren(...state.links.map((l, i) => h("input", { value: l, "aria-label": `Film link ${i + 1}`, placeholder: "https://hudl.com/…  or a Google Drive / Dropbox / GameChanger link",
      oninput: (e) => (state.links[i] = e.target.value) })),
      h("button", { class: "link", type: "button", onclick: () => { state.links.push(""); drawLinks(); } }, "+ Add another link"));
    drawLinks(); drawList();
    const filmDrop = h("label", { class: "drop", for: "film" }, input, h("span", { class: "h-md" }, "Choose or drop videos"),
      h("span", { class: "small muted" }, `Phone videos, screen recordings, exported clips. Up to ${cfg.MAX_UPLOAD_MB} MB each; bigger files go by link.`));
    filmDrop.addEventListener("dragover", (e) => { e.preventDefault(); filmDrop.classList.add("over"); });
    filmDrop.addEventListener("dragleave", () => filmDrop.classList.remove("over"));
    filmDrop.addEventListener("drop", (e) => { e.preventDefault(); filmDrop.classList.remove("over"); add(e.dataTransfer.files); });
    const notes = h("textarea", { id: "notes", placeholder: "e.g. Wearing #7 in white. Best plays: the long TD in the 4th quarter, the diving catch in game 2…" });
    notes.value = state.notes; notes.addEventListener("input", () => (state.notes = notes.value));
    return h("div", { class: "stack" },
      h("div", { class: "card stack" }, h("h2", { class: "h-md" }, "Upload video files"),
        filmDrop,
        warn, summary, list),
      h("div", { class: "card stack" }, h("h2", { class: "h-md" }, "Or share links"),
        h("p", { class: "small muted", style: "margin:0" }, "Full games from Hudl or GameChanger, or a shared Google Drive / Dropbox folder. Make sure the link is viewable by anyone with it."),
        links),
      h("label", { class: "f", for: "notes" }, "Which plays should we look for?", notes,
        h("span", { class: "hint" }, "Jersey color and number, and any plays you don't want us to miss.")));
  }

  function packageStep(state) {
    const opts = h("div", { class: "pick", role: "group", "aria-label": "Package" });
    const card = (p) => h("button", { class: "choice", type: "button", "aria-pressed": String(state.package === p.id),
      onclick: () => { state.package = p.id; drawOpts(); } },
      p.featured ? h("span", { class: "badge" }, "Most popular") : null,
      h("span", { class: "name" }, p.name), h("span", { class: "price" }, money(p.price)),
      h("span", { class: "small muted" }, p.plays), h("ul", {}, p.includes.map((x) => h("li", {}, x))));
    const recruiting = cfg.PACKAGES.filter((p) => p.line !== "youth"), youth = cfg.PACKAGES.filter((p) => p.line === "youth");
    const drawOpts = () => opts.replaceChildren(
      ...(youth.length ? [h("p", { class: "eyebrow", style: "grid-column:1/-1;margin:0" }, "Recruiting reels")] : []),
      ...recruiting.map(card),
      ...(youth.length ? [h("p", { class: "eyebrow", style: "grid-column:1/-1;margin:14px 0 0" }, "Youth"), ...youth.map(card)] : []));
    drawOpts();
    const rush = h("input", { type: "checkbox", id: "rush", style: "width:22px;min-height:22px" });
    rush.checked = state.rush; rush.addEventListener("change", () => (state.rush = rush.checked));
    const color = h("input", { type: "color", id: "color", value: state.team_color, style: "height:44px;padding:4px" });
    color.addEventListener("input", () => (state.team_color = color.value));
    const music = h("input", { id: "music", value: state.music, placeholder: "e.g. hype hip-hop, rock, no lyrics" });
    music.addEventListener("input", () => (state.music = music.value));
    return h("div", { class: "stack" }, opts,
      h("label", { class: "row card tight", for: "rush", style: "cursor:pointer" }, rush,
        h("span", {}, h("strong", {}, cfg.RUSH.label), " ", h("span", { class: "muted" }, "+" + money(cfg.RUSH.price)))),
      h("div", { class: "grid" },
        h("label", { class: "f", for: "color" }, "Team color", color, h("span", { class: "hint" }, "We brand the reel in your team's color.")),
        h("label", { class: "f", for: "music" }, "Music vibe", music, h("span", { class: "hint" }, "We use licensed music so the reel won't get muted on social."))));
  }

  function total(state) { return (pkgOf(state.package)?.price || 0) + (state.rush ? cfg.RUSH.price : 0); }

  function reviewStep(state) {
    const a = state.athlete, p = pkgOf(state.package);
    const links = state.links.map((l) => l.trim()).filter(Boolean);
    return h("div", { class: "two" },
      h("div", { class: "card stack" },
        h("dl", { class: "kv" },
          h("dt", {}, "Athlete"), h("dd", {}, [a.name, a.sport, a.position, a.grad_year && "Class of " + a.grad_year].filter(Boolean).join(" · ")),
          h("dt", {}, "School"), h("dd", {}, a.school || "–"),
          h("dt", {}, "Photo"), h("dd", {}, state.photo_url ? "Uploaded" : "Not yet (you can add it later)"),
          h("dt", {}, "Film"), h("dd", {}, `${state.films.length} file(s), ${links.length} link(s)`),
          h("dt", {}, "Notes"), h("dd", {}, state.notes || "–"),
          h("dt", {}, "Music"), h("dd", {}, state.music || "Our pick"))),
      h("div", { class: "card stack" },
        h("div", { class: "row between" }, h("span", {}, p.name), h("strong", {}, money(p.price))),
        state.rush ? h("div", { class: "row between" }, h("span", {}, cfg.RUSH.label), h("strong", {}, money(cfg.RUSH.price))) : null,
        state.rush && !pkgOf(state.package)?.pay_rush ? h("p", { class: "callout small", style: "margin:8px 0 0" }, h("strong", {}, "Rush: "), `on the payment page, tap Add next to ${cfg.RUSH.label} so your total is ${money(total(state))}.`) : null,
        h("div", { class: "row between", style: "border-top:1px solid var(--line);padding-top:12px" }, h("span", { class: "h-md" }, "Total"), h("span", { class: "h-lg" }, money(total(state)))),
        h("p", { class: "small muted", style: "margin:0" }, B.mode === "demo" ? "Demo mode: no payment is taken." : "You'll pay securely with Stripe. Your film uploads when you place the order.")));
  }

  async function submit(state, btn, err) {
    btn.disabled = true; err.textContent = "";
    const a = state.athlete;
    try {
      const order = await B.createOrder({
        athlete_id: a.id, athlete: { ...a, photo_url: undefined }, package: state.package, price: total(state), rush: state.rush,
        film_links: state.links.map((l) => l.trim()).filter(Boolean), notes: state.notes || null, music: state.music || null, team_color: state.team_color,
      });
      if (state.films.length) {
        const box = h("div", { class: "list" });
        err.replaceWith(box);
        for (const f of state.films) {
          const fill = h("div", { class: "bar-fill" });
          box.append(h("div", { class: "file" }, h("span", { class: "name" }, f.file.name), h("span", { class: "small muted" }, "Uploading…"), h("div", { class: "bar-track" }, fill)));
          await B.uploadFilm(order.id, f.file, (p) => (fill.style.width = p + "%"));
        }
      }
      const pkgP = pkgOf(state.package);
      const pay = (state.rush && pkgP?.pay_rush) || pkgP?.pay;
      if (pay && B.mode !== "demo") {
        await B.updateOrder(order.id, { payment_started: true }).catch(() => {});
        rememberPay(order.id);
        const u = new URL(pay);
        u.searchParams.set("client_reference_id", order.id);
        u.searchParams.set("prefilled_email", (await B.session()).email);
        location.href = u.toString();
        return;
      }
      toast("Order placed");
      go("#/order/" + order.id);
    } catch (x) { err.textContent = x.message || "Something went wrong placing the order. Try again."; btn.disabled = false; }
  }

  // ---------- order detail ----------
  async function orderView(me, id) {
    const o = await B.getOrder(id);
    if (!o) return h("div", { class: "empty" }, "We couldn't find that order. ", h("a", { href: "#/" }, "Back to your orders"));
    const files = await B.listFiles(id);
    const admin = me.is_admin;
    const idx = STATUSES.findIndex((s) => s.id === o.status);
    const reached = new Set((o.history || []).map((x) => x.status));
    const tl = h("ol", { class: "timeline" }, STATUSES.filter((s) => s.id !== "revision" || reached.has("revision")).map((s) => {
      const i = STATUSES.indexOf(s);
      const cls = s.id === o.status ? "now" : reached.has(s.id) || i < idx ? "done" : "";
      const when = (o.history || []).filter((x) => x.status === s.id).pop();
      return h("li", { class: cls }, h("div", { class: "t" }, s.label), when ? h("div", { class: "small" }, fmtDate(when.at)) : null,
        s.id === o.status ? h("div", { class: "small muted" }, s.parent) : null);
    }));
    const a = o.athlete || {};
    const p = pkgOf(o.package);
    const act = h("div", { class: "stack" });
    if (!admin && !o.paid && o.status === "submitted") {
      const pay = (o.rush && p?.pay_rush) || p?.pay;
      act.append(h("div", { class: "callout" }, h("p", { style: "margin:0 0 10px" }, h("strong", {}, "Payment needed. "), "We start as soon as it's in."),
        o.rush && !p?.pay_rush ? h("p", { class: "small", style: "margin:0 0 10px" }, h("strong", {}, "Rush order: "), `on the payment page, tap Add next to ${cfg.RUSH.label} so the total is ${money(o.price)}.`) : null,
        pay && B.mode !== "demo" ? h("a", { class: "btn", href: `${pay}?client_reference_id=${encodeURIComponent(o.id)}`, onclick: () => rememberPay(o.id) }, `Pay ${money(o.price)}`)
          : h("p", { class: "small muted", style: "margin:0" }, B.mode === "demo" ? "Demo mode: payment is skipped." : `Questions? Email ${cfg.CONTACT_EMAIL}.`)));
    }
    if (o.status === "review" && !admin) {
      const notes = h("textarea", { id: "rev", placeholder: "What should we change? e.g. swap play 3 for the interception, use a different song…" });
      act.append(h("div", { class: "callout stack" }, h("strong", {}, "Your draft is ready."),
        o.reel_url ? h("a", { class: "btn", href: o.reel_url, target: "_blank", rel: "noopener" }, "Watch the draft") : null,
        h("label", { class: "f", for: "rev" }, "Request changes", notes),
        h("div", { class: "row" },
          h("button", { class: "btn ghost", onclick: async () => { if (!notes.value.trim()) { toast("Tell us what to change"); return; } await B.updateOrder(o.id, { status: "revision", revision_notes: notes.value.trim() }); toast("Sent to the editor"); render(); } }, "Send changes"),
          h("a", { class: "small muted", href: `mailto:${cfg.CONTACT_EMAIL}?subject=Approve reel ${o.id.slice(0, 8)}` }, `Love it? Reply to approve, or email ${cfg.CONTACT_EMAIL}`))));
    }
    if (o.status === "delivered" && (o.reel_url || o.vertical_url)) {
      act.append(h("div", { class: "callout good stack" }, h("strong", {}, "Your reel is ready!"),
        h("div", { class: "row" },
          o.reel_url ? h("a", { class: "btn", href: o.reel_url, target: "_blank", rel: "noopener" }, "Full reel") : null,
          o.vertical_url ? h("a", { class: "btn ghost", href: o.vertical_url, target: "_blank", rel: "noopener" }, "Instagram cut") : null),
        h("p", { class: "small muted", style: "margin:0" }, "Tag @knowngoodmedia when you post it!")));
    }
    if (admin) act.append(adminPanel(o));
    const fileRows = files.map((f) => h("div", { class: "file" }, h("span", { class: "name" }, f.name), h("span", { class: "small muted" }, fmtSize(f.size || 0),
      admin && B.mode !== "demo" ? h("button", { class: "link", style: "margin-left:10px", onclick: async () => { const u = await B.fileUrl(f); if (u) window.open(u, "_blank"); } }, "Download") : null)));
    return h("section", { class: "stack" },
      h("a", { href: admin ? "#/admin" : "#/", class: "small" }, "← Back"),
      h("div", { class: "row between" },
        h("div", {}, h("p", { class: "eyebrow" }, `Order ${o.id.slice(0, 8).toUpperCase()} · ${fmtDate(o.created_at)}`), h("h1", { class: "h-lg" }, a.name || "Athlete")),
        pill(o.status)),
      act,
      h("div", { class: "two" },
        h("div", { class: "card" }, h("h2", { class: "h-md", style: "margin-bottom:14px" }, "Progress"), tl),
        h("div", { class: "card stack" }, h("h2", { class: "h-md" }, "Order details"),
          h("dl", { class: "kv" },
            h("dt", {}, "Package"), h("dd", {}, `${p?.name || o.package}${o.rush ? " + rush" : ""} · ${money(o.price)}${o.paid ? (o.paid_amount != null ? ` · paid ${money(o.paid_amount)} via Stripe` : " · paid") : ""}`,
              o.paid && o.paid_amount != null && Number(o.paid_amount) < Number(o.price)
                ? h("span", { class: "small", style: "display:block;color:var(--warn,#FFB547)" }, `Paid ${money(o.price - o.paid_amount)} less than the order total. Check Stripe.`) : null),
            h("dt", {}, "Athlete"), h("dd", {}, [a.sport, a.position, a.grad_year && "Class of " + a.grad_year, a.school].filter(Boolean).join(" · ") || "–"),
            h("dt", {}, "Card"), h("dd", {}, [a.height, a.weight, a.gpa && "GPA " + a.gpa, ...(a.details || []).map((d) => `${d.label} ${d.value}`)].filter(Boolean).join(" · ") || "–"),
            h("dt", {}, "Notes"), h("dd", {}, o.notes || "–"),
            h("dt", {}, "Music"), h("dd", {}, o.music || "Our pick"),
            o.revision_notes ? [h("dt", {}, "Changes"), h("dd", {}, o.revision_notes)] : null),
          fileRows.length ? h("div", { class: "list" }, fileRows) : null,
          (o.film_links || []).length ? h("div", { class: "stack", style: "gap:6px" }, o.film_links.map((l) => h("a", { href: l, target: "_blank", rel: "noopener noreferrer", class: "small", style: "overflow-wrap:anywhere" }, l))) : null,
          !admin && o.athlete_id ? h("a", { class: "btn ghost sm", href: "#/athlete/" + o.athlete_id }, "Update profile or photo") : null)));
  }

  // ---------- admin ----------
  function adminPanel(o) {
    const status = h("select", { id: "st" }, STATUSES.map((s) => h("option", { value: s.id, selected: s.id === o.status }, s.label)));
    const paid = h("input", { type: "checkbox", id: "paid", style: "width:22px;min-height:22px" }); paid.checked = !!o.paid;
    const reel = h("input", { id: "reel", value: o.reel_url || "", placeholder: "Link to the reel (YouTube unlisted, Drive, Dropbox…)" });
    const vert = h("input", { id: "vert", value: o.vertical_url || "", placeholder: "Link to the vertical cut" });
    return h("div", { class: "card stack", style: "border-color:var(--accent)" },
      h("div", { class: "row between" }, h("h2", { class: "h-md" }, "Owner controls"),
        h("button", { class: "btn ghost sm", onclick: () => downloadJob(o) }, "Download job.json for the studio")),
      h("div", { class: "grid" },
        h("label", { class: "f", for: "st" }, "Status", status),
        h("label", { class: "row", for: "paid", style: "align-self:end;min-height:44px;cursor:pointer" }, paid, h("span", {}, "Payment received")),
        h("label", { class: "f full", for: "reel" }, "Reel link", reel),
        h("label", { class: "f full", for: "vert" }, "Vertical cut link", vert)),
      h("div", { class: "row" }, h("button", { class: "btn", onclick: async () => {
        await B.updateOrder(o.id, { status: status.value, paid: paid.checked, reel_url: reel.value.trim() || null, vertical_url: vert.value.trim() || null });
        toast("Order updated"); render();
      } }, "Save"), h("span", { class: "small muted" }, `Parent: ${o.parent_email || "–"}`),
        h("button", { class: "btn ghost sm danger", style: "margin-left:auto", onclick: () => deleteOrder(o, () => go("#/admin")) }, "Delete order")));
  }

  async function deleteOrder(o, after) {
    const who = o.athlete?.name || "this athlete";
    const msg = `Delete the order for ${who}? This removes the order and its uploaded film for good.` +
      (o.paid ? "\n\nThis order is marked paid. Deleting it does not refund the payment; do that in Stripe if needed." : "");
    if (!confirm(msg)) return;
    try { await B.deleteOrder(o.id); toast("Order deleted"); after(); }
    catch (e) { toast(e.message || "Couldn't delete the order"); }
  }

  async function downloadJob(o) {
    const a = o.athlete || {};
    const files = await B.listFiles(o.id);
    const job = {
      order_id: o.id,
      athlete: Object.fromEntries(Object.entries({ name: a.name, number: a.number, sport: a.sport, position: a.position, grad_year: a.grad_year,
        school: a.school, height: a.height, weight: a.weight, gpa: a.gpa, test_score: a.test_score, details: a.details, stats: a.stats,
        profile: a.profile_link, photo: a.photo_path ? a.photo_path.split("/").pop() : undefined }).filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && !v.length))),
      accent: o.team_color, notes: o.notes, music_request: o.music, film_links: o.film_links,
      film_files: files.filter((f) => f.kind === "film").map((f) => f.name), clips: [],
    };
    const blob = new Blob([JSON.stringify(job, null, 2)], { type: "application/json" });
    const link = h("a", { href: URL.createObjectURL(blob), download: "job.json" }); document.body.append(link); link.click(); link.remove();
    toast("job.json downloaded");
  }

  async function adminView(me) {
    if (!me.is_admin) return h("div", { class: "empty" }, "This page is for the Known Good Media team.");
    const orders = await B.listOrders();
    const counts = Object.fromEntries(STATUSES.map((s) => [s.id, orders.filter((o) => o.status === s.id).length]));
    let filter = "open"; try { filter = sessionStorage.getItem("kgm-admin-filter") || "open"; } catch (e) {}
    const tbody = h("tbody");
    const bar = h("div", { class: "filters", role: "group", "aria-label": "Filter orders" });
    const draw = () => {
      const shown = orders.filter((o) => filter === "all" || (filter === "open" ? o.status !== "delivered" : o.status === filter));
      bar.replaceChildren(...[["open", "Open"], ["all", "All"], ...STATUSES.map((s) => [s.id, `${s.label} (${counts[s.id]})`])].map(([id, label]) =>
        h("button", { type: "button", "aria-pressed": String(filter === id), onclick: () => { filter = id; try { sessionStorage.setItem("kgm-admin-filter", id); } catch (e) {} draw(); } }, label)));
      tbody.replaceChildren(...(shown.length ? shown.map((o) => h("tr", {},
        h("td", {}, h("a", { href: "#/order/" + o.id }, o.athlete?.name || "Athlete")),
        h("td", {}, [o.athlete?.sport, o.athlete?.grad_year].filter(Boolean).join(" · ")),
        h("td", {}, pkgOf(o.package)?.name || o.package, o.rush ? " + rush" : ""),
        h("td", { class: "num" }, money(o.price), o.paid ? " ✓" : ""),
        h("td", {}, pill(o.status)),
        h("td", { class: "num" }, fmtDate(o.created_at)),
        h("td", {}, h("button", { class: "link danger", "aria-label": "Delete order for " + (o.athlete?.name || "athlete"),
          onclick: () => deleteOrder(o, () => { orders.splice(orders.indexOf(o), 1); counts[o.status]--; draw(); }) }, "Delete")))) :
        [h("tr", {}, h("td", { colspan: 7, class: "muted" }, "No orders here."))]));
    };
    draw();
    const open = orders.filter((o) => o.status !== "delivered");
    return h("section", { class: "stack" },
      h("div", {}, h("p", { class: "eyebrow" }, "Owner"), h("h1", { class: "h-lg" }, "Orders")),
      h("div", { class: "grid three" },
        h("div", { class: "card tight" }, h("div", { class: "small muted" }, "Open orders"), h("div", { class: "h-lg" }, open.length)),
        h("div", { class: "card tight" }, h("div", { class: "small muted" }, "Waiting on payment"), h("div", { class: "h-lg" }, orders.filter((o) => !o.paid && o.status === "submitted").length)),
        h("div", { class: "card tight" }, h("div", { class: "small muted" }, "Paid revenue"), h("div", { class: "h-lg" }, money(orders.filter((o) => o.paid).reduce((s, o) => s + (o.price || 0), 0))))),
      bar,
      h("div", { class: "table-wrap" }, h("table", {}, h("thead", {}, h("tr", {}, ["Athlete", "Sport", "Package", "Price", "Status", "Ordered", ""].map((t) => h("th", {}, t)))), tbody)));
  }

  // ---------- athlete edit page ----------
  async function athleteView(me, id) {
    const a = (await B.listAthletes()).find((x) => x.id === id);
    if (!a) return h("div", { class: "empty" }, "Athlete not found.");
    const state = { athlete: { ...a }, photo_url: await B.photoUrl(a) };
    const form = athleteForm(state.athlete);
    const err = h("p", { class: "err", role: "alert" });
    return h("section", { class: "stack" }, h("a", { href: "#/", class: "small" }, "← Back"),
      h("h1", { class: "h-lg" }, a.name),
      photoStep(state),
      h("div", { class: "card" }, form), err,
      h("div", { class: "row" }, h("button", { class: "btn", onclick: async () => {
        const e = form.validate(); if (e) { err.textContent = e; return; }
        await B.saveAthlete({ ...form.read(), photo_path: state.athlete.photo_path, photo_url: state.athlete.photo_url }); toast("Profile saved");
      } }, "Save profile")));
  }

  // ---------- router ----------
  // ---------- back from Stripe ----------
  // Payment Links redirect to /portal/?paid=1. Remember which order is being paid so the parent lands on it.
  function rememberPay(id) { try { localStorage.setItem("kgm-paying", id); } catch (e) {} }
  let paidNotice = false;
  (function () {
    const q = new URLSearchParams(location.search);
    if (q.get("paid") !== "1") return;
    paidNotice = true;
    let id = null;
    try { id = localStorage.getItem("kgm-paying"); localStorage.removeItem("kgm-paying"); } catch (e) {}
    history.replaceState(null, "", location.pathname + (id ? "#/order/" + id : location.hash));
  })();

  let rendering = 0;
  async function render() {
    const my = ++rendering;
    const me = await B.session();
    await chrome(me);
    const [, route, id] = (location.hash || "#/").split("/");
    let view;
    try {
      if (!me) view = signInView();
      else if (route === "new") view = await wizard(me, id);
      else if (route === "order" && id) view = await orderView(me, id);
      else if (route === "admin") view = await adminView(me);
      else if (route === "athlete" && id) view = await athleteView(me, id);
      else view = me.is_admin && !route ? await adminView(me) : await dashboard(me);
    } catch (e) {
      console.error(e);
      view = h("div", { class: "empty" }, "Something went wrong loading this page. ", h("button", { class: "link", onclick: render }, "Try again"));
    }
    if (paidNotice && me && view) {
      paidNotice = false;
      view.prepend(h("div", { class: "callout", role: "status" }, h("strong", {}, "Payment received. Thank you! "),
        "We're getting started on the reel. It can take a minute for the order to show as paid."));
    }
    if (my === rendering) $app.replaceChildren(view);
  }
  window.addEventListener("hashchange", render);
  B.onChange(() => render());
  render();
})();
