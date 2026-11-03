const API = process.env.NEXT_PUBLIC_ADMIN_API_URL || "http://localhost:4001";

export function token() {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("gstar_admin_token") || "";
}

export async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
        ...options,
        cache: "no-store",
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
            ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        },
    });

    const data = await response.json().catch(() => ({}));

    if (
        response.status === 401 &&
        typeof window !== "undefined" &&
        !path.includes("/auth/login")
    ) {
        window.localStorage.removeItem("gstar_admin_token");
        window.location.href = "/admin/login";
    }

    if (!response.ok) {
        throw new Error(data.error || "Request failed");
    }

    return data;
}


// Multipart upload helper: do not set Content-Type manually; fetch adds the boundary.
export async function uploadImage(file) {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`${API}/api/uploads/image`, {
        method: "POST",
        body: form,
        headers: token() ? { Authorization: `Bearer ${token()}` } : {},
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && typeof window !== "undefined") {
        window.localStorage.removeItem("gstar_admin_token");
        window.location.href = "/admin/login";
    }
    if (!response.ok) throw new Error(data.error || "Image upload failed");
    return data;
}
