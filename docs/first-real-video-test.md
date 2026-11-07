# Beyond View: first real-video test

## What footage the current engine supports

The integrated browser engine is designed for **orbit footage**: the camera moves around a mostly stationary subject or scene, capturing overlapping views from different angles.

It is not yet a general-purpose converter for arbitrary videos. Edited clips with cuts, fast camera motion, heavy zooming, a moving subject, or a camera that never changes viewpoint may not produce a coherent 3D result.

## Recommended capture

- Choose one mostly stationary object or scene with visible surface texture.
- Move the camera slowly around it; keep the subject in frame.
- Make adjacent viewpoints overlap so the same details appear in multiple frames.
- Keep lighting reasonably even and avoid motion blur, rapid pans, zooms and cuts.
- A full orbit is useful when practical, but do not sacrifice stability to complete it.

## Run the test

1. Use a desktop version of Chrome or Edge with WebGPU enabled and an up-to-date graphics driver.
2. Open the Beyond View main page and choose the MP4 or MOV file.
3. Select **Open video-to-3D engine**. It opens in a new tab and imports the selected file through a browser-local Blob URL. Keep the original Beyond View tab open until import completes.
4. In the engine, inspect the extracted frames. If the selected range contains blur or inconsistent views, adjust the range before continuing.
5. Run camera-pose estimation. Confirm that the engine registers the frames and produces a plausible camera orbit.
6. Run Gaussian-splat training. Review the live preview and final scene from viewpoints not present in the original footage.
7. If successful, export a SOG, PLY or GLB file.

## Record the outcome

For each test, record:
- browser and version;
- computer/GPU;
- input duration, resolution and file size;
- whether frame extraction completed;
- whether camera poses registered;
- training duration and whether it completed;
- visible defects such as floaters, holes, doubled edges or distorted geometry;
- export format and file size.

## Current limitations

- Processing runs locally in the browser and depends on WebGPU, GPU memory, available system memory and device performance.
- The first run may download supporting models or assets.
- A Gaussian-splat scene is not automatically a watertight mesh or a collision-aware world with unrestricted walking.
- The integrated engine is an open-source orbit-reconstruction component. Connecting its saved scene packages to Beyond View's own video/feed experience is a separate milestone.
- Do not claim reliable general video-to-3D conversion until multiple real videos have been tested and quality has been measured.
