// Data layer for the parent portal.
// Two interchangeable backends with the same methods:
//   SupabaseBackend - the real thing (login by email link, database, private file storage)
//   DemoBackend     - saves to this browser only, so the portal can be tried with no accounts
(function () {
  const STATUSES = [
    { id: "submitted", label: "Order placed", parent: "We have your order." },
    { id: "paid", label: "Paid", parent: "Payment received. Thank you!" },
    { id: "film_review", label: "Reviewing film", parent: "We're watching the film and picking plays." },
    { id: "editing", label: "Editing", parent: "Your reel is being built." },
    { id: "review", label: "Ready for your review", parent: "Watch the draft and approve it or ask for changes." },
    { id: "revision", label: "Making changes", parent: "We're working on your requested changes." },
    { id: "delivered", label: "Delivered", parent: "Your reel is ready to download and share." },
  ];

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
  const now = () => new Date().toISOString();
  const safeName = (n) => n.replace(/[^\w.\-]+/g, "_").slice(-80);

  // ---------------- Demo ----------------
  class DemoBackend {
    constructor() {
      this.mode = "demo";
      this.key = "kgm-portal-demo";
      this.listeners = new Set();
      try { this.data = JSON.parse(localStorage.getItem(this.key) || "null"); } catch (e) { this.data = null; }
      if (!this.data) this.data = { user: null, athletes: [], orders: [], files: [] };
    }
    _save(authChanged) {
      try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* private mode: keep in memory */ }
      if (authChanged) this.listeners.forEach((f) => f());
    }
    onChange(f) { this.listeners.add(f); return () => this.listeners.delete(f); }
    async session() { return this.data.user; }
    async signIn(email) {
      // demo: sign in immediately. The owner's email becomes the admin.
      this.data.user = { id: "demo-" + email.toLowerCase(), email, is_admin: /admin/i.test(email) };
      this._save(true);
      return { sent: false, signedIn: true };
    }
    async signOut() { this.data.user = null; this._save(true); }
    async listAthletes() { const u = this.data.user; return this.data.athletes.filter((a) => u && (u.is_admin || a.parent_id === u.id)); }
    async saveAthlete(a) {
      const u = this.data.user;
      const row = { ...a, id: a.id || uid(), parent_id: a.parent_id || u.id, updated_at: now(), created_at: a.created_at || now() };
      const i = this.data.athletes.findIndex((x) => x.id === row.id);
      if (i >= 0) this.data.athletes[i] = row; else this.data.athletes.push(row);
      this._save();
      return row;
    }
    async uploadPhoto(athleteId, file, onProgress) {
      // keep a downsized copy so the demo fits in browser storage
      const url = await downscale(file, 900);
      for (let p = 0; p <= 100; p += 25) { onProgress && onProgress(p); await sleep(60); }
      return { path: `demo/${athleteId}/${safeName(file.name)}`, url };
    }
    async photoUrl(athlete) { return athlete.photo_url || null; }
    async listOrders() { const u = this.data.user; return this.data.orders.filter((o) => u && (u.is_admin || o.parent_id === u.id)).sort((a, b) => b.created_at.localeCompare(a.created_at)); }
    async getOrder(id) { return this.data.orders.find((o) => o.id === id) || null; }
    async createOrder(o) {
      const u = this.data.user;
      const row = { ...o, id: uid(), parent_id: u.id, parent_email: u.email, status: "submitted", history: [{ status: "submitted", at: now() }], created_at: now(), updated_at: now() };
      this.data.orders.push(row); this._save(); return row;
    }
    async updateOrder(id, patch) {
      const o = this.data.orders.find((x) => x.id === id);
      if (!o) throw new Error("Order not found");
      if (patch.status && patch.status !== o.status) o.history = [...(o.history || []), { status: patch.status, at: now() }];
      Object.assign(o, patch, { updated_at: now() }); this._save(); return o;
    }
    async uploadFilm(orderId, file, onProgress) {
      for (let p = 0; p <= 100; p += 10) { onProgress && onProgress(p); await sleep(80); }
      const row = { id: uid(), order_id: orderId, parent_id: this.data.user.id, kind: "film", name: file.name, size: file.size, path: `demo/${orderId}/${safeName(file.name)}`, created_at: now() };
      this.data.files.push(row); this._save(); return row;
    }
    async listFiles(orderId) { return this.data.files.filter((f) => f.order_id === orderId); }
    async fileUrl() { return null; }
  }

  // ---------------- Supabase ----------------
  class SupabaseBackend {
    constructor(cfg) {
      this.mode = "live";
      this.cfg = cfg;
      this.sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      this.listeners = new Set();
      // Supabase fires auth events on tab focus and token refresh too (SIGNED_IN / TOKEN_REFRESHED for the
      // same user). Only re-render when who is signed in actually changes, so half-filled forms survive.
      this._uid = null;
      this.sb.auth.onAuthStateChange((event, session) => {
        const uid = session?.user?.id || null;
        if (uid === this._uid && event !== "SIGNED_OUT") return;
        this._uid = uid;
        this._me = undefined;
        this.listeners.forEach((f) => f());
      });
    }
    onChange(f) { this.listeners.add(f); return () => this.listeners.delete(f); }
    async session() {
      const { data } = await this.sb.auth.getSession();
      const s = data.session;
      if (!s) return null;
      if (this._me === undefined) {
        const { data: p } = await this.sb.from("profiles").select("is_admin").eq("id", s.user.id).maybeSingle();
        this._me = { id: s.user.id, email: s.user.email, is_admin: !!(p && p.is_admin) };
      }
      return this._me;
    }
    async signIn(email) {
      const { error } = await this.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
      return { sent: true };
    }
    async signOut() { await this.sb.auth.signOut(); }
    async listAthletes() { const { data, error } = await this.sb.from("athletes").select("*").order("created_at"); if (error) throw error; return data; }
    async saveAthlete(a) {
      const me = await this.session();
      const row = { ...a, parent_id: a.parent_id || me.id };
      delete row.photo_url;
      const q = a.id ? this.sb.from("athletes").update(row).eq("id", a.id).select().single()
                     : this.sb.from("athletes").insert(row).select().single();
      const { data, error } = await q; if (error) throw error; return data;
    }
    async _upload(bucket, path, file, onProgress) {
      const { data } = await this.sb.auth.getSession();
      const token = data.session.access_token;
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${this.cfg.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`);
        xhr.setRequestHeader("Authorization", "Bearer " + token);
        xhr.setRequestHeader("apikey", this.cfg.SUPABASE_ANON_KEY);
        xhr.setRequestHeader("x-upsert", "true");
        if (file.type) xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => e.lengthComputable && onProgress && onProgress(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText.slice(0, 200)}`)));
        xhr.onerror = () => reject(new Error("Upload failed: check your connection and try again."));
        xhr.send(file);
      });
    }
    async uploadPhoto(athleteId, file, onProgress) {
      const me = await this.session();
      const path = `${me.id}/${athleteId}/${Date.now()}-${safeName(file.name)}`;
      await this._upload("photos", path, file, onProgress);
      return { path, url: await this._signed("photos", path) };
    }
    async _signed(bucket, path, secs = 3600) {
      const { data, error } = await this.sb.storage.from(bucket).createSignedUrl(path, secs);
      return error ? null : data.signedUrl;
    }
    async photoUrl(a) { return a.photo_path ? this._signed("photos", a.photo_path) : null; }
    async listOrders() { const { data, error } = await this.sb.from("orders").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; }
    async getOrder(id) { const { data, error } = await this.sb.from("orders").select("*").eq("id", id).maybeSingle(); if (error) throw error; return data; }
    async createOrder(o) {
      const me = await this.session();
      const { data, error } = await this.sb.from("orders").insert({ ...o, parent_id: me.id, parent_email: me.email }).select().single();
      if (error) throw error; return data;
    }
    async updateOrder(id, patch) { const { data, error } = await this.sb.from("orders").update(patch).eq("id", id).select().single(); if (error) throw error; return data; }
    async uploadFilm(orderId, file, onProgress) {
      const me = await this.session();
      const path = `${me.id}/${orderId}/${Date.now()}-${safeName(file.name)}`;
      await this._upload("film", path, file, onProgress);
      const { data, error } = await this.sb.from("order_files").insert({ order_id: orderId, parent_id: me.id, kind: "film", name: file.name, size: file.size, path }).select().single();
      if (error) throw error; return data;
    }
    async listFiles(orderId) { const { data, error } = await this.sb.from("order_files").select("*").eq("order_id", orderId).order("created_at"); if (error) throw error; return data; }
    async fileUrl(f) { return this._signed(f.kind === "delivery" ? "deliveries" : "film", f.path); }
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  function downscale(file, maxH) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, maxH / img.naturalHeight);
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("That file isn't an image we can read. Try a JPG or PNG."));
      img.src = URL.createObjectURL(file);
    });
  }

  const cfg = window.KGM_CONFIG || {};
  window.KGM = {
    STATUSES,
    backend: cfg.SUPABASE_URL && window.supabase ? new SupabaseBackend(cfg) : new DemoBackend(),
  };
})();
