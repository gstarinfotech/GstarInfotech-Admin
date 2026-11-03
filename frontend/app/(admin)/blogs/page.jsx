"use client";

import { useEffect, useState } from "react";
import { api, uploadImage } from "../../../components/api";

const createBlankBlog = () => ({
    title: "",
    slug: "",
    status: "DRAFT",
    metaTitle: "",
    metaDescription: "",
    excerpt: "",
    featuredImage: "",
    focusKeyword: "",
    canonicalUrl: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    robotsIndex: true,
    robotsFollow: true,
    contentBlocks: [],
});

export default function BlogsPage() {
    const [rows, setRows] = useState([]);
    const [form, setForm] = useState(createBlankBlog);
    const [id, setId] = useState("");
    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);
    const [saving, setSaving] = useState(false);

    async function load() {
        try {
            const result = await api("/api/blogs");
            setRows(Array.isArray(result) ? result : result.blogs || []);
        } catch (error) {
            setErr(error instanceof Error ? error.message : "Could not load blogs");
        }
    }

    useEffect(() => {
        load();
    }, []);

    function edit(blog) {
        setId(blog.id);
        setForm({
            ...createBlankBlog(),
            ...blog,
            contentBlocks: Array.isArray(blog.contentBlocks)
                ? blog.contentBlocks
                : Array.isArray(blog.content)
                    ? blog.content
                    : [],
        });
        setMsg("");
        setErr("");
    }

    function clear() {
        setId("");
        setForm(createBlankBlog());
        setMsg("");
        setErr("");
    }

    function update(key, value) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    function add(type) {
        let block;

        if (type === "heading") {
            block = { type: "heading", text: "", level: 2 };
        } else if (type === "paragraph") {
            block = { type: "paragraph", text: "" };
        } else if (type === "image") {
            block = { type: "image", src: "", alt: "", caption: "" };
        } else if (type === "table") {
            block = {
                type: "table",
                title: "",
                headers: ["Column 1", "Column 2"],
                rows: [["", ""]],
            };
        } else {
            block = { type: "list", items: [""] };
        }

        update("contentBlocks", [...form.contentBlocks, block]);
    }

    function patchBlock(index, patch) {
        update(
            "contentBlocks",
            form.contentBlocks.map((block, blockIndex) =>
                blockIndex === index ? { ...block, ...patch } : block
            )
        );
    }

    function removeBlock(index) {
        update(
            "contentBlocks",
            form.contentBlocks.filter((_, blockIndex) => blockIndex !== index)
        );
    }

    function moveBlock(index, direction) {
        const blocks = [...form.contentBlocks];
        const targetIndex = index + direction;

        if (targetIndex < 0 || targetIndex >= blocks.length) return;

        [blocks[index], blocks[targetIndex]] = [
            blocks[targetIndex],
            blocks[index],
        ];

        update("contentBlocks", blocks);
    }

    function updateTableCell(blockIndex, rowIndex, columnIndex, value) {
        const blocks = [...form.contentBlocks];
        const block = { ...blocks[blockIndex] };

        if (rowIndex === -1) {
            const headers = [...(block.headers || [])];
            headers[columnIndex] = value;
            block.headers = headers;
        } else {
            const rows = (block.rows || []).map((row) => [...row]);
            rows[rowIndex][columnIndex] = value;
            block.rows = rows;
        }

        blocks[blockIndex] = block;
        update("contentBlocks", blocks);
    }

    function addTableRow(blockIndex) {
        const blocks = [...form.contentBlocks];
        const block = { ...blocks[blockIndex] };
        block.rows = [
            ...(block.rows || []),
            (block.headers || []).map(() => ""),
        ];
        blocks[blockIndex] = block;
        update("contentBlocks", blocks);
    }

    function addTableColumn(blockIndex) {
        const blocks = [...form.contentBlocks];
        const block = { ...blocks[blockIndex] };
        block.headers = [
            ...(block.headers || []),
            `Column ${(block.headers || []).length + 1}`,
        ];
        block.rows = (block.rows || []).map((row) => [...row, ""]);
        blocks[blockIndex] = block;
        update("contentBlocks", blocks);
    }

    function removeTableRow(blockIndex, rowIndex) {
        const blocks = [...form.contentBlocks];
        const block = { ...blocks[blockIndex] };
        block.rows = (block.rows || []).filter(
            (_, index) => index !== rowIndex
        );
        blocks[blockIndex] = block;
        update("contentBlocks", blocks);
    }

    async function upload(file, callback) {
        setBusy(true);
        setErr("");

        try {
            const result = await uploadImage(file);
            if (!result.url) {
                throw new Error("Upload response did not contain an image URL.");
            }
            callback(result.url);
        } catch (error) {
            setErr(error instanceof Error ? error.message : "Image upload failed");
        } finally {
            setBusy(false);
        }
    }

    async function save(event) {
        event.preventDefault();
        setErr("");
        setMsg("");

        const title = String(form.title || "").trim();
        const slug = String(form.slug || "").trim().toLowerCase();

        if (!title) {
            setErr("Please enter a blog title.");
            return;
        }

        if (!slug) {
            setErr("Please enter a URL slug.");
            return;
        }

        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
            setErr(
                "Invalid URL slug. Use lowercase letters, numbers and hyphens only (example: business-funding-guide)."
            );
            return;
        }

        if (!["DRAFT", "PUBLISHED"].includes(form.status)) {
            setErr("Please select Draft or Publish.");
            return;
        }

        setSaving(true);

        try {
            const payload = {
                ...form,
                title,
                slug,
                content: JSON.stringify(form.contentBlocks || []),
                contentBlocks: form.contentBlocks || [],
            };

            if (id) {
                await api(`/api/blogs/${id}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                });
            } else {
                await api("/api/blogs", {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
            }

            setMsg(
                form.status === "PUBLISHED"
                    ? "Blog published successfully."
                    : "Blog saved as draft successfully."
            );
            setId("");
            setForm(createBlankBlog());
            await load();
        } catch (error) {
            setErr(
                error instanceof Error
                    ? error.message
                    : "Could not save blog. Please check required fields and try again."
            );
        } finally {
            setSaving(false);
        }
    }

    async function deleteBlog(blogId) {
        if (!window.confirm("Delete this blog permanently?")) return;

        try {
            await api(`/api/blogs/${blogId}`, { method: "DELETE" });
            if (id === blogId) clear();
            await load();
        } catch (error) {
            setErr(error instanceof Error ? error.message : "Delete failed");
        }
    }

    function handleSlugChange(value) {
        update(
            "slug",
            value
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "")
        );
    }

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
                .blog-management-page::-webkit-scrollbar {
                    display: none;
                    width: 0;
                    height: 0;
                }
                .blog-management-page {
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                }
            `}</style>
            <div className="blog-management-page mx-auto w-full max-w-[1440px] text-[#e8eef4]">
                <div className="mb-6">
                    <p className="text-xs font-semibold tracking-[.16em] text-sky-400">CONTENT MANAGEMENT</p><h1 className="mt-2 text-2xl font-semibold text-[#f1f6fa]">Blog Management</h1>
                    <p className="mt-2 text-sm text-[#91a2b2]">
                        Create and manage published articles and drafts.
                    </p>
                </div>

                {msg && <p className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">{msg}</p>}
                {err && <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</p>}

                <div className="grid items-start gap-5 xl:grid-cols-[minmax(260px,.75fr)_minmax(0,1.5fr)]">
                    <section className="panel overflow-hidden">
                        <div className="border-b border-slate-700 p-4 font-semibold text-[#eaf2f8]">
                            All blogs ({rows.length})
                        </div>

                        {rows.length === 0 ? (
                            <p className="p-4 text-sm muted">
                                No blogs added yet.
                            </p>
                        ) : (
                            rows.map((blog) => (
                                <div
                                    key={blog.id}
                                    className="flex justify-between gap-3 border-b border-slate-700 p-4 hover:bg-white/[.03]"
                                >
                                    <button
                                        type="button"
                                        onClick={() => edit(blog)}
                                        className="min-w-0 text-left"
                                    >
                                        <div className="text-sm font-medium text-slate-100">
                                            {blog.title}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-500">
                                            /{blog.slug}
                                        </div>
                                        <span
                                            className={`mt-2 inline-block rounded-full px-2 py-1 text-[11px] ${blog.status === "PUBLISHED"
                                                ? "border border-green-500/20 bg-green-500/10 text-green-300"
                                                : "border border-slate-600 bg-slate-800 text-slate-300"
                                                }`}
                                        >
                                            {blog.status}
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => deleteBlog(blog.id)}
                                        className="btn-danger self-start text-xs"
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))
                        )}
                    </section>

                    <form
                        onSubmit={save}
                        className="panel space-y-5 p-5 md:p-6"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 pb-4">
                            <h2 className="font-semibold text-[#eaf2f8]">
                                {id ? "Edit blog" : "Create blog"}
                            </h2>
                            <button
                                type="button"
                                onClick={clear}
                                className="btn-secondary text-xs"
                            >
                                New / Clear
                            </button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <Field
                                label="Blog title"
                                value={form.title}
                                onChange={(value) => update("title", value)}
                                required
                            />
                            <Field
                                label="URL slug"
                                value={form.slug}
                                onChange={handleSlugChange}
                                required
                            />
                        </div>

                        <Area
                            label="Short description / card excerpt"
                            value={form.excerpt}
                            onChange={(value) => update("excerpt", value)}
                        />

                        <div>
                            <label className="text-xs text-slate-300">
                                Main / featured image
                            </label>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <input
                                    value={form.featuredImage}
                                    onChange={(event) =>
                                        update("featuredImage", event.target.value)
                                    }
                                    placeholder="Image URL"
                                    className="min-w-0 flex-1 rounded-lg border p-2.5 text-sm"
                                />
                                <label className="btn-secondary cursor-pointer text-sm">
                                    Upload
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(event) => {
                                            const file = event.target.files?.[0];
                                            if (file) {
                                                upload(file, (url) =>
                                                    update("featuredImage", url)
                                                );
                                            }
                                            event.currentTarget.value = "";
                                        }}
                                    />
                                </label>
                            </div>
                            {form.featuredImage && (
                                <img
                                    src={form.featuredImage}
                                    alt="Featured preview"
                                    className="mt-3 max-h-56 w-full rounded-xl border border-slate-700 object-contain"
                                />
                            )}
                        </div>

                        <div className="border-t border-slate-700 pt-5">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                <h3 className="text-sm font-semibold">
                                    Article content
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        ["heading", "+ Heading"],
                                        ["paragraph", "+ Paragraph"],
                                        ["image", "+ Image"],
                                        ["list", "+ Bullet list"],
                                        ["table", "+ Table"],
                                    ].map(([type, label]) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => add(type)}
                                            className="btn-secondary text-xs"
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {form.contentBlocks.length === 0 && (
                                <p className="rounded-lg border border-slate-700 bg-white/[.03] p-4 text-xs muted">
                                    Add headings, paragraphs, images, bullet lists
                                    and tables. Blocks appear on the website in this
                                    same order.
                                </p>
                            )}

                            <div className="space-y-3">
                                {form.contentBlocks.map((block, index) => (
                                    <div
                                        key={index}
                                        className="space-y-2 rounded-lg border p-3"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 pb-4">
                                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                                {block.type} {index + 1}
                                            </span>
                                            <div className="flex gap-3 text-xs">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        moveBlock(index, -1)
                                                    }
                                                    disabled={index === 0}
                                                >
                                                    ↑
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        moveBlock(index, 1)
                                                    }
                                                    disabled={
                                                        index ===
                                                        form.contentBlocks.length - 1
                                                    }
                                                >
                                                    ↓
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => removeBlock(index)}
                                                    className="text-red-600"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>

                                        {block.type === "heading" && (
                                            <>
                                                <select
                                                    value={block.level || 2}
                                                    onChange={(event) =>
                                                        patchBlock(index, {
                                                            level: Number(
                                                                event.target.value
                                                            ),
                                                        })
                                                    }
                                                    className="rounded-lg border border-slate-700 bg-[#0d151d] p-2 text-xs text-slate-100"
                                                >
                                                    <option value={2}>Heading 2</option>
                                                    <option value={3}>Heading 3</option>
                                                </select>
                                                <input
                                                    value={block.text || ""}
                                                    onChange={(event) =>
                                                        patchBlock(index, {
                                                            text: event.target.value,
                                                        })
                                                    }
                                                    placeholder="Heading text"
                                                    className="w-full"
                                                />
                                            </>
                                        )}

                                        {block.type === "paragraph" && (
                                            <textarea
                                                rows={4}
                                                value={block.text || ""}
                                                onChange={(event) =>
                                                    patchBlock(index, {
                                                        text: event.target.value,
                                                    })
                                                }
                                                placeholder="Write paragraph..."
                                                className="w-full"
                                            />
                                        )}

                                        {block.type === "image" && (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        value={block.src || ""}
                                                        onChange={(event) =>
                                                            patchBlock(index, {
                                                                src: event.target.value,
                                                            })
                                                        }
                                                        placeholder="Image URL"
                                                        className="min-w-0 flex-1 rounded-lg border p-2 text-sm"
                                                    />
                                                    <label className="btn-secondary cursor-pointer text-xs">
                                                        Upload
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(event) => {
                                                                const file =
                                                                    event.target.files?.[0];
                                                                if (file) {
                                                                    upload(file, (url) =>
                                                                        patchBlock(index, {
                                                                            src: url,
                                                                        })
                                                                    );
                                                                }
                                                                event.currentTarget.value = "";
                                                            }}
                                                        />
                                                    </label>
                                                </div>
                                                <input
                                                    value={block.alt || ""}
                                                    onChange={(event) =>
                                                        patchBlock(index, {
                                                            alt: event.target.value,
                                                        })
                                                    }
                                                    placeholder="Image alt text"
                                                    className="w-full"
                                                />
                                                <input
                                                    value={block.caption || ""}
                                                    onChange={(event) =>
                                                        patchBlock(index, {
                                                            caption: event.target.value,
                                                        })
                                                    }
                                                    placeholder="Optional image caption"
                                                    className="w-full"
                                                />
                                                {block.src && (
                                                    <img
                                                        src={block.src}
                                                        alt={block.alt || ""}
                                                        className="max-h-48 rounded-lg border border-slate-700 object-contain"
                                                    />
                                                )}
                                            </>
                                        )}

                                        {block.type === "list" && (
                                            <div className="space-y-2">
                                                {(block.items || []).map(
                                                    (item, itemIndex) => (
                                                        <div
                                                            key={itemIndex}
                                                            className="flex items-center gap-2"
                                                        >
                                                            <input
                                                                value={item}
                                                                onChange={(event) =>
                                                                    patchBlock(index, {
                                                                        items: (
                                                                            block.items || []
                                                                        ).map(
                                                                            (value, valueIndex) =>
                                                                                valueIndex ===
                                                                                    itemIndex
                                                                                    ? event.target.value
                                                                                    : value
                                                                        ),
                                                                    })
                                                                }
                                                                placeholder={`List item ${itemIndex + 1
                                                                    }`}
                                                                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-[#0d151d] p-2 text-sm text-slate-100"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    patchBlock(index, {
                                                                        items: (
                                                                            block.items || []
                                                                        ).filter(
                                                                            (_, valueIndex) =>
                                                                                valueIndex !==
                                                                                itemIndex
                                                                        ),
                                                                    })
                                                                }
                                                                className="text-xs text-red-400 hover:text-red-300"
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    )
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        patchBlock(index, {
                                                            items: [
                                                                ...(block.items || []),
                                                                "",
                                                            ],
                                                        })
                                                    }
                                                    className="text-xs text-[#052e26]"
                                                >
                                                    + Add list item
                                                </button>
                                            </div>
                                        )}

                                        {block.type === "table" && (
                                            <div className="space-y-3">
                                                <input
                                                    value={block.title || ""}
                                                    onChange={(event) =>
                                                        patchBlock(index, {
                                                            title: event.target.value,
                                                        })
                                                    }
                                                    placeholder="Optional table heading"
                                                    className="w-full"
                                                />

                                                <div className="overflow-x-auto">
                                                    <table className="w-full min-w-[520px] border-collapse text-sm">
                                                        <thead>
                                                            <tr>
                                                                {(block.headers || []).map(
                                                                    (header, columnIndex) => (
                                                                        <th
                                                                            key={columnIndex}
                                                                            className="border border-slate-700 bg-[#14212c] p-2 text-slate-200"
                                                                        >
                                                                            <input
                                                                                value={header}
                                                                                onChange={(event) =>
                                                                                    updateTableCell(
                                                                                        index,
                                                                                        -1,
                                                                                        columnIndex,
                                                                                        event.target.value
                                                                                    )
                                                                                }
                                                                                className="w-full min-w-24 rounded-lg border border-slate-700 bg-[#0d151d] p-2 text-slate-100"
                                                                            />
                                                                        </th>
                                                                    )
                                                                )}
                                                                <th className="border border-slate-700 bg-[#14212c] p-2 text-slate-200">
                                                                    Actions
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(block.rows || []).map(
                                                                (row, rowIndex) => (
                                                                    <tr key={rowIndex}>
                                                                        {(block.headers || []).map(
                                                                            (_, columnIndex) => (
                                                                                <td
                                                                                    key={columnIndex}
                                                                                    className="border p-2"
                                                                                >
                                                                                    <textarea
                                                                                        rows={2}
                                                                                        value={
                                                                                            row[columnIndex] ||
                                                                                            ""
                                                                                        }
                                                                                        onChange={(event) =>
                                                                                            updateTableCell(
                                                                                                index,
                                                                                                rowIndex,
                                                                                                columnIndex,
                                                                                                event.target.value
                                                                                            )
                                                                                        }
                                                                                        className="w-full min-w-24 rounded-lg border border-slate-700 bg-[#0d151d] p-2 text-slate-100"
                                                                                    />
                                                                                </td>
                                                                            )
                                                                        )}
                                                                        <td className="border p-2 text-center">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    removeTableRow(
                                                                                        index,
                                                                                        rowIndex
                                                                                    )
                                                                                }
                                                                                className="text-xs text-red-400 hover:text-red-300"
                                                                            >
                                                                                Remove row
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                )
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => addTableRow(index)}
                                                        className="btn-secondary text-xs"
                                                    >
                                                        + Add row
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            addTableColumn(index)
                                                        }
                                                        className="btn-secondary text-xs"
                                                    >
                                                        + Add column
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4 border-t border-slate-700 pt-5">
                            <h3 className="text-base font-semibold text-[#eaf2f8]">SEO Details</h3>

                            <Field
                                label="Meta title"
                                value={form.metaTitle}
                                onChange={(value) => update("metaTitle", value)}
                            />
                            <Area
                                label="Meta description"
                                value={form.metaDescription}
                                onChange={(value) =>
                                    update("metaDescription", value)
                                }
                            />

                            <div className="grid gap-3 md:grid-cols-2">
                                <Field
                                    label="Focus keyword"
                                    value={form.focusKeyword}
                                    onChange={(value) =>
                                        update("focusKeyword", value)
                                    }
                                />
                                <Field
                                    label="Canonical URL"
                                    value={form.canonicalUrl}
                                    onChange={(value) =>
                                        update("canonicalUrl", value)
                                    }
                                />
                            </div>

                            <Field
                                label="Open Graph title"
                                value={form.ogTitle}
                                onChange={(value) => update("ogTitle", value)}
                            />
                            <Area
                                label="Open Graph description"
                                value={form.ogDescription}
                                onChange={(value) =>
                                    update("ogDescription", value)
                                }
                            />

                            <div>
                                <label className="text-xs text-slate-300">
                                    Open Graph image URL
                                </label>
                                <div className="mt-1 flex gap-2">
                                    <input
                                        value={form.ogImage || ""}
                                        onChange={(event) =>
                                            update("ogImage", event.target.value)
                                        }
                                        placeholder="Social sharing image URL"
                                        className="min-w-0 flex-1 rounded-lg border p-2.5 text-sm"
                                    />
                                    <label className="btn-secondary cursor-pointer text-sm">
                                        Upload
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(event) => {
                                                const file =
                                                    event.target.files?.[0];
                                                if (file) {
                                                    upload(file, (url) =>
                                                        update("ogImage", url)
                                                    );
                                                }
                                                event.currentTarget.value = "";
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-6 text-sm text-slate-300">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={form.robotsIndex !== false}
                                        onChange={(event) =>
                                            update("robotsIndex", event.target.checked)
                                        }
                                    />
                                    Index
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={form.robotsFollow !== false}
                                        onChange={(event) =>
                                            update("robotsFollow", event.target.checked)
                                        }
                                    />
                                    Follow
                                </label>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 border-t border-slate-700 pt-5">
                            <select
                                value={form.status}
                                onChange={(event) =>
                                    update("status", event.target.value)
                                }
                                className="rounded-lg border border-slate-700 bg-[#0d151d] p-2.5 text-sm text-slate-100"
                            >
                                <option value="DRAFT">Save as Draft</option>
                                <option value="PUBLISHED">Publish</option>
                            </select>

                            <button
                                disabled={busy || saving}
                                className="btn disabled:opacity-50"
                            >
                                {saving
                                    ? "Saving..."
                                    : busy
                                        ? "Uploading..."
                                        : form.status === "PUBLISHED"
                                            ? "Publish blog"
                                            : "Save blog"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}

function Field({ label, value, onChange, required = false }) {
    return (
        <div className="field">
            <label>{label}</label>
            <input
                required={required}
                value={value || ""}
                onChange={(event) => onChange(event.target.value)}
                className="w-full"
            />
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
                className="w-full"
            />
        </div>
    );
}
