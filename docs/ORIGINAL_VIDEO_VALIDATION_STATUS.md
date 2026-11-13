# Original video validation status — Beyond View

## Exact target source

The target is the previously supplied `IMG_1325(1).mov`, a waterfront recording. Do not substitute a staged single-object orbit video, a demo scene, or another upload.

Previously recorded source metadata:
- 1920 × 1080
- approximately 29.9975 FPS
- 595 frames
- 19.835 seconds
- approximately 37.9 MB

The original file is deliberately not committed to this public repository.

## Historical source-video evidence

These values come from earlier independent local OpenCV experiments on the exact source file. They are not a fresh run of the current browser Lab and do not prove a complete reconstruction.

| Test | Historical result | Interpretation |
|---|---:|---|
| Camera-coverage sample | 40 frames / 39 adjacent pairs | Broad temporal sample |
| Median ratio-filtered ORB matches | 310 per pair | Repeated image texture is available |
| Median fundamental-matrix inliers | 210 per pair | Many matches are epipolar-consistent |
| Median homography inliers | 146 per pair | A dominant 2D mapping explains some image motion |
| Median occupied image-grid cells | 7 of 12 | Matches are spread across much of the image |
| Relative-pose recovery | 39 / 39 pairs | Pairwise pose was possible under provisional intrinsics |
| Median triangulation angle | 4.60° | Depth conditioning is limited for many observations |
| Pair-local points below 2° | 27.3% | A substantial minority have weak parallax |
| Median two-view reprojection error | about 0.388 px | Low image residual does not guarantee accurate depth |

The clip contains two people in the foreground with waterfront, skyline, and water behind them. People, water, reflections, boat structure, and other independently moving content must not be mistaken for static scene geometry.

## Current application flow

- `index.html` contains no video picker; it links to the Reconstruction Lab.
- `reconstruction-lab.html` contains the only video picker and one **Analyze video** button.
- Selecting the file creates a browser-local object URL and waits for metadata. It does not start frame sampling or upload the video.
- The button remains disabled until the analysis module is initialized and the selected file has a positive video width, height, and duration.
- Analysis begins only after the user presses **Analyze video**.
- The Lab samples up to 32 frames at 0.75-second intervals, resized to 480 pixels wide, then performs feature tracking, homography diagnostics, pairwise epipolar camera-pose estimation, multi-frame track linking, trajectory regularization, experimental translation/landmark bundle adjustment, sparse triangulation, multi-view reprojection checks, and provisional point-cloud fusion.
- The video remains local to the browser in this workflow; no Beyond View server upload is performed.

## Important limitations in the current pipeline

- Homography-consistent tracks are not proof of static background. Homography residuals may be parallax, occlusion, reflections, moving people/water, or matching errors.
- The homography-based layer report is diagnostic only. It is not semantic person/water segmentation, and it does not prove that foreground people or water have been removed from the geometry inputs.
- Camera calibration is assumed unless the user supplies a trusted focal length. Lens distortion and absolute scale are not recovered.
- Relative camera poses may contain gaps and accumulated drift. Translation-only regularization and experimental landmark/translation bundle adjustment are not full global bundle adjustment.
- The sparse preview displays a pair-local cloud. The PLY export is provisional, has unknown scale, and is not a textured mesh or Gaussian-splat environment.
- The separate `immersive-engine/` build is not connected to the Lab's selected video and has not been validated on this source.
- The Cloudflare Worker under `backend/` is an upload-only prototype, not a reconstruction service. It has a 25 MB limit, while this source is approximately 37.9 MB; `config.js` is blank and no Worker endpoint is configured for the app.

## What is not yet proven

- A stable, calibrated camera trajectory across the entire clip.
- Reliable separation of people, water, reflections, and other moving content from static waterfront geometry.
- Accurate depth or metric scale.
- A coherent, recognizable source-faithful 3D representation with appearance.
- A source-frame inspection/provenance view for every rendered surface.
- A coverage-bounded navigation experience.
- A complete browser end-to-end run of the exact clip using the current one-upload, explicit-Analyze flow.

No fresh browser run of the exact clip is recorded in this update. Historical OpenCV measurements remain historical and must not be presented as current app output.

## Next acceptance gate

Run the exact existing waterfront file through the Reconstruction Lab, wait for the decoded-video-ready state, and press **Analyze video**. Inspect:
- per-pair pose success and gaps;
- persistent track survival and connected camera components;
- raw versus refined reprojection using identical landmarks;
- accepted and rejected sparse/multi-view points;
- triangulation-angle distribution and weak-parallax count;
- fused point-cloud shape and exported PLY against actual source frames.

Only after a recognizable, stable, source-faithful sparse reconstruction passes this gate should the project move to dense mesh/3DGS appearance reconstruction. Navigation must later be restricted to measured coverage. Unseen scenery remains unknown.
