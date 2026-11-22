# Source-colored multi-view landmark cloud

The Reconstruction Lab has a source-derived appearance pass for multi-view landmarks that already passed the fixed-3D-point consistency and per-component spatial/temporal support gates.

## How it works

- Every accepted landmark retains its measured pixel coordinate in each contributing sampled source frame.
- A small 3 × 3 neighborhood around each observation is sampled from the decoded original frame. The per-channel median is used for that view.
- Repeated records from the same decoded frame count as one view; duplicate observations cannot satisfy the minimum multi-view color requirement.
- The per-channel median across distinct valid source views becomes the landmark's RGB color.
- A point is left uncolored when fewer than two valid source views are available; its geometry is retained without fabricating a source color.
- The exported PLY records source-view count, first/last contributing sampled-frame indices, color-observation count, mean and maximum reprojection error, maximum triangulation angle, and component-local coordinates.
- When a PLY contains both colored and uncolored vertices, its `color_valid` property marks source-sampled RGB (1) versus a zero-valued placeholder (0). Consumers must not interpret placeholder RGB as measured appearance.

## What this adds

The preview and PLY carry color sampled from the user's actual video instead of a single diagnostic tint. The per-point metadata makes it possible to distinguish sparse geometric support, source-view coverage, color availability, and reprojection quality. Disconnected camera components remain separate.

## What this does not add

This is not texture mapping. It does not create triangles, fill holes, infer hidden surfaces, or turn sparse landmarks into a dense 3D environment. The colors are point samples and can be affected by exposure changes, motion, reflections, and geometrically consistent dynamic features that survive the existing filters. Camera calibration and monocular scale remain provisional. Free navigation remains disabled.

The original waterfront clip has not yet been processed by the current Lab in a verified end-to-end run, so no source-specific color coverage or reconstruction quality is claimed.
