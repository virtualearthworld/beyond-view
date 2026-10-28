"""Beyond View: diagnostic feature correspondence test (not 3D reconstruction).

Usage: python tests/inspect_video_geometry.py path/to/video.mov
Dependencies: opencv-python, numpy
"""
import argparse
import json
import cv2
import numpy as np


def inspect(path, interval=2.0, max_seconds=20.0):
    capture = cv2.VideoCapture(path)
    if not capture.isOpened():
        raise ValueError("Cannot open video")
    detector = cv2.ORB_create(nfeatures=2500)
    frames = []
    for t in np.arange(0, max_seconds, interval):
        capture.set(cv2.CAP_PROP_POS_MSEC, float(t) * 1000)
        ok, image = capture.read()
        if not ok:
            break
        gray = cv2.cvtColor(cv2.resize(image, (640, 360)), cv2.COLOR_BGR2GRAY)
        keypoints, descriptors = detector.detectAndCompute(gray, None)
        if descriptors is not None:
            frames.append((float(t), keypoints, descriptors))
    capture.release()
    matcher = cv2.BFMatcher(cv2.NORM_HAMMING)
    results = []
    for (t, kp1, des1), (u, kp2, des2) in zip(frames, frames[1:]):
        matches = matcher.knnMatch(des1, des2, k=2)
        good = [a for pair in matches if len(pair) == 2 for a, b in [pair] if a.distance < 0.7 * b.distance]
        inliers = 0
        if len(good) >= 8:
            points1 = np.float32([kp1[m.queryIdx].pt for m in good])
            points2 = np.float32([kp2[m.trainIdx].pt for m in good])
            _, mask = cv2.findFundamentalMat(points1, points2, cv2.FM_RANSAC, 2.0, 0.99)
            if mask is not None:
                inliers = int(mask.sum())
        results.append({"start_s": t, "end_s": u, "matches": len(good), "geometry_inliers": inliers})
    return {"video": path, "interval_seconds": interval, "pairs": results,
            "warning": "Feature matches are a diagnostic only; this does not reconstruct 3D."}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("video")
    parser.add_argument("--interval", type=float, default=2.0)
    parser.add_argument("--max-seconds", type=float, default=20.0)
    args = parser.parse_args()
    print(json.dumps(inspect(args.video, args.interval, args.max_seconds), indent=2))
