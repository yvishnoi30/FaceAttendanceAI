
from pathlib import Path

import cv2
import numpy as np
from insightface.app import FaceAnalysis


class FaceEncoder:
    """
    Detect faces and generate normalized 512-dimensional
    face embeddings using the InsightFace buffalo_l model.
    """

    def __init__(self, device: str = "cuda"):
        self.device = device

        providers = (
            ["CUDAExecutionProvider", "CPUExecutionProvider"]
            if device.lower() == "cuda"
            else ["CPUExecutionProvider"]
        )

        self.app = FaceAnalysis(
            name="buffalo_l",
            providers=providers,
        )

        self.app.prepare(
            ctx_id=0 if device.lower() == "cuda" else -1,
            det_size=(640, 640),
        )

    def encode_image(self, image_path: str) -> list[dict]:
        """
        Return face embeddings and quality metadata for
        all faces detected in the supplied image.
        """

        path = Path(image_path)

        if not path.is_file():
            raise FileNotFoundError(
                f"Image file not found: {path}"
            )

        image = cv2.imread(str(path))

        if image is None:
            raise ValueError(
                "The image could not be read."
            )

        faces = self.app.get(image)
        results = []

        for face in faces:
            embedding = np.asarray(
                face.normed_embedding,
                dtype=np.float32,
            )

            if embedding.shape != (512,):
                continue

            if not np.all(np.isfinite(embedding)):
                continue

            results.append(
                {
                    "embedding": embedding.tolist(),
                    "bbox": face.bbox.astype(float).tolist(),
                    "det_score": float(face.det_score),
                    "quality_score": float(face.det_score),
                }
            )

        return results
