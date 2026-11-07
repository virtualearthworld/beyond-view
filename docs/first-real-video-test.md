# Beyond View: original waterfront video validation

## Target source — do not substitute another clip

The target is the user's existing IMG_1325(1).mov waterfront video. It is a normal real-world recording, not a staged single-object orbit capture. The intended result must preserve the actual scene and its original people, waterfront, skyline, water, and camera movement. Do not replace it with a demo scene or ask the user to record a different video.

Recorded source metadata:
- 1920 × 1080
- approximately 29.9975 FPS
- 595 frames
- 19.835 seconds
- approximately 37.9 MB

The original video is not committed to this public repository.

## Previously measured results

These are historical independent local OpenCV diagnostics on the user's original video, not a fresh browser run:

| Measurement | Prior result |
|---|---:|
| Sampled frames in camera-coverage audit | 40 |
| Adjacent pairs | 39 |
| Median ratio-filtered ORB matches per pair | 310 |
| Median fundamental-matrix RANSAC inliers | 210 |
| Median homography inliers | 146 |
| Median occupied image-grid cells | 7 of 12 |
| Pairs with at least 8 fundamental-matrix inliers | 39 / 39 |
| Pairs with relative pose recovered in parallax audit | 39 / 39 |
| Median per-pair triangulation angle | 4.60° |
| Accepted pair-local observations below 2° | 27.3% |
| Median two-view reprojection error | approximately 0.388 px |

The correspondence and pairwise pose results justify continued work. The low triangulation angles warn that depth is weak for a meaningful fraction of observations. Pairwise reprojection error is not proof of accurate depth, a globally stable camera path, or a walkable 3D environment.

## What the app now does with this exact file

1. Choose the same IMG_1325(1).mov in the Beyond View main workspace.
2. Select **Analyze this video in Reconstruction Lab**.
3. The main page passes the same browser-local video Blob URL to the first-party lab in a new tab.
4. The lab imports that exact local video and automatically starts its camera, track, trajectory, sparse triangulation, bundle-adjustment, and reprojection diagnostics.
5. The original tab must remain open while the lab reads the Blob URL.

The video is not uploaded to a Beyond View server. This is a browser handoff and automated analysis path; it is not yet proof that the entire clip has reconstructed into a complete 3D scene.

## What must be checked in the next run

- How many adjacent pairs yield relative camera poses in the browser pipeline.
- How many persistent tracks survive across the sampled clip.
- Whether the estimated trajectory remains in connected components or has failed gaps.
- Raw versus refined reprojection error using the same landmarks.
- Number of accepted sparse 3D points and connected cloud components.
- Median triangulation angle and the fraction below the 2° warning threshold.
- Whether the exported PLY resembles measured geometry from the actual waterfront scene rather than noise or a fragmented pair-local cloud.

The source contains moving foreground people and water/reflections. Residual motion from the background homography is not a semantic person/water detector; it can also be parallax, occlusion, reflection, or tracking error. Ambiguous tracks must remain uncertain. Do not fuse moving foreground features into static building geometry.

## Acceptance gate

The next milestone is a recognizable, source-faithful sparse reconstruction of the actual waterfront clip, supported by stable multi-frame camera poses and measured reprojection. It is not yet the final 3D Gaussian-splat experience. Do not call the video successfully reconstructed until the output can be inspected against its source frames and unsupported regions remain unknown.

A 3D Gaussian-splat or mesh stage comes after the original clip's camera and geometry evidence is strong enough. The separate Gausify Orbit component remains experimental and is not the primary analysis path for this moving waterfront footage.
