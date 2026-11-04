"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../../components/api";
import ImageUpload from "../../../components/ImageUpload";

const blankProject = () => ({
  id: "",
  categoryId: "uncategorized",
  title: "",
  type: "",
  desc: "",
  services: [],
  tags: [],
  metrics: [],
  video: "",
  videoMobile: "",
  url: "",
  image: "",
  caseStudy: {
    title: "",
    type: "",
    industry: "",
    accent: "",
    accent2: "",
    url: "",
    thumbnail: "",
    challenge: "",
    solution: "",
    outcome: "",
    duration: "",
    metrics: [],
    features: [],
    testimonial: { quote: "", author: "", role: "" },
    press: [],
    stack: [],
    deliverables: [],
  },
});

const clone = (value) => JSON.parse(JSON.stringify(value ?? {}));
const toLines = (items) => (Array.isArray(items) ? items : []).join("\n");
const fromLines = (value) =>
  value.split("\n").map((v) => v.trim()).filter(Boolean);
const toMetrics = (items) =>
  (Array.isArray(items) ? items : [])
    .map((m) => `${m?.label ?? ""} | ${m?.val ?? ""}`)
    .join("\n");
const fromMetrics = (value) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label = "", ...rest] = line.split("|");
      return { label: label.trim(), val: rest.join("|").trim() };
    })
    .filter((m) => m.label || m.val);

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [item, setItem] = useState(null);
  const [originalId, setOriginalId] = useState(null);
  const [search, setSearch] = useState("");
  const [servicesText, setServicesText] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [metricsText, setMetricsText] = useState("");
  const [caseMetricsText, setCaseMetricsText] = useState("");
  const [featuresText, setFeaturesText] = useState("");
  const [pressText, setPressText] = useState("");
  const [stackText, setStackText] = useState("");
  const [deliverablesText, setDeliverablesText] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    const result = await api("/api/projects");
    setProjects(Array.isArray(result) ? result : []);
  }

  useEffect(() => {
    load()
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  }, []);

  function setListFields(project) {
    setServicesText(toLines(project.services));
    setTagsText(toLines(project.tags));
    setMetricsText(toMetrics(project.metrics));
    const cs = project.caseStudy || {};
    setCaseMetricsText(toMetrics(cs.metrics));
    setFeaturesText(toLines(cs.features));
    setPressText(toLines(cs.press));
    setStackText(toLines(cs.stack));
    setDeliverablesText(toLines(cs.deliverables));
  }

  function edit(project) {
    const copy = clone(project);
    const existingCase = copy.caseStudy || {};
    const defaultCase = blankProject().caseStudy;
    copy.caseStudy = {
      ...defaultCase,
      ...existingCase,
      testimonial: {
        ...defaultCase.testimonial,
        ...(existingCase.testimonial || {}),
      },
    };
    setItem(copy);
    setOriginalId(project.id);
    setListFields(copy);
    setMessage("");
  }

  function create() {
    const fresh = blankProject();
    setItem(fresh);
    setOriginalId(null);
    setListFields(fresh);
    setMessage("");
  }

  function field(key, value) {
    setItem((p) => ({ ...p, [key]: value }));
  }

  function caseField(key, value) {
    setItem((p) => ({
      ...p,
      caseStudy: { ...(p.caseStudy || {}), [key]: value },
    }));
  }

  function testimonialField(key, value) {
    setItem((p) => ({
      ...p,
      caseStudy: {
        ...(p.caseStudy || {}),
        testimonial: { ...(p.caseStudy?.testimonial || {}), [key]: value },
      },
    }));
  }

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");

    try {
      if (!item.title?.trim()) throw new Error("Project title is required.");

      const id = String(item.id || item.title)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      if (!id) throw new Error("Project ID is required.");

      const caseStudy = {
        ...(item.caseStudy || {}),
        metrics: fromMetrics(caseMetricsText),
        features: fromLines(featuresText),
        press: fromLines(pressText),
        stack: fromLines(stackText),
        deliverables: fromLines(deliverablesText),
      };

      const payload = {
        ...item,
        id,
        services: fromLines(servicesText),
        tags: fromLines(tagsText),
        metrics: fromMetrics(metricsText),
        caseStudy:
          Object.values(caseStudy).some((value) =>
            Array.isArray(value)
              ? value.length > 0
              : value && typeof value === "object"
                ? Object.values(value).some(Boolean)
                : Boolean(value)
          )
            ? caseStudy
            : null,
      };

      const url = originalId
        ? `/api/projects/${encodeURIComponent(originalId)}`
        : "/api/projects";
      const result = await api(url, {
        method: originalId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      await load();
      if (result?.item) edit(result.item);
      setMessage("Project saved successfully.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save project.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !originalId ||
      !window.confirm("Delete this project from the database?")
    )
      return;

    try {
      await api(`/api/projects/${encodeURIComponent(originalId)}`, {
        method: "DELETE",
      });
      setItem(null);
      setOriginalId(null);
      await load();
      setMessage("Project deleted successfully.");
    } catch (e) {
      setMessage(e.message);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return projects.filter((p) =>
      `${p.title || ""} ${p.id || ""} ${p.categoryId || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [projects, search]);

  return (
    <>
      <style jsx global>{`
        html, body {
          overflow-y: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        html::-webkit-scrollbar,
        body::-webkit-scrollbar,
        .project-management-page::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
        .project-management-page {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .hide-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
      `}</style>
      <div className="project-management-page min-w-0">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-widest text-sky-400">CONTENT</p>
            <h1 className="mt-2 text-3xl font-semibold">Project Management</h1>
            <p className="mt-2 text-sm muted">
              {projects.length} existing projects. Add, edit and manage portfolio
              projects.
            </p>
          </div>
          <button type="button" className="btn h-fit" onClick={create}>
            + Add Project
          </button>
        </div>

        <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
          {/* Projects list: stays fixed in its own panel and scrolls inside it */}
          <section className="panel flex min-w-0 flex-col overflow-hidden p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
            <input
              className="mb-3 shrink-0"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="hide-scrollbar max-h-[60vh] min-h-0 flex-1 space-y-2 overflow-y-auto lg:max-h-none">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => edit(p)}
                  className={`w-full rounded-lg p-3 text-left ${originalId === p.id ? "bg-sky-500/15" : "hover:bg-white/5"
                    }`}
                >
                  <span className="block text-sm font-medium">{p.title}</span>
                  <span className="mt-1 block text-xs muted">
                    {p.categoryId} · {p.id}
                  </span>
                </button>
              ))}
              {!loading && !filtered.length && (
                <p className="p-3 text-sm muted">No projects found.</p>
              )}
            </div>
          </section>

          {item ? (
            <form onSubmit={save} className="panel min-w-0 space-y-6 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 pb-4">
                <h2 className="text-xl font-semibold">
                  {originalId ? "Edit Project" : "Create Project"}
                </h2>
                {originalId && (
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={remove}
                  >
                    Delete Project
                  </button>
                )}
              </div>

              <section className="space-y-4">
                <h3 className="font-semibold">Basic Project Details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Project Title *"
                    value={item.title}
                    onChange={(v) => field("title", v)}
                  />
                  <Field
                    label="Project ID / Slug"
                    value={item.id}
                    onChange={(v) => field("id", v)}
                  />
                  <Field
                    label="Category ID"
                    value={item.categoryId}
                    onChange={(v) => field("categoryId", v)}
                  />
                  <Field
                    label="Project Type"
                    value={item.type}
                    onChange={(v) => field("type", v)}
                  />
                  <Field
                    label="Project URL"
                    value={item.url}
                    onChange={(v) => field("url", v)}
                  />
                  <ImageUpload
                    label="Project Image"
                    value={item.image || ""}
                    onChange={(v) => field("image", v)}
                  />
                  <Field
                    label="Desktop Video URL"
                    value={item.video}
                    onChange={(v) => field("video", v)}
                  />
                  <Field
                    label="Mobile Video URL"
                    value={item.videoMobile}
                    onChange={(v) => field("videoMobile", v)}
                  />
                </div>
                <Area
                  label="Short Description"
                  value={item.desc}
                  onChange={(v) => field("desc", v)}
                />
              </section>

              <section className="space-y-4 border-t border-slate-700 pt-5">
                <h3 className="font-semibold">Project Information</h3>
                <TextList
                  label="Services (one item per line)"
                  value={servicesText}
                  onChange={setServicesText}
                  placeholder={"Website Development\nUI/UX Design"}
                />
                <TextList
                  label="Technology Tags (one item per line)"
                  value={tagsText}
                  onChange={setTagsText}
                  placeholder={"Next.js\nReact\nNode.js"}
                />
                <TextList
                  label="Project Metrics (one per line: Label | Value)"
                  value={metricsText}
                  onChange={setMetricsText}
                  placeholder={"Sales volume | $100M+\nClient satisfaction | 100%"}
                />
              </section>

              <section className="space-y-4 border-t border-slate-700 pt-5">
                <h3 className="font-semibold">Case Study</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Case Study Title"
                    value={item.caseStudy?.title}
                    onChange={(v) => caseField("title", v)}
                  />
                  <Field
                    label="Project Type"
                    value={item.caseStudy?.type}
                    onChange={(v) => caseField("type", v)}
                  />
                  <Field
                    label="Industry"
                    value={item.caseStudy?.industry}
                    onChange={(v) => caseField("industry", v)}
                  />
                  <Field
                    label="Duration"
                    value={item.caseStudy?.duration}
                    onChange={(v) => caseField("duration", v)}
                  />
                  <Field
                    label="Accent Color"
                    value={item.caseStudy?.accent}
                    onChange={(v) => caseField("accent", v)}
                  />
                  <Field
                    label="Secondary Accent Color"
                    value={item.caseStudy?.accent2}
                    onChange={(v) => caseField("accent2", v)}
                  />
                  <Field
                    label="Case Study URL"
                    value={item.caseStudy?.url}
                    onChange={(v) => caseField("url", v)}
                  />
                  <ImageUpload
                    label="Case Study Thumbnail"
                    value={item.caseStudy?.thumbnail || ""}
                    onChange={(v) => caseField("thumbnail", v)}
                  />
                </div>

                <Area
                  label="Challenge"
                  value={item.caseStudy?.challenge}
                  onChange={(v) => caseField("challenge", v)}
                />
                <Area
                  label="Solution"
                  value={item.caseStudy?.solution}
                  onChange={(v) => caseField("solution", v)}
                />
                <Area
                  label="Outcome"
                  value={item.caseStudy?.outcome}
                  onChange={(v) => caseField("outcome", v)}
                />

                <TextList
                  label="Case Study Metrics (Label | Value)"
                  value={caseMetricsText}
                  onChange={setCaseMetricsText}
                  placeholder={"Revenue growth | 35%\nConversion rate | 2.5x"}
                />
                <TextList
                  label="Key Features (one per line)"
                  value={featuresText}
                  onChange={setFeaturesText}
                />
                <TextList
                  label="Technology Stack (one per line)"
                  value={stackText}
                  onChange={setStackText}
                />
                <TextList
                  label="Deliverables (one per line)"
                  value={deliverablesText}
                  onChange={setDeliverablesText}
                />
                <TextList
                  label="Press / Publications (one per line)"
                  value={pressText}
                  onChange={setPressText}
                />

                <div className="space-y-3 rounded-lg border border-slate-700 p-4">
                  <h4 className="font-medium">Client Testimonial</h4>
                  <Area
                    label="Quote"
                    value={item.caseStudy?.testimonial?.quote}
                    onChange={(v) => testimonialField("quote", v)}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Author"
                      value={item.caseStudy?.testimonial?.author}
                      onChange={(v) => testimonialField("author", v)}
                    />
                    <Field
                      label="Author Role"
                      value={item.caseStudy?.testimonial?.role}
                      onChange={(v) => testimonialField("role", v)}
                    />
                  </div>
                </div>
              </section>

              {message && <p className="text-sm text-sky-300">{message}</p>}
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "Saving..." : "Save Project"}
              </button>
            </form>
          ) : (
            <div className="panel p-8 text-sm muted">
              {loading
                ? "Loading projects..."
                : "Select a project or click Add Project to create one."}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, value, onChange }) {
  return (
    <div className="field min-w-0">
      <label>{label}</label>
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Area({ label, value, onChange }) {
  return (
    <div className="field min-w-0">
      <label>{label}</label>
      <textarea
        rows={4}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function TextList({ label, value, onChange, placeholder = "" }) {
  return (
    <div className="field min-w-0">
      <label>{label}</label>
      <textarea
        rows={3}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}