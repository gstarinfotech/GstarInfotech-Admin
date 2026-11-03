
"use client";

import { useEffect, useState } from "react";
import { api } from "../../../components/api";

const DEFAULT_HEAD_CODE = `<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-MSVHND6RHQ"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-MSVHND6RHQ');
</script>`;

const EMPTY_SETTINGS = {
    headCode: DEFAULT_HEAD_CODE,
    bodyStartCode: "",
    bodyEndCode: "",
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Settings() {
    const [data, setData] = useState(EMPTY_SETTINGS);
    const [msg, setMsg] = useState("");
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState("idle");

    useEffect(() => {
        async function loadSettings() {
            try {
                const settings = await api("/api/settings");

                setData({
                    ...EMPTY_SETTINGS,
                    ...settings,
                    headCode: settings?.headCode?.trim()
                        ? settings.headCode
                        : DEFAULT_HEAD_CODE,
                });
            } catch (error) {
                setMsg(
                    error instanceof Error
                        ? error.message
                        : "Unable to load settings."
                );
            } finally {
                setLoading(false);
            }
        }

        loadSettings();
    }, []);

    function change(key, value) {
        setData((previous) => ({
            ...previous,
            [key]: value,
        }));

        setMsg("");
        setSaveStatus("idle");
    }

    async function save(event) {
        event.preventDefault();

        if (busy) return;

        const startTime = Date.now();

        setBusy(true);
        setSaveStatus("saving");
        setMsg("");

        let successful = false;

        try {
            await api("/api/settings", {
                method: "PUT",
                body: JSON.stringify(data),
            });

            successful = true;
        } catch (error) {
            setMsg(
                error instanceof Error
                    ? error.message
                    : "Unable to save settings."
            );
        }

        // Saving state minimum 900ms tak visible rahega.
        const elapsed = Date.now() - startTime;

        if (elapsed < 900) {
            await delay(900 - elapsed);
        }

        if (successful) {
            setSaveStatus("saved");

            // Saved status 1.5 seconds tak visible rahega.
            await delay(1500);

            setSaveStatus("idle");
        } else {
            setSaveStatus("error");
        }

        setBusy(false);
    }

    return (
        <div>
            <div className="mb-6">
                <p className="text-xs tracking-widest text-sky-400">
                    WEBSITE CONFIGURATION
                </p>

                <h1 className="mt-2 text-3xl font-semibold">
                    Settings
                </h1>

                <p className="mt-2 text-sm muted">
                    Manage tracking, verification, and approved third-party scripts.
                </p>
            </div>

            <form
                onSubmit={save}
                className="panel space-y-5 p-5 md:p-6"
            >
                <div className="field">
                    <label>Head Code</label>

                    <textarea
                        rows={9}
                        className="font-mono text-xs"
                        value={data.headCode}
                        onChange={(event) =>
                            change("headCode", event.target.value)
                        }
                        placeholder="Add code that should be placed inside the website head."
                    />

                    <p className="mt-2 text-xs muted">
                        The existing Google Analytics code is included here.
                        Keep it in place when adding other head scripts.
                    </p>
                </div>

                <div className="field">
                    <label>Body Start Code</label>

                    <textarea
                        rows={7}
                        className="font-mono text-xs"
                        value={data.bodyStartCode}
                        onChange={(event) =>
                            change("bodyStartCode", event.target.value)
                        }
                        placeholder="Add code immediately after the opening body tag."
                    />
                </div>

                <div className="field">
                    <label>Body End Code</label>

                    <textarea
                        rows={7}
                        className="font-mono text-xs"
                        value={data.bodyEndCode}
                        onChange={(event) =>
                            change("bodyEndCode", event.target.value)
                        }
                        placeholder="Add code immediately before the closing body tag."
                    />
                </div>

                <p className="text-xs text-amber-300">
                    Security: Only add code from trusted providers.
                    Incorrect scripts may affect website functionality.
                    Saved code will not run on the public website until
                    the website integration is configured.
                </p>

                {msg && (
                    <p className="text-sm text-red-400">
                        {msg}
                    </p>
                )}

                <button
                    type="submit"
                    className="btn"
                    disabled={busy || loading}
                >
                    {loading
                        ? "Loading..."
                        : saveStatus === "saving"
                            ? "Saving..."
                            : saveStatus === "saved"
                                ? "Saved ✓"
                                : "Save Settings"}
                </button>
            </form>
        </div>
    );
}
