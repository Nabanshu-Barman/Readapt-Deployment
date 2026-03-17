import cv2
import torch
import numpy as np
from torchvision import transforms
from utils.helpers import get_model
import uniface
from typing import Any, Dict, Optional
import threading


_RUNTIME_LOCK = threading.Lock()
_RUNTIME: Optional[Dict[str, Any]] = None


def _extract_face_bboxes(detections):
    """
    Normalize RetinaFace/uniface outputs into a list of [x_min, y_min, x_max, y_max].

    Different versions of uniface may return:
      - (bboxes, keypoints)
      - a single Face object
      - a list/tuple of Face objects
      - numpy arrays
    """
    bboxes = []

    def _append_box(box_like):
        try:
            arr = np.asarray(box_like, dtype=np.float32).reshape(-1)
        except Exception:
            return
        if arr.shape[0] >= 4:
            bboxes.append(arr[:4])

    def _visit(obj):
        if obj is None:
            return

        # Face-like objects (common in newer uniface)
        for attr in ("bbox", "box", "xyxy"):
            if hasattr(obj, attr):
                _append_box(getattr(obj, attr))
                return

        # Numpy outputs: [N, >=4] or [>=4]
        if isinstance(obj, np.ndarray):
            if obj.ndim == 2 and obj.shape[1] >= 4:
                for row in obj:
                    _append_box(row)
                return
            if obj.ndim == 1 and obj.shape[0] >= 4:
                _append_box(obj)
                return

        # Iterable outputs: recurse for nested structures
        if isinstance(obj, (list, tuple)):
            if len(obj) == 0:
                return
            first = obj[0]
            # Flat numeric bbox list/tuple
            if isinstance(first, (int, float, np.integer, np.floating)) and len(obj) >= 4:
                _append_box(obj)
                return
            for item in obj:
                _visit(item)
            return

    _visit(detections)
    return bboxes


def _build_runtime(model_path, arch, bins):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if device.type == "cuda":
        torch.backends.cudnn.benchmark = True
        torch.set_float32_matmul_precision("high")

    idx_tensor = torch.arange(bins, device=device, dtype=torch.float32)
    face_detector = uniface.RetinaFace()

    gaze_detector = get_model(arch, bins, inference_mode=True)
    state_dict = torch.load(model_path, map_location=device)
    gaze_detector.load_state_dict(state_dict)
    gaze_detector.to(device)
    gaze_detector.eval()

    return {
        "device": device,
        "idx_tensor": idx_tensor,
        "face_detector": face_detector,
        "gaze_detector": gaze_detector,
    }


def _get_runtime(model_path, arch, bins):
    global _RUNTIME

    if _RUNTIME is not None:
        return _RUNTIME

    with _RUNTIME_LOCK:
        if _RUNTIME is None:
            _RUNTIME = _build_runtime(model_path, arch, bins)

    return _RUNTIME


def warmup_gaze_runtime(model_path, arch, bins):
    _get_runtime(model_path, arch, bins)


def get_runtime_device(model_path, arch, bins):
    runtime = _get_runtime(model_path, arch, bins)
    return runtime["device"].type

def get_gaze_time_series(
    video_path,
    model_path,
    arch,
    bins,
    binwidth,
    angle_offset,
    frame_stride=5,  # Only analyze every 5th frame for speed
    min_face_size=40 # Ignore tiny face detections
):
    runtime = _get_runtime(model_path, arch, bins)
    device = runtime["device"]
    idx_tensor = runtime["idx_tensor"]
    face_detector = runtime["face_detector"]
    gaze_detector = runtime["gaze_detector"]

    cap = cv2.VideoCapture(video_path)
    gaze_series = []

    preprocess = transforms.Compose([
        transforms.ToPILImage(),
        transforms.Resize(224),  # 224 is faster and enough for most faces
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    frame_idx = 0
    try:
        with torch.inference_mode():
            while True:
                success, frame = cap.read()
                if not success:
                    break
                frame_idx += 1
                if frame_idx % frame_stride != 0:
                    continue  # Skip frames for speed

                try:
                    detections = face_detector.detect(frame)
                except Exception:
                    continue

                bboxes = _extract_face_bboxes(detections)
                if not bboxes:
                    continue  # No face, skip
                # Pick the largest face if multiple detected
                bbox = max(bboxes, key=lambda b: (b[2]-b[0])*(b[3]-b[1]))
                x_min, y_min, x_max, y_max = map(int, bbox[:4])
                if (x_max-x_min) < min_face_size or (y_max-y_min) < min_face_size:
                    continue  # Face too small, likely a false positive
                face_img = frame[y_min:y_max, x_min:x_max]
                if face_img.size == 0:
                    continue
                try:
                    image = preprocess(face_img).unsqueeze(0).to(device, non_blocking=(device.type == "cuda"))
                    if device.type == "cuda":
                        with torch.autocast(device_type="cuda", dtype=torch.float16):
                            pitch, yaw = gaze_detector(image)
                    else:
                        pitch, yaw = gaze_detector(image)

                    pitch_prob = torch.softmax(pitch, dim=1)
                    yaw_prob = torch.softmax(yaw, dim=1)
                    pitch_deg = torch.sum(pitch_prob * idx_tensor, dim=1) * binwidth - angle_offset
                    yaw_deg = torch.sum(yaw_prob * idx_tensor, dim=1) * binwidth - angle_offset
                    gaze_series.append((
                        float(np.radians(pitch_deg.item())),
                        float(np.radians(yaw_deg.item())),
                    ))
                except Exception:
                    continue
    finally:
        cap.release()

    return gaze_series

def compute_gaze_variability(gaze_series):
    if len(gaze_series) < 2:
        return 0.0
    # Use standard deviation of gaze vectors for more robust measurement
    arr = np.array(gaze_series)
    diffs = np.linalg.norm(np.diff(arr, axis=0), axis=1)
    return float(np.mean(diffs))