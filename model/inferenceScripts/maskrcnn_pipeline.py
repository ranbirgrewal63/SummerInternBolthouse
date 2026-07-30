import os
import threading
import cv2
import numpy as np
import torch
import torchvision
from PIL import Image
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor
from torchvision.models.detection.mask_rcnn import MaskRCNNPredictor
from torchvision.transforms import functional as F


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
WEIGHTS_PATH = os.path.join(
    PROJECT_ROOT, "model", "weights_maskrcnn", "best_model.pth"
)


#0 = background, 1 = carrot
NUM_CLASSES = 2
CARROT_LABEL_ID = 1

SCORE_THRESHOLD = 0.5   
MASK_THRESHOLD = 0.5    

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

def _build_model(num_classes: int = NUM_CLASSES):
    model = torchvision.models.detection.maskrcnn_resnet50_fpn(weights=None)

    in_features = model.roi_heads.box_predictor.cls_score.in_features
    model.roi_heads.box_predictor = FastRCNNPredictor(in_features, num_classes)

    in_features_mask = model.roi_heads.mask_predictor.conv5_mask.in_channels
    model.roi_heads.mask_predictor = MaskRCNNPredictor(
        in_features_mask, 256, num_classes
    )

    return model


_model_lock = threading.Lock()
_model = None


def _get_model():
    global _model
    if _model is not None:
        return _model

    with _model_lock:
        if _model is not None:
            return _model

        if not os.path.exists(WEIGHTS_PATH):
            raise FileNotFoundError(
                f"Mask R-CNN weights not found at {WEIGHTS_PATH}. "
                "Place best_model.pth there or update WEIGHTS_PATH."
            )

        m = _build_model(NUM_CLASSES)
        state = torch.load(WEIGHTS_PATH, map_location=DEVICE)
        m.load_state_dict(state)
        m.to(DEVICE)
        m.eval()
        _model = m

    return _model

def _mask_to_polygon(binary_mask: np.ndarray) -> list:
    
    contours, _ = cv2.findContours(
        binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    if not contours:
        return []

    largest = max(contours, key=cv2.contourArea)
    approx = cv2.approxPolyDP(largest, epsilon=3.0, closed=True)
    return approx.reshape(-1, 2).tolist()



def infer_carrots(
    image_path: str,
    score_threshold: float = SCORE_THRESHOLD,
    mask_threshold: float = MASK_THRESHOLD,
) -> list:
    
    model = _get_model()

    img = Image.open(image_path).convert("RGB")
    img_tensor = F.to_tensor(img).to(DEVICE)

    with torch.no_grad():
        outputs = model([img_tensor])

    if not outputs:
        return []

    out = outputs[0]
    boxes = out["boxes"].detach().cpu().numpy()
    labels = out["labels"].detach().cpu().numpy()
    scores = out["scores"].detach().cpu().numpy()
    masks = out["masks"].detach().cpu().numpy() 

    detections = []
    for i in range(len(boxes)):
        if int(labels[i]) != CARROT_LABEL_ID:
            continue
        if float(scores[i]) < score_threshold:
            continue

        x1, y1, x2, y2 = [float(v) for v in boxes[i].tolist()]
        binary_mask = (masks[i, 0] > mask_threshold).astype(np.uint8)
        polygon = _mask_to_polygon(binary_mask)

        detections.append(
            {
                "label": "carrot",
                "confidence": float(scores[i]),
                "boundingBox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                "mask": polygon,
            }
        )

    return detections

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python maskrcnn_pipeline.py <image_path>")
        sys.exit(1)

    path = sys.argv[1]
    dets = infer_carrots(path)
    print(f"Found {len(dets)} carrot(s) in {path}")
    for i, d in enumerate(dets):
        bb = d["boundingBox"]
        print(
            f"  [{i}] conf={d['confidence']:.3f} "
            f"bbox=({bb['x1']:.1f},{bb['y1']:.1f},{bb['x2']:.1f},{bb['y2']:.1f}) "
            f"mask_pts={len(d['mask'])}"
        )
