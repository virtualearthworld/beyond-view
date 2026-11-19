# Track-derived geometric-instability exclusion masks

## Purpose
Reduce contamination of sparse static geometry by withholding otherwise-consistent tracks that repeatedly overlap a spatial cluster of multi-view-inconsistent tracks. This runs after the final leave-one-observation-out consistency audit and before distributed static-scene support.

## Algorithm
1. Consider only tracks marked multi-view-inconsistent with at least four observations and sufficiently high median or p95 held-out reprojection error.
2. Count distinct inconsistent tracks in each 24-pixel image cell, separately for each sampled frame and connected camera component.
3. Mark a cell only when at least three inconsistent tracks occupy it in the same frame/component.
4. Expand each marked cell by one neighboring cell.
5. Withhold an otherwise-consistent track only when at least two observations and at least 25% of its valid observations overlap those component-local masks.
6. Pass remaining tracks to distributed support, trajectory refinement, sparse geometry, fusion, and PLY export.

Uncertain tracks do not create masks. Disconnected components are never pooled. No source pixels are repainted, filled, or synthesized.

## Interpretation limits
The mask is not semantic person, water, or reflection segmentation. Inconsistent tracks can be caused by moving people, water/reflections, occlusion, mismatches, rolling shutter, calibration errors, or camera-pose errors. Dilation can also remove nearby static features. Coherent moving content can still pass. The red overlay is an exclusion-candidate visualization only.

## Verification status
Synthetic tests cover clustered and unclustered tracks, component isolation, uncertain/consistent track exclusion from mask seeding, repeated overlap thresholds, and invalid observations. The original waterfront file has not been processed through this stage, so source-specific effectiveness is unverified. The sparse preview and PLY remain provisional geometry, not a finished textured 3D environment.
