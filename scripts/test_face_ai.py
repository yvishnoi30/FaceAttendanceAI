import os
from pathlib import Path

import onnxruntime as ort


def add_dll_directory(path):
    path = Path(path)

    if path.exists():
        os.add_dll_directory(str(path))
        os.environ["PATH"] = str(path) + os.pathsep + os.environ.get("PATH", "")
        print(f"DLL directory added: {path}")
    else:
        print(f"WARNING: DLL directory not found: {path}")


# ---------------------------------------------------------
# CUDA Toolkit
# ---------------------------------------------------------

cuda_path = Path(
    r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v13.0"
)

add_dll_directory(cuda_path / "bin" / "x64")


# ---------------------------------------------------------
# NVIDIA Python packages
# ---------------------------------------------------------

venv = Path(os.environ["VIRTUAL_ENV"])

nvidia_root = venv / "Lib" / "site-packages" / "nvidia"

add_dll_directory(nvidia_root / "cu13" / "bin" / "x86_64")
add_dll_directory(nvidia_root / "cudnn" / "bin")


# ---------------------------------------------------------
# ONNX Runtime
# ---------------------------------------------------------

print("=" * 60)
print("FACE AI ENVIRONMENT TEST")
print("=" * 60)

print("\nONNX Runtime version:")
print(ort.__version__)

print("\nAvailable execution providers:")

for provider in ort.get_available_providers():
    print(" -", provider)


# ---------------------------------------------------------
# InsightFace
# ---------------------------------------------------------

print("\nLoading InsightFace model...")

import insightface

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

print("\nInsightFace model loaded successfully.")

print("\nModel:")
print("buffalo_l")

print("\nGPU execution requested:")
print("CUDAExecutionProvider")

print("\n" + "=" * 60)
print("FACE AI INITIALIZATION SUCCESSFUL")
print("=" * 60)