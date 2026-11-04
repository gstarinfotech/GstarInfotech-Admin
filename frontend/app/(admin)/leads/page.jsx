
"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../../components/api";

const STATUSES = ["New", "Contacted", "Closed"];

export default function Leads() {
    const [leads, setLeads] = useState([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);

    async function load() {
        try {
            const data = await api("/api/leads");
            setLeads(Array.isArray(data) ? data : []);
            setMessage("");
        } catch (error) {
            setMessage(
                error instanceof Error
                    ? error.message
                    : "Unable to load leads."
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    async function updateStatus(id, status) {
        try {
            await api(`/api/leads/${encodeURIComponent(id)}`, {
                method: "PATCH",
                body: JSON.stringify({ status }),
            });
            await load();
        } catch (error) {
            setMessage(
                error instanceof Error
                    ? error.message
                    : "Unable to update lead status."
            );
        }
    }

    async function removeLead(id) {
        if (!window.confirm("Are you sure you want to delete this lead?")) {
            return;
        }

        try {
            await api(`/api/leads/${encodeURIComponent(id)}`, {
                method: "DELETE",
            });
            await load();
        } catch (error) {
            setMessage(
                error instanceof Error
                    ? error.message
                    : "Unable to delete lead."
            );
        }
    }

    const filteredLeads = useMemo(() => {
        const term = search.trim().toLowerCase();

        return leads.filter((lead) => {
            const matchesSearch = [
                lead.name,
                lead.email,
                lead.subject,
                lead.service,
                lead.message,
            ]
                .join(" ")
                .toLowerCase()
                .includes(term);

            const matchesStatus =
                statusFilter === "All" ||
                (lead.status || "New") === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [leads, search, statusFilter]);

    const getStatusStyle = (status) => {
        switch (status) {
            case "Contacted":
                return "border-sky-500/30 bg-sky-500/10 text-sky-400";
            case "Closed":
                return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
            default:
                return "border-amber-500/30 bg-amber-500/10 text-amber-400";
        }
    };

    const formatDate = (date) => {
        if (!date) return "Date unavailable";

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) {
            return "Date unavailable";
        }

        return parsedDate.toLocaleString();
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <p className="text-xs font-semibold tracking-[0.2em] text-sky-400">
                        ENQUIRIES
                    </p>

                    <h1 className="mt-2 text-3xl font-bold tracking-tight">
                        Leads
                    </h1>

                    <p className="mt-2 text-sm muted">
                        Manage and respond to website contact enquiries.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-2.5">
                        <p className="text-xs muted">Total Leads</p>
                        <p className="mt-0.5 text-xl font-bold">
                            {leads.length}
                        </p>
                    </div>

                    <button
                        type="button"
                        className="btn-secondary flex items-center gap-2"
                        onClick={load}
                    >
                        <span>↻</span>
                        Refresh
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="panel rounded-2xl p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative min-w-0 flex-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            ⌕
                        </span>

                        <input
                            className="w-full pl-9"
                            placeholder="Search by name, email, subject or service..."
                            value={search}
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                        />
                    </div>

                    <select
                        className="w-full sm:w-44"
                        value={statusFilter}
                        onChange={(event) =>
                            setStatusFilter(event.target.value)
                        }
                    >
                        <option value="All">All statuses</option>

                        {STATUSES.map((status) => (
                            <option key={status} value={status}>
                                {status}
                            </option>
                        ))}
                    </select>

                    <span className="whitespace-nowrap text-sm muted">
                        {filteredLeads.length}{" "}
                        {filteredLeads.length === 1 ? "result" : "results"}
                    </span>
                </div>

                {message && (
                    <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                        {message}
                    </div>
                )}
            </div>

            {/* Leads List */}
            {loading ? (
                <div className="panel rounded-2xl py-16 text-center">
                    <p className="text-sm muted">Loading leads...</p>
                </div>
            ) : filteredLeads.length === 0 ? (
                <div className="panel rounded-2xl py-16 text-center">
                    <div className="text-4xl">📩</div>
                    <h3 className="mt-4 text-lg font-semibold">
                        No leads found
                    </h3>
                    <p className="mt-2 text-sm muted">
                        {search || statusFilter !== "All"
                            ? "Try changing your search or status filter."
                            : "New website enquiries will appear here."}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredLeads.map((lead, index) => {
                        const status = lead.status || "New";

                        return (
                            <article
                                key={lead.id || index}
                                className="panel overflow-hidden rounded-2xl transition-colors hover:border-slate-600"
                            >
                                {/* Card Header */}

                                {/* Card Header */}
                                <div className="flex flex-col justify-between gap-4 border-b border-slate-700/70 p-5 sm:flex-row sm:items-center">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-lg font-bold text-sky-400">
                                            {(lead.name || "U").charAt(0).toUpperCase()}
                                        </div>

                                        <div className="min-w-0">
                                            <h3 className="truncate text-base font-semibold">
                                                {lead.name || "Unknown"}
                                            </h3>

                                            <a
                                                href={`mailto:${lead.email || ""}`}
                                                className="mt-1 block truncate text-sm text-sky-400 hover:text-sky-300"
                                            >
                                                {lead.email || "No email provided"}
                                            </a>

                                            <p className="mt-1 text-xs muted">
                                                {formatDate(lead.createdAt || lead.submitted_at)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Status and Delete Actions */}
                                    <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
                                        <select
                                            className={`min-w-0 flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold outline-none transition-colors sm:w-36 sm:flex-none ${status === "Contacted"
                                                    ? "border-sky-500/40 bg-sky-500/10 text-sky-400"
                                                    : status === "Closed"
                                                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                                                        : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                                                }`}
                                            value={status}
                                            onChange={(event) =>
                                                updateStatus(lead.id, event.target.value)
                                            }
                                        >
                                            {STATUSES.map((item) => (
                                                <option
                                                    key={item}
                                                    value={item}
                                                    className="bg-slate-900 text-white"
                                                >
                                                    {item}
                                                </option>
                                            ))}
                                        </select>

                                        <button
                                            type="button"
                                            className="btn-danger shrink-0 px-4 py-2.5 text-sm"
                                            onClick={() => removeLead(lead.id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>


                                {/* Card Content */}
                                <div className="space-y-4 p-5">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="rounded-xl bg-slate-800/40 p-3">
                                            <p className="mb-1 text-xs font-medium uppercase tracking-wider muted">
                                                Subject
                                            </p>
                                            <p className="text-sm font-medium leading-relaxed">
                                                {lead.subject || "—"}
                                            </p>
                                        </div>

                                        <div className="rounded-xl bg-slate-800/40 p-3">
                                            <p className="mb-1 text-xs font-medium uppercase tracking-wider muted">
                                                Service
                                            </p>
                                            <p className="text-sm font-medium leading-relaxed">
                                                {lead.service || "—"}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider muted">
                                            Message
                                        </p>

                                        <div className="rounded-xl border border-slate-700/70 bg-slate-900/30 p-4">
                                            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">
                                                {lead.message || "No message provided."}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
