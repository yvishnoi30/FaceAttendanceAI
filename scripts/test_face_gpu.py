import os
import time
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort


def add_dll_directory(path):
    path = Path(path)

    if path.exists():
        os.add_dll_directory(str(path))
        os.environ["PATH"] = str(path) + os.pathsep + os.environ.get("PATH", "")


# ---------------------------------------------------------
# CUDA + NVIDIA Python DLLs
# ---------------------------------------------------------

cuda_path = Path(
    r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v13.0"
)

add_dll_directory(cuda_path / "bin" / "x64")

venv = Path(os.environ["VIRTUAL_ENV"])

nvidia_root = venv / "Lib" / "site-packages" / "nvidia"

add_dll_directory(
    nvidia_root / "cu13" / "bin" / "x86_64"
)

add_dll_directory(
    nvidia_root / "cudnn" / "bin"
)


# ---------------------------------------------------------
# InsightFace
# ---------------------------------------------------------

import insightface


print("=" * 70)
print("INSIGHTFACE GPU INFERENCE TEST")
print("=" * 70)

print("\nONNX Runtime:")
print(ort.__version__)

print("\nAvailable providers:")

for provider in ort.get_available_providers():
    print(" -", provider)


# ---------------------------------------------------------
# Load model
# ---------------------------------------------------------

print("\nLoading buffalo_l...")

app = insightface.app.FaceAnalysis(
    name="buffalo_l",
    providers=[
        "CUDAExecutionProvider",
        "CPUExecutionProvider",
    ],
)

app.prepare(
    ctx_id=0,
    det_size=(640, 640),
)

print("Model loaded.")


# ---------------------------------------------------------
# Inspect actual ONNX sessions
# ---------------------------------------------------------

print("\nActual ONNX session providers:")

for name in [
    "det_model",
    "recognition_model",
]:
    model = getattr(app, name, None)

    if model is not None:
        print(f"\n{name}:")
        print(model.session.get_providers())


# ---------------------------------------------------------
# Test image
# ---------------------------------------------------------

image = np.zeros(
    (640, 640, 3),
    dtype=np.uint8,
)

# Draw a simple pattern so we're not benchmarking an empty
# completely uniform image.
cv2.rectangle(
    image,
    (100, 100),
    (540, 540),
    (128, 128, 128),
    3,
)

cv2.circle(
    image,
    (320, 320),
    150,
    (200, 200, 200),
    3,
)


# ---------------------------------------------------------
# Warm-up
# ---------------------------------------------------------

print("\nRunning GPU warm-up...")

for _ in range(5):
    app.get(image)

print("Warm-up complete.")


# ---------------------------------------------------------
# Benchmark
# ---------------------------------------------------------

iterations = 30

times = []

print(f"\nRunning {iterations} inference iterations...")

for i in range(iterations):

    start = time.perf_counter()

    faces = app.get(image)

    end = time.perf_counter()

    elapsed = end - start

    times.append(elapsed)

    print(
        f"Iteration {i + 1:02d}: "
        f"{elapsed * 1000:.2f} ms | "
        f"Faces: {len(faces)}"
    )


# ---------------------------------------------------------
# Statistics
# ---------------------------------------------------------

times_np = np.array(times)

average_ms = times_np.mean() * 1000
median_ms = np.median(times_np) * 1000
min_ms = times_np.min() * 1000
max_ms = times_np.max() * 1000

fps = 1.0 / times_np.mean()


print("\n" + "=" * 70)
print("GPU INFERENCE RESULTS")
print("=" * 70)

print(f"\nAverage latency : {average_ms:.2f} ms")
print(f"Median latency  : {median_ms:.2f} ms")
print(f"Minimum latency : {min_ms:.2f} ms")
print(f"Maximum latency : {max_ms:.2f} ms")
print(f"Approx. FPS     : {fps:.2f}")

print("\n" + "=" * 70)
print("GPU TEST COMPLETE")
print("=" * 70)