# Beyond View — sample video reconstruction inspection

Sample: `IMG_1325.mov` (user-provided; **not committed**, to preserve privacy).
Video: 1920×1080, H.264, ~19.835 seconds, ~30 fps, ~37.9 MB.

## Reproducible geometry sanity test

This test samples video frames at two-second intervals, detects ORB features, matches them with a Lowe-ratio threshold, and estimates a fundamental matrix with RANSAC. This is **not** a video-to-3D converter: it is an early diagnostic for whether neighboring frames contain enough stable correspondences to attempt camera estimation.

Install `opencv-python` and `numpy`, then run `python tests/inspect_video_geometry.py /path/to/IMG_1325.mov`.

## Observed result on supplied sample

| Interval (seconds) | Ratio-filtered matches | RANSAC geometric inliers |
|---|---:|---:|
| 0–2 | 66 | 47 |
| 2–4 | 88 | 78 |
| 4–6 | 49 | 35 |
| 6–8 | 187 | 143 |
| 8–10 | 43 | 37 |
| 10–12 | 38 | 32 |
| 12–14 | 12 | 7 |
| 14–16 | 26 | 19 |
| 16–18 | 26 | 19 |

**Status: NOT PASSED.** The app does not yet turn this normal video into a verified freely explorable 3D reconstruction. Good pairwise matches do not prove accurate depth or a stable camera trajectory. A next implementation must include robust track building, camera pose estimation, triangulation, scene representation and rendering, and an end-to-end video test with verifiable output. The 37.9 MB video also exceeds the current backend's 25 MB upload limit.

Do not present 360° panoramas, pre-existing demos, frame ZIPs, or branded third-party viewers as evidence that the milestone has been reached.
