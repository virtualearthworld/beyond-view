# Beyond View upload backend (prototype)

This backend receives a video from the Beyond View website and stores it in Cloudflare R2. It does **not** reconstruct 3D yet.

## What it does
- Accepts MP4/MOV and other browser-recognized video MIME types up to 25 MB.
- Stores each video under a random ID.
- Returns an upload ID and `reconstructionStatus: "not_started"`.
- Provides `GET /api/status?id=<uploadId>` to retrieve upload metadata.
- Allows browser requests from the production GitHub Pages origin and localhost development origins.

## What it does not do
- It does not convert video to 3D or create Gaussian splats.
- It does not provide user accounts, authentication, quotas, or abuse protection.
- Do not advertise this public prototype for general uploads until authentication and rate limits are added. The 25 MB limit is a prototype limit, not a production security system.

## Deploy (requires a Cloudflare account)
1. Install Node.js and Wrangler: `npm install -g wrangler`.
2. In this folder, run `wrangler login`.
3. Create the storage bucket: `wrangler r2 bucket create beyond-view-videos`.
4. Deploy: `wrangler deploy`.
5. Copy the Worker URL Wrangler prints.
6. Edit the repository's root `config.js` and set `window.BEYOND_VIEW_UPLOAD_API` to that URL, then commit the change.
7. Open the GitHub Pages site, choose a video under 25 MB, and press **Upload video**. Verify that an upload ID is returned.

## Cost and limitations
Cloudflare may offer free allowances for Workers and R2, but account eligibility, quotas, and pricing can change. Check the current Cloudflare dashboard/pricing before uploading anything important. Video storage and transfer may incur charges if usage exceeds included allowances. The upload endpoint is not yet suitable for untrusted public traffic.

## Next development stage
After a test upload is verified, add a separate reconstruction job pipeline. Real video-to-3D reconstruction usually needs substantial CPU/GPU processing and must be evaluated separately; successful upload is not proof of successful 3D conversion.
