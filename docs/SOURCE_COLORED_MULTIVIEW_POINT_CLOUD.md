# Source-colored multi-view landmark cloud

The Reconstruction Lab now has a source-derived appearance pass for the multi-view landmarks that already passed the fixed-3D-point consistency and per-component spatial/temporal support gates.

## How it works

- Every accepted landmark retains its measured pixel coordinate in each contributing sampled source frame.
- A small 3 × 3 neighborhood around each observation is sampled from the decoded original frame. The per-channel median is used for that view.
- The per-channel median across valid source views becomes the landmark's RGB color.
- A point is left uncolored when fewer than two valid source observations are available; the geometry is retained, but no replacement color is invented.
- The exported PLY contains the largest supported camera component only. It records source-derived RGB, support count, reprojection error, and component-local coordinates.

## What this adds

The preview and PLY now carry color sampled from the user's actual video instead of a single diagnostic tint. The color provenance is traceable to sampled source-frame indices and timestamps. Disconnected camera components remain separate.

## What this does not add

This is not texture mapping. It does not create triangles, fill holes, infer hidden surfaces, or turn sparse landmarks into a dense 3D environment. The colors are point samples and can be affected by exposure changes, motion, reflections, and any geometrically consistent dynamic features that survive the existing filters. Camera calibration and monocular scale remain provisional. Free navigation remains disabled.

The original waterfront clip has not yet been processed by the current Lab in a verified end-to-end run, so no source-specific color coverage or reconstruction quality is claimed.
