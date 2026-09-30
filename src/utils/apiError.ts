/** Extract a human-readable message from an Axios error or API response */
export function apiErrorMsg(e: any, fallback = "An error occurred"): string {
  const d = e?.response?.data;
  if (!d) return e?.message || fallback;

  // String response or direct string error
  if (typeof d === "string") return d;
  if (typeof d?.error === "string") return d.error;
  if (typeof d?.detail === "string") return d.detail;
  if (Array.isArray(d?.detail) && d.detail.length > 0) return String(d.detail[0]);

  // DRF Validation Errors in d.errors (e.g. { errors: { code: ["project with this code already exists."] } })
  const errorsObj = d?.errors;
  if (errorsObj && typeof errorsObj === "object") {
    const messages: string[] = [];
    for (const [key, val] of Object.entries(errorsObj)) {
      if (Array.isArray(val) && val.length > 0) {
        messages.push(`${key}: ${val[0]}`);
      } else if (typeof val === "string" && val.trim()) {
        messages.push(`${key}: ${val}`);
      } else if (val && typeof val === "object") {
        messages.push(`${key}: ${JSON.stringify(val)}`);
      }
    }
    if (messages.length > 0) {
      return messages.join(" | ");
    }
  }

  // Top-level message if not generic "Validation failed" / "Internal server error"
  if (typeof d?.message === "string" && d.message !== "Internal server error" && d.message !== "Validation failed") {
    return d.message;
  }

  // If d itself is a dict of field errors: { code: ["..."], name: ["..."] }
  if (typeof d === "object") {
    const messages: string[] = [];
    for (const [key, val] of Object.entries(d)) {
      if (key === "status" || key === "status_code" || key === "timestamp" || key === "message") continue;
      if (Array.isArray(val) && val.length > 0) {
        messages.push(`${key}: ${val[0]}`);
      } else if (typeof val === "string" && val.trim()) {
        messages.push(`${key}: ${val}`);
      }
    }
    if (messages.length > 0) {
      return messages.join(" | ");
    }
  }

  return d?.message || fallback;
}
