const ALLOWED_ORIGINS = new Set([
  "https://virtualearthworld.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000"
]);
const MAX_BYTES = 25 * 1024 * 1024;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return new Response("Origin not allowed", { status: 403 });
    }
    const cors = corsHeaders(origin || "https://virtualearthworld.github.io");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (url.pathname === "/api/upload" && request.method === "POST") {
      const declaredLength = Number(request.headers.get("Content-Length") || 0);
      if (declaredLength > MAX_BYTES + 1024 * 1024) {
        return json({ error: "Upload is too large. Maximum video size is 25 MB." }, 413, cors);
      }
      let form;
      try {
        form = await request.formData();
      } catch {
        return json({ error: "Expected a multipart form containing a video file." }, 400, cors);
      }
      const file = form.get("video");
      if (!file || typeof file.arrayBuffer !== "function") {
        return json({ error: "No video file was included." }, 400, cors);
      }
      if (!file.type || !file.type.startsWith("video/")) {
        return json({ error: "Please upload a video file." }, 415, cors);
      }
      if (file.size < 1 || file.size > MAX_BYTES) {
        return json({ error: "Video must be between 1 byte and 25 MB." }, 413, cors);
      }
      const uploadId = crypto.randomUUID();
      const safeName = String(file.name || "video").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
      const extension = (safeName.match(/\.([a-zA-Z0-9]{1,8})$/) || [,"video"])[1].toLowerCase();
      const videoKey = `videos/${uploadId}.${extension}`;
      const metadata = {
        uploadId,
        originalName: safeName,
        contentType: file.type,
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
        videoKey,
        reconstructionStatus: "not_started",
        note: "Video stored successfully. Video-to-3D reconstruction is not implemented."
      };
      try {
        await env.VIDEO_BUCKET.put(videoKey, file.stream(), {
          httpMetadata: { contentType: file.type },
          customMetadata: { uploadId }
        });
        await env.VIDEO_BUCKET.put(`metadata/${uploadId}.json`, JSON.stringify(metadata), {
          httpMetadata: { contentType: "application/json" }
        });
      } catch (error) {
        console.error("R2 storage error", error);
        return json({ error: "The server could not store this video. Check the R2 bucket binding." }, 500, cors);
      }
      return json({ uploadId, originalName: safeName, sizeBytes: file.size, reconstructionStatus: "not_started" }, 201, cors);
    }

    if (url.pathname === "/api/status" && request.method === "GET") {
      const uploadId = url.searchParams.get("id") || "";
      if (!/^[a-f0-9-]{36}$/i.test(uploadId)) {
        return json({ error: "A valid upload ID is required." }, 400, cors);
      }
      const object = await env.VIDEO_BUCKET.get(`metadata/${uploadId}.json`);
      if (!object) return json({ error: "Upload not found." }, 404, cors);
      return new Response(object.body, {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8", ...cors }
      });
    }

    return json({ error: "Not found. Use POST /api/upload or GET /api/status?id=…" }, 404, cors);
  }
};
