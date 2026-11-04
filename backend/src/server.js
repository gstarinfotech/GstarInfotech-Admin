import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import pg from "pg";
import nodemailer from "nodemailer";
import { fileURLToPath } from "node:url";

dotenv.config();
const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, "../uploads"));
const UPLOAD_BASE_URL = String(process.env.UPLOAD_BASE_URL || `http://localhost:${process.env.PORT || 4001}`).replace(/\/$/, "");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const PORT = Number(process.env.PORT || 4001);
const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error("JWT_SECRET is required. Configure backend/.env.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required. Add your GStar Neon connection string.");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
const configuredOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",").map((x) => x.trim()).filter(Boolean);
const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  ...configuredOrigins,
]);
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.has(origin)) return cb(null, true);
    console.warn(`[CORS] Blocked origin: ${origin}`);
    return cb(null, false);
  },
}));
app.use(express.json({ limit: "25mb" }));
// Uploaded media is stored on disk; only its URL is saved in Neon.
app.use("/uploads", express.static(UPLOAD_DIR, {
  fallthrough: false,
  setHeaders(res) { res.setHeader("Cache-Control", "public, max-age=31536000, immutable"); },
}));
const imageStorage = multer.diskStorage({
  destination(_req, _file, cb) { cb(null, UPLOAD_DIR); },
  filename(_req, file, cb) {
    const ext = ({ "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "image/avif": ".avif" })[file.mimetype];
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext || ".img"}`);
  },
});
const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    if (!allowed.includes(file.mimetype)) return cb(new Error("Only JPG, PNG, WEBP, GIF and AVIF images are allowed."));
    cb(null, true);
  },
});

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const q = (text, values = []) => pool.query(text, values);
function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { res.status(401).json({ error: "Session expired. Please login again." }); }
}
function cleanPath(v) {
  const p = "/" + String(v || "").replace(/^\/+|\/+$/g, "");
  return p === "/" ? "/" : p.replace(/\/+/g, "/");
}
function safeSlug(v) {
  return String(v || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}
const loginAttempts = new Map();

app.get("/api/health", asyncRoute(async (_req, res) => {
  const r = await q("SELECT NOW() AS database_time");
  res.json({ ok: true, service: "GStar Admin API", database: "connected", databaseTime: r.rows[0].database_time });
}));
app.post("/api/uploads/image", auth, (req, res) => {
  imageUpload.single("file")(req, res, (error) => {
    if (error) {
      const status = error instanceof multer.MulterError ? 400 : 422;
      return res.status(status).json({ error: error.code === "LIMIT_FILE_SIZE" ? "Image must be 8 MB or smaller." : error.message });
    }
    if (!req.file) return res.status(422).json({ error: "Please choose an image to upload." });
    const url = `${UPLOAD_BASE_URL}/uploads/${req.file.filename}`;
    return res.status(201).json({ success: true, url, filename: req.file.filename });
  });
});

app.post("/api/auth/login", asyncRoute(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const key = req.ip + "|" + email;
  const attempt = loginAttempts.get(key) || { count: 0, until: 0 };
  if (attempt.until > Date.now()) return res.status(429).json({ error: "Too many attempts. Try again later." });
  const expectedEmail = String(process.env.ADMIN_EMAIL || "admin@gstarinfotech.com").toLowerCase();
  const configured = String(process.env.ADMIN_PASSWORD || "");
  let validPassword = false;
  if (configured.startsWith("$2")) validPassword = await bcrypt.compare(password, configured);
  else validPassword = Boolean(configured) && password === configured;
  if (email !== expectedEmail || !validPassword) {
    attempt.count++; if (attempt.count >= 6) { attempt.until = Date.now() + 15 * 60 * 1000; attempt.count = 0; }
    loginAttempts.set(key, attempt); return res.status(401).json({ error: "Invalid email or password" });
  }
  loginAttempts.delete(key);
  res.json({ token: jwt.sign({ email }, SECRET, { expiresIn: "8h" }), user: { email } });
}));

app.get("/api/overview", auth, asyncRoute(async (_req, res) => {
  const r = await q(`SELECT
    (SELECT COUNT(*)::int FROM blogs) blogs,
    (SELECT COUNT(*)::int FROM leads) leads,
    (SELECT COUNT(*)::int FROM seo_pages) pages,
    (SELECT COUNT(*)::int FROM projects) projects`);
  res.json(r.rows[0]);
}));

app.get("/api/pages", auth, asyncRoute(async (_req, res) => {
  const r = await q("SELECT data FROM page_inventory ORDER BY path");
  res.json(r.rows.map(x => x.data));
}));
app.get("/api/seo", auth, asyncRoute(async (_req, res) => {
  const r = await q("SELECT path,data FROM seo_pages ORDER BY path");
  res.json(Object.fromEntries(r.rows.map(x => [x.path, x.data])));
}));
app.put("/api/seo/:path(*)", auth, asyncRoute(async (req, res) => {
  const pagePath = cleanPath(req.params.path);
  const found = await q("SELECT data FROM seo_pages WHERE path=$1", [pagePath]);
  if (!found.rowCount) return res.status(404).json({ error: "Page not found in SEO inventory" });
  const current = found.rows[0].data;
  const allowed = ["title", "description", "keywords", "canonicalUrl", "index", "follow", "ogTitle", "ogDescription", "ogImage"];
  for (const k of allowed) if (req.body[k] !== undefined) current[k] = req.body[k];
  current.updatedAt = new Date().toISOString();
  await q("UPDATE seo_pages SET data=$2::jsonb,updated_at=NOW() WHERE path=$1", [pagePath, JSON.stringify(current)]);
  res.json({ success: true, item: current });
}));

app.get("/api/blogs", auth, asyncRoute(async (_req, res) => {
  const r = await q("SELECT data FROM blogs ORDER BY (data->>'date') DESC NULLS LAST, created_at DESC");
  res.json(r.rows.map(x => x.data));
}));
app.post("/api/blogs", auth, asyncRoute(async (req, res) => {
  const item = req.body || {}, slug = safeSlug(item.slug);
  if (!slug || !String(item.title || "").trim()) return res.status(422).json({ error: "Blog title and slug are required" });
  const data = { ...item, slug, updatedAt: new Date().toISOString() };
  const exists = await q("SELECT 1 FROM blogs WHERE slug=$1", [slug]);
  if (exists.rowCount) return res.status(409).json({ error: "A blog with this slug already exists" });
  await q("BEGIN");
  try {
    await q("INSERT INTO blogs(slug,data) VALUES($1,$2::jsonb)", [slug, JSON.stringify(data)]);
    const p = "/blogs/" + slug;
    const seo = { path: p, title: data.metaTitle || "", description: data.metaDescription || "", keywords: "", canonicalUrl: "https://www.gstarinfotech.com" + p, index: true, follow: true, ogTitle: "", ogDescription: "", ogImage: data.coverImage || "", updatedAt: new Date().toISOString() };
    await q("INSERT INTO seo_pages(path,data) VALUES($1,$2::jsonb) ON CONFLICT(path) DO NOTHING", [p, JSON.stringify(seo)]);
    const inventory = { path: p, label: data.title, group: "Blog Pages" };
    await q("INSERT INTO page_inventory(path,data) VALUES($1,$2::jsonb) ON CONFLICT(path) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()", [p, JSON.stringify(inventory)]);
    await q("COMMIT");
  } catch (e) { await q("ROLLBACK"); throw e; }
  res.status(201).json({ success: true, item: data });
}));
app.put("/api/blogs/:slug", auth, asyncRoute(async (req, res) => {
  const oldSlug = String(req.params.slug), item = req.body || {}, newSlug = safeSlug(item.slug || oldSlug);
  if (!String(item.title || "").trim()) return res.status(422).json({ error: "Blog title is required" });
  const found = await q("SELECT data FROM blogs WHERE slug=$1", [oldSlug]);
  if (!found.rowCount) return res.status(404).json({ error: "Blog not found" });
  if (newSlug !== oldSlug && (await q("SELECT 1 FROM blogs WHERE slug=$1", [newSlug])).rowCount) return res.status(409).json({ error: "A blog with this slug already exists" });
  const data = { ...item, slug: newSlug, updatedAt: new Date().toISOString() };
  await q("BEGIN");
  try {
    await q("DELETE FROM blogs WHERE slug=$1", [oldSlug]);
    await q("INSERT INTO blogs(slug,data) VALUES($1,$2::jsonb)", [newSlug, JSON.stringify(data)]);
    const oldPath = "/blogs/" + oldSlug, newPath = "/blogs/" + newSlug;
    if (oldPath !== newPath) {
      const oldSeo = await q("SELECT data FROM seo_pages WHERE path=$1", [oldPath]);
      if (oldSeo.rowCount) { const seo = { ...oldSeo.rows[0].data, path: newPath, title: data.metaTitle || oldSeo.rows[0].data.title, description: data.metaDescription || oldSeo.rows[0].data.description, ogImage: data.coverImage || oldSeo.rows[0].data.ogImage, canonicalUrl: "https://www.gstarinfotech.com" + newPath }; await q("DELETE FROM seo_pages WHERE path=$1", [oldPath]); await q("INSERT INTO seo_pages(path,data) VALUES($1,$2::jsonb) ON CONFLICT(path) DO UPDATE SET data=EXCLUDED.data", [newPath, JSON.stringify(seo)]); }
      await q("DELETE FROM page_inventory WHERE path=$1", [oldPath]);
    } else {
      const oldSeo = await q("SELECT data FROM seo_pages WHERE path=$1", [newPath]);
      if (oldSeo.rowCount) { const seo = { ...oldSeo.rows[0].data, title: data.metaTitle || oldSeo.rows[0].data.title, description: data.metaDescription || oldSeo.rows[0].data.description, ogImage: data.coverImage || oldSeo.rows[0].data.ogImage, updatedAt: new Date().toISOString() }; await q("UPDATE seo_pages SET data=$2::jsonb,updated_at=NOW() WHERE path=$1", [newPath, JSON.stringify(seo)]); }
    }
    const inventory = { path: newPath, label: data.title, group: "Blog Pages" };
    await q("INSERT INTO page_inventory(path,data) VALUES($1,$2::jsonb) ON CONFLICT(path) DO UPDATE SET data=EXCLUDED.data", [newPath, JSON.stringify(inventory)]);
    await q("COMMIT");
  } catch (e) { await q("ROLLBACK"); throw e; }
  res.json({ success: true, item: data });
}));
app.delete("/api/blogs/:slug", auth, asyncRoute(async (req, res) => {
  const slug = String(req.params.slug), p = "/blogs/" + slug;
  const r = await q("DELETE FROM blogs WHERE slug=$1", [slug]);
  if (!r.rowCount) return res.status(404).json({ error: "Blog not found" });
  await q("DELETE FROM seo_pages WHERE path=$1", [p]);
  await q("DELETE FROM page_inventory WHERE path=$1", [p]);
  res.json({ success: true });
}));

app.get("/public/blogs", asyncRoute(async (_req, res) => {
  const r = await q(`
    SELECT data
    FROM blogs
    WHERE UPPER(COALESCE(data->>'status', 'PUBLISHED')) = 'PUBLISHED'
    ORDER BY (data->>'date') DESC NULLS LAST, created_at DESC
  `);
  res.set("Cache-Control", "no-store");
  res.json(r.rows.map((x) => x.data));
}));
app.get("/public/blogs/:slug", asyncRoute(async (req, res) => {
  const r = await q(`
    SELECT data
    FROM blogs
    WHERE slug = $1
      AND UPPER(COALESCE(data->>'status', 'PUBLISHED')) = 'PUBLISHED'
  `, [req.params.slug]);
  if (!r.rowCount) return res.status(404).json({ error: "Blog not found" });
  res.set("Cache-Control", "no-store");
  res.json(r.rows[0].data);
}));
app.get("/public/projects", asyncRoute(async (_req, res) => {
  const r = await q("SELECT id,category_id,data,case_study FROM projects ORDER BY category_id,id");
  const grouped = new Map();
  for (const row of r.rows) { if (!grouped.has(row.category_id)) grouped.set(row.category_id, []); grouped.get(row.category_id).push({ ...row.data, id: row.id, caseStudy: row.case_study || row.data.caseStudy || null }); }
  res.set("Cache-Control", "no-store"); res.json([...grouped.entries()].map(([id, projects]) => ({ id, projects })));
}));
app.get("/public/case-studies", asyncRoute(async (_req, res) => {
  const r = await q("SELECT id,case_study FROM projects WHERE case_study IS NOT NULL ORDER BY id");
  res.set("Cache-Control", "no-store"); res.json(r.rows.map(x => ({ ...x.case_study, id: x.id })));
}));
app.get("/public/projects/:id", asyncRoute(async (req, res) => {
  const r = await q("SELECT id,category_id,data,case_study FROM projects WHERE id=$1", [req.params.id]);
  if (!r.rowCount) return res.status(404).json({ error: "Project not found" });
  res.set("Cache-Control", "no-store"); res.json({ ...r.rows[0].data, id: r.rows[0].id, categoryId: r.rows[0].category_id, caseStudy: r.rows[0].case_study });
}));
app.get("/public/seo", asyncRoute(async (_req, res) => {
  const r = await q("SELECT path,data FROM seo_pages");
  res.set("Cache-Control", "no-store"); res.json(Object.fromEntries(r.rows.map(x => [x.path, x.data])));
}));
app.get("/public/settings", asyncRoute(async (_req, res) => {
  const r = await q("SELECT data FROM site_settings WHERE id=1");
  res.set("Cache-Control", "no-store"); res.json(r.rows[0]?.data || { headCode: "", bodyStartCode: "", bodyEndCode: "" });
}));

// Leads
app.get("/api/leads", auth, asyncRoute(async (_req, res) => {
  const r = await q("SELECT id,data FROM leads ORDER BY created_at DESC");
  res.json(r.rows.map(x => ({ ...x.data, id: x.id })));
}));
app.post("/public/leads", asyncRoute(async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || "").trim();
  const email = String(b.email || "").trim();
  const subject = String(b.subject || "").trim();
  const service = String(b.service || "").trim();
  const message = String(b.message || "").trim();

  if (!name || !email || !subject || !message) {
    return res.status(422).json({ success: false, error: "Name, email, subject and message are required." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(422).json({ success: false, error: "Please provide a valid email address." });
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const data = {
    id, name, email, subject, service, message,
    source: String(b.source || "Website Contact Form"),
    status: "New",
    createdAt,
    submitted_at: createdAt,
    admin_notes: "",
  };

  // Save first. Email is a notification only and must never block or undo the lead.
  await q("INSERT INTO leads(id,data) VALUES($1,$2::jsonb)", [id, JSON.stringify(data)]);

  let emailSent = false;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const recipient = process.env.LEAD_TO || "agrawalsneha600@gmail.com";

  if (smtpHost && smtpUser && smtpPass && recipient) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: String(process.env.SMTP_SECURE || (smtpPort === 465)).toLowerCase() === "true",
        auth: { user: smtpUser, pass: smtpPass },
      });
      const safe = (value) => String(value || "").replace(/[&<>\"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
      }[char]));
      await transporter.sendMail({
        from: process.env.SMTP_FROM || smtpUser,
        to: recipient,
        replyTo: email,
        subject: `New Website Enquiry: ${subject}`,
        text: [
          "A new enquiry was submitted on the GStar Infotech website.",
          `Name: ${name}`,
          `Email: ${email}`,
          `Subject: ${subject}`,
          `Service: ${service || "Not selected"}`,
          `Message: ${message}`,
          `Lead ID: ${id}`,
          `Received: ${createdAt}`,
        ].join("\n"),
        html: `<h2>New Website Enquiry</h2><p><b>Name:</b> ${safe(name)}</p><p><b>Email:</b> ${safe(email)}</p><p><b>Subject:</b> ${safe(subject)}</p><p><b>Service:</b> ${safe(service || "Not selected")}</p><p><b>Message:</b><br>${safe(message).replace(/\n/g, "<br>")}</p><p><b>Lead ID:</b> ${safe(id)}</p><p><b>Received:</b> ${safe(createdAt)}</p>`,
      });
      emailSent = true;
    } catch (mailError) {
      console.error("[LEADS] Lead saved, but notification email failed:", mailError);
    }
  } else {
    console.warn("[LEADS] Lead saved. SMTP is not configured; email notification skipped.");
  }

  res.status(201).json({
    success: true,
    message: "Your message has been submitted successfully.",
    id,
    emailSent,
  });
}));
app.patch("/api/leads/:id", auth, asyncRoute(async (req, res) => {
  const found = await q("SELECT data FROM leads WHERE id=$1", [req.params.id]);
  if (!found.rowCount) return res.status(404).json({ error: "Lead not found" });
  const data = { ...found.rows[0].data };
  if (req.body.status !== undefined) data.status = String(req.body.status);
  if (req.body.notes !== undefined) data.admin_notes = String(req.body.notes);
  await q("UPDATE leads SET data=$2::jsonb,updated_at=NOW() WHERE id=$1", [req.params.id, JSON.stringify(data)]);
  res.json({ success: true, item: data });
}));
app.delete("/api/leads/:id", auth, asyncRoute(async (req, res) => {
  const r = await q("DELETE FROM leads WHERE id=$1", [req.params.id]);
  if (!r.rowCount) return res.status(404).json({ error: "Lead not found" });
  res.json({ success: true });
}));

// Projects
app.get("/api/projects", auth, asyncRoute(async (_req, res) => {
  const r = await q("SELECT id,category_id,data,case_study FROM projects ORDER BY category_id,id");
  res.json(r.rows.map(x => ({ ...x.data, id: x.id, categoryId: x.category_id, caseStudy: x.case_study })));
}));
app.post("/api/projects", auth, asyncRoute(async (req, res) => {
  const body = req.body || {}, id = safeSlug(body.id || body.slug || body.title);
  if (!id || !String(body.title || "").trim()) return res.status(422).json({ error: "Project title and ID are required" });
  const categoryId = safeSlug(body.categoryId || "uncategorized");
  const data = { ...body, id }; delete data.categoryId; delete data.caseStudy;
  const exists = await q("SELECT 1 FROM projects WHERE id=$1", [id]);
  if (exists.rowCount) return res.status(409).json({ error: "A project with this ID already exists" });
  await q("INSERT INTO projects(id,category_id,data,case_study) VALUES($1,$2,$3::jsonb,$4::jsonb)", [id, categoryId, JSON.stringify(data), body.caseStudy ? JSON.stringify(body.caseStudy) : null]);
  res.status(201).json({ success: true, item: { ...data, id, categoryId, caseStudy: body.caseStudy || null } });
}));
app.put("/api/projects/:id", auth, asyncRoute(async (req, res) => {
  const oldId = String(req.params.id), body = req.body || {}, id = safeSlug(body.id || oldId), categoryId = safeSlug(body.categoryId || "uncategorized");
  const found = await q("SELECT 1 FROM projects WHERE id=$1", [oldId]);
  if (!found.rowCount) return res.status(404).json({ error: "Project not found" });
  if (id !== oldId && (await q("SELECT 1 FROM projects WHERE id=$1", [id])).rowCount) return res.status(409).json({ error: "Project ID already exists" });
  const data = { ...body, id }; delete data.categoryId; delete data.caseStudy;
  await q("UPDATE projects SET id=$2,category_id=$3,data=$4::jsonb,case_study=$5::jsonb,updated_at=NOW() WHERE id=$1", [oldId, id, categoryId, JSON.stringify(data), body.caseStudy ? JSON.stringify(body.caseStudy) : null]);
  res.json({ success: true, item: { ...data, id, categoryId, caseStudy: body.caseStudy || null } });
}));
app.delete("/api/projects/:id", auth, asyncRoute(async (req, res) => {
  const r = await q("DELETE FROM projects WHERE id=$1", [req.params.id]);
  if (!r.rowCount) return res.status(404).json({ error: "Project not found" });
  res.json({ success: true });
}));

// Settings
app.get("/api/settings", auth, asyncRoute(async (_req, res) => {
  const r = await q("SELECT data FROM site_settings WHERE id=1");
  res.json(r.rows[0]?.data || { headCode: "", bodyStartCode: "", bodyEndCode: "" });
}));
app.put("/api/settings", auth, asyncRoute(async (req, res) => {
  const data = { headCode: String(req.body.headCode || ""), bodyStartCode: String(req.body.bodyStartCode || ""), bodyEndCode: String(req.body.bodyEndCode || ""), updatedAt: new Date().toISOString() };
  await q("INSERT INTO site_settings(id,data) VALUES(1,$1::jsonb) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()", [JSON.stringify(data)]);
  res.json({ success: true, item: data });
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === "23505") return res.status(409).json({ error: "A record with this identifier already exists" });
  res.status(500).json({ error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message || "Internal server error" });
});
app.listen(PORT, () => console.log(`GStar Admin API listening on ${PORT}`));
