"use client";

import { useRef, useState } from "react";
import { uploadImage } from "./api";

export default function ImageUpload({ label, value, onChange, help = "JPG, PNG, WEBP, GIF or AVIF · Max 8 MB" }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setError("");
    try {
      const result = await uploadImage(file);
      onChange(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload image.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }
  return (
    <div className="field min-w-0">
      <label>{label}</label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Uploading..." : value ? "Change Image" : "Upload"}
        </button>
        <span className="text-xs muted">{help}</span>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="hidden" onChange={handleFile} />
      {value ? (
        <div className="mt-3 flex flex-wrap items-start gap-3">
          <img src={value} alt="Uploaded preview" className="h-28 w-40 rounded-lg border border-slate-700 object-cover" />
          <div className="min-w-0 flex-1">
            <p className="break-all text-xs muted">{value}</p>
            <button type="button" className="mt-2 text-xs text-rose-300 hover:text-rose-200" onClick={() => onChange("")}>Remove image</button>
          </div>
        </div>
      ) : <p className="mt-2 text-xs muted">No image selected.</p>}
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
