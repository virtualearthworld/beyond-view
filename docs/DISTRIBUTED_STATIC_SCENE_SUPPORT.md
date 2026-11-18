# Distributed static-scene candidate support

## Purpose

The leave-one-observation-out fixed-3D-point check can still pass a localized cluster of features. Before any geometrically consistent tracks enter trajectory refinement, sparse geometry, fusion, or PLY export, Beyond View now evaluates evidence coverage separately inside each connected camera component.

## Default gate

A component must satisfy all of the following:

- At least 16 valid tracks, each with at least 4 consecutive observations.
- First observations occupy at least 6 of a 4 × 3 image grid.
- Occupancy spans at least 3 grid columns and 2 grid rows.
- The component's observed track interval spans at least 25% of all sampled frames.
- At least 2 tracks are present in at least half of the frames inside that component's observed interval.

Disconnected components are evaluated independently. Tracks from separate camera components cannot be pooled to reach the minimum.

A component that fails is withheld from trajectory refinement, sparse geometry, point-cloud fusion, and PLY export. The Lab reports per-component track count, image-cell occupancy, and temporal coverage.

## Interpretation and limitations

This is a conservative spatial/temporal evidence gate. It is **not semantic segmentation** and does not identify a person, boat, water, reflection, or building. A moving object can still pass if its tracks satisfy the fixed-3D geometric test and are distributed across the image and time. Conversely, a real static structure can be withheld when too few features or too little coverage are available.

The thresholds are a fail-closed engineering default, not measurements from the original waterfront clip. Passing them does not prove calibration, metric depth, static identity, dense surface quality, or navigability. The exact original video still requires a verified end-to-end run and source-frame inspection.

## Regression coverage

Synthetic tests verify:
- a spatially distributed, temporally supported component passes;
- a large but localized feature cluster fails;
- a broad but brief component fails;
- disconnected components cannot pool track counts;
- out-of-frame observations are excluded and counted; and
- invalid thresholds are rejected.

These tests validate the gate on controlled inputs only. They are not a reconstruction result from IMG_1325(1).mov.

## Next acceptance gate

Use source-aligned people/water/reflection masks, then run the exact waterfront video through the existing single-upload and explicit Analyze flow. Compare camera poses, track coverage, triangulation and reprojection, and the resulting geometry against original frames before enabling any navigation.
