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
            setMessage(error instanceof Error ? error.message : "Unable to load leads.");
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
            setMessage(error instanceof Error ? error.message : "Unable to update lead status.");
        }
    }

    async function removeLead(id) {
        if (!window.confirm("Delete this lead?")) return;

        try {
            await api(`/api/leads/${encodeURIComponent(id)}`, {
                method: "DELETE",
            });
            await load();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Unable to delete lead.");
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
                statusFilter === "All" || (lead.status || "New") === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [leads, search, statusFilter]);

    return (
        <div>
            <div className="mb-6">
                <p className="text-xs tracking-widest text-sky-400">ENQUIRIES</p>
                <h1 className="mt-2 text-3xl font-semibold">Leads</h1>
                <p className="mt-2 text-sm muted">
                    Contact form submissions from the GStar website.
                </p>
            </div>

            <div className="panel p-4">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                    <input
                        className="max-w-sm"
                        placeholder="Search name, email, subject..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />

                    <select
                        className="w-auto"
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                    >
                        <option value="All">All statuses</option>
                        {STATUSES.map((status) => (
                            <option key={status} value={status}>
                                {status}
                            </option>
                        ))}
                    </select>

                    <button type="button" className="btn-secondary" onClick={load}>
                        Refresh
                    </button>

                    <span className="self-center text-sm muted">
                        {filteredLeads.length} leads
                    </span>
                </div>

                {message && (
                    <p className="mb-3 text-sm text-amber-300">{message}</p>
                )}

                {loading ? (
                    <p className="py-10 text-center text-sm muted">Loading leads...</p>
                ) : filteredLeads.length === 0 ? (
                    <p className="py-10 text-center text-sm muted">
                        No leads found.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {filteredLeads.map((lead, index) => (
                            <article
                                key={lead.id || index}
                                className="rounded-xl border border-slate-700 p-4"
                            >
                                <div className="flex flex-wrap justify-between gap-3">
                                    <div>
                                        <h3 className="font-semibold">
                                            {lead.name || "Unknown"}
                                        </h3>
                                        <a
                                            className="text-sm text-sky-300"
                                            href={`mailto:${lead.email || ""}`}
                                        >
                                            {lead.email || "No email provided"}
                                        </a>
                                        <p className="mt-1 text-xs muted">
                                            {lead.submitted_at
                                                ? new Date(lead.submitted_at).toLocaleString()
                                                : ""}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <select
                                            className="w-auto text-sm"
                                            value={lead.status || "New"}
                                            onChange={(event) =>
                                                updateStatus(lead.id, event.target.value)
                                            }
                                        >
                                            {STATUSES.map((status) => (
                                                <option key={status} value={status}>
                                                    {status}
                                                </option>
                                            ))}
                                        </select>

                                        <button
                                            type="button"
                                            className="btn-danger"
                                            onClick={() => removeLead(lead.id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                                    <p>
                                        <span className="muted">Subject: </span>
                                        {lead.subject || "—"}
                                    </p>
                                    <p>
                                        <span className="muted">Service: </span>
                                        {lead.service || "—"}
                                    </p>
                                </div>

                                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">
                                    {lead.message || "—"}
                                </p>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
