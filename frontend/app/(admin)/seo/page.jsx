"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../../components/api";

const GROUP_ORDER = ["Static Pages", "Service Pages", "Blog Pages", "Project Pages"];

export default function SEOManagementPage() {
    const [pages, setPages] = useState([]);
    const [seoRecords, setSeoRecords] = useState({});
    const [selectedPath, setSelectedPath] = useState("");
    const [form, setForm] = useState(null);
    const [search, setSearch] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const [pageList, records] = await Promise.all([
                    api("/api/pages"),
                    api("/api/seo"),
                ]);

                setPages(pageList);
                setSeoRecords(records);

                if (pageList.length) {
                    const firstPath = pageList[0].path;
                    setSelectedPath(firstPath);
                    setForm(toForm(records[firstPath], firstPath));
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unable to load SEO pages.");
            } finally {
                setLoading(false);
            }
        }

        load();
    }, []);

    function toForm(record, path) {
        const current = record || {};
        return {
            path,
            title: current.title || "",
            description: current.description || "",
            focusKeyword: current.focusKeyword || current.keywords || "",
            canonicalUrl: current.canonicalUrl || `https://gstarinfotech.com${path}`,
            ogTitle: current.ogTitle || "",
            ogDescription: current.ogDescription || "",
            ogImage: current.ogImage || "",
            index: current.index !== false,
            follow: current.follow !== false,
        };
    }

    const filteredPages = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return pages;

        return pages.filter((page) =>
            `${page.label} ${page.path} ${page.group}`.toLowerCase().includes(term)
        );
    }, [pages, search]);

    const groupedPages = useMemo(() => {
        return GROUP_ORDER.map((group) => ({
            group,
            items: filteredPages.filter((page) => page.group === group),
        })).filter((section) => section.items.length > 0);
    }, [filteredPages]);

    function selectPage(page) {
        setSelectedPath(page.path);
        setForm(toForm(seoRecords[page.path], page.path));
        setMessage("");
        setError("");
        setSaved(false);
    }

    function updateField(key, value) {
        setForm((previous) => ({ ...previous, [key]: value }));
        setMessage("");
        setError("");
        setSaved(false);
    }

    async function save(event) {
        event.preventDefault();
        if (!form || !selectedPath) return;

        const saveStartedAt = Date.now();

        setSaving(true);
        setSaved(false);
        setMessage("");
        setError("");

        try {
            // Backend currently stores the focus keyword in its "keywords" field.
            const payload = {
                title: form.title,
                description: form.description,
                keywords: form.focusKeyword,
                canonicalUrl: form.canonicalUrl,
                ogTitle: form.ogTitle,
                ogDescription: form.ogDescription,
                ogImage: form.ogImage,
                index: form.index,
                follow: form.follow,
            };

            const result = await api(`/api/seo${selectedPath}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });

            setSeoRecords((previous) => ({
                ...previous,
                [selectedPath]: result.item,
            }));
            setForm(toForm(result.item, selectedPath));

            // Keep the loading state visible briefly, even when the API responds very quickly.
            const elapsed = Date.now() - saveStartedAt;
            const remaining = Math.max(0, 900 - elapsed);
            if (remaining > 0) {
                await new Promise((resolve) => setTimeout(resolve, remaining));
            }

            setSaved(true);
            setMessage("SEO details saved successfully.");
            window.setTimeout(() => setSaved(false), 2200);
        } catch (err) {
            setError(err instanceof Error ? err.message : "SEO save failed.");
        } finally {
            setSaving(false);
        }
    }

    const selectedPage = pages.find((page) => page.path === selectedPath);

    if (loading) {
        return <div className="panel p-6 text-sm muted">Loading website pages...</div>;
    }

    return (
        <>
            <style jsx global>{`
                html,
                body {
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                }

                html::-webkit-scrollbar,
                body::-webkit-scrollbar,
                .seo-management-page::-webkit-scrollbar,
                .seo-management-page *::-webkit-scrollbar {
                    display: none;
                    width: 0;
                    height: 0;
                }

                .seo-management-page,
                .seo-management-page * {
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                }
            `}</style>
            <div className="seo-management-page">
                <div className="mb-6">
                    <p className="text-xs font-semibold tracking-[.16em] text-sky-400">
                        SEARCH ENGINE OPTIMISATION
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold">Pages &amp; SEO</h1>
                    <p className="mt-2 text-sm muted">
                        Manage SEO individually for every GStar website page, including each service page.
                    </p>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {error}
                    </div>
                )}
                {message && (
                    <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                        {message}
                    </div>
                )}

                <div className="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
                    {/* Page selector — services are individual entries, not one shared SEO form. */}
                    <aside className="panel overflow-hidden">
                        <div className="border-b border-slate-700 p-4">
                            <h2 className="font-semibold">Existing website pages</h2>
                            <p className="mt-1 text-xs muted">{pages.length} pages available</p>
                            <input
                                className="mt-3"
                                type="search"
                                placeholder="Search page or URL..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </div>

                        <div className="max-h-[70vh] overflow-y-auto p-2">
                            {groupedPages.map(({ group, items }) => (
                                <section key={group} className="mb-3">
                                    <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">
                                        {group} <span className="ml-1">({items.length})</span>
                                    </div>

                                    {items.map((page) => (
                                        <button
                                            key={page.path}
                                            type="button"
                                            onClick={() => selectPage(page)}
                                            className={`mb-1 w-full rounded-lg border px-3 py-2.5 text-left transition ${selectedPath === page.path
                                                ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
                                                : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-white/[.03]"
                                                }`}
                                        >
                                            <span className="block truncate text-sm font-medium">
                                                {page.label}
                                            </span>
                                            <span className="mt-1 block truncate text-[11px] text-slate-500">
                                                {page.path}
                                            </span>
                                        </button>
                                    ))}
                                </section>
                            ))}

                            {groupedPages.length === 0 && (
                                <p className="p-4 text-sm muted">No matching pages found.</p>
                            )}
                        </div>
                    </aside>

                    {/* SEO editor fields follow the FundAstra Pages & SEO form. */}
                    {form && (
                        <form onSubmit={save} className="panel space-y-5 p-5 md:p-6">
                            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-700 pb-4">
                                <div>
                                    <h2 className="text-lg font-semibold">
                                        {selectedPage?.label || "Page SEO"}
                                    </h2>
                                    <p className="mt-1 text-xs muted">{selectedPath}</p>
                                </div>
                                <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[11px] text-sky-300">
                                    Individual page SEO
                                </span>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <Field
                                    label="Meta title"
                                    value={form.title}
                                    onChange={(value) => updateField("title", value)}
                                />
                                <Field
                                    label="Focus keyword"
                                    value={form.focusKeyword}
                                    onChange={(value) => updateField("focusKeyword", value)}
                                />
                            </div>

                            <Area
                                label="Meta description"
                                value={form.description}
                                onChange={(value) => updateField("description", value)}
                            />

                            <Field
                                label="Canonical URL"
                                value={form.canonicalUrl}
                                onChange={(value) => updateField("canonicalUrl", value)}
                            />

                            <div className="border-t border-slate-700 pt-5">
                                <h3 className="mb-4 font-semibold">Open Graph Details</h3>
                                <div className="space-y-4">
                                    <Field
                                        label="Open Graph title"
                                        value={form.ogTitle}
                                        onChange={(value) => updateField("ogTitle", value)}
                                    />
                                    <Area
                                        label="Open Graph description"
                                        value={form.ogDescription}
                                        onChange={(value) => updateField("ogDescription", value)}
                                    />
                                    <Field
                                        label="Open Graph image URL"
                                        value={form.ogImage}
                                        onChange={(value) => updateField("ogImage", value)}
                                    />
                                </div>
                            </div>

                            <div className="border-t border-slate-700 pt-5">
                                <h3 className="mb-3 font-semibold">Search Engine Visibility</h3>
                                <div className="flex flex-wrap gap-6">
                                    <label className="flex items-center gap-2 text-sm text-slate-300">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 accent-sky-500"
                                            checked={form.index}
                                            onChange={(event) => updateField("index", event.target.checked)}
                                        />
                                        Index
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-slate-300">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 accent-sky-500"
                                            checked={form.follow}
                                            onChange={(event) => updateField("follow", event.target.checked)}
                                        />
                                        Follow
                                    </label>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 border-t border-slate-700 pt-5">
                                <button type="submit" disabled={saving} className="btn">
                                    {saving ? "Saving..." : saved ? "Saved ✓" : "Save SEO"}
                                </button>
                                <span className="text-xs muted">
                                    SEO fields are saved separately for the selected URL.
                                </span>
                            </div>
                        </form>
                    )}

                    {!form && (
                        <div className="panel p-8 text-sm muted">
                            Select a page from the list to edit its SEO details.
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

function Field({ label, value, onChange }) {
    return (
        <div className="field">
            <label>{label}</label>
            <input value={value || ""} onChange={(event) => onChange(event.target.value)} />
        </div>
    );
}

function Area({ label, value, onChange }) {
    return (
        <div className="field">
            <label>{label}</label>
            <textarea
                rows={3}
                value={value || ""}
                onChange={(event) => onChange(event.target.value)}
            />
        </div>
    );
}
