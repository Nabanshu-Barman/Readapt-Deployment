from fastapi import FastAPI, Request, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import pickle
import os
import tempfile
import json
import subprocess
import pytesseract
import io
import contextlib
import torch
from typing import List, Union, Any, Optional, Dict
from faster_whisper import WhisperModel

# Import backend helpers (existing)
from utils.gaze_adapt_backend import (
    get_gaze_time_series,
    compute_gaze_variability,
    warmup_gaze_runtime,
    get_runtime_device,
)

app = FastAPI(
    title="Readapt Backend",
    description="Prototype backend for Readapt (OCR, Dyslexia, ADHD Diagnose, ADHD Final Relay)",
    version="0.1.0",
)

_cors_origins_raw = os.getenv("CORS_ORIGINS", "*").strip()
if _cors_origins_raw == "*":
    CORS_ORIGINS = ["*"]
else:
    CORS_ORIGINS = [o.strip() for o in _cors_origins_raw.split(",") if o.strip()]

# CORS: open for prototype; tighten for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------
# Dyslexia Model Load
# ---------------------------
MODEL_PATH = os.path.join(os.path.dirname(__file__), "ml", "model.pkl")
with open(MODEL_PATH, "rb") as f:
    model = pickle.load(f)

# Legacy string mapping (kept for backward compatibility)
ANSWER_MAP = {"Low": 0, "Medium": 1, "High": 2}


def compute_features(answers: List[int], time_seconds: Union[int, float]) -> List[float]:
    """
    answers: list of 10 ints each in {0,1,2}
    time_seconds: total elapsed seconds for quiz
    Returns ordered feature list expected by the trained model:
        [Language_vocab, Memory, Speed, Visual_discrimination, Audio_Discrimination, Survey_Score]
    """
    a = answers

    Language_vocab = (a[0] + a[1] + a[2] + a[3] + a[4] + a[5] + a[7]) / 14
    Memory = (a[1] + a[8]) / 4
    Speed = 1.0 - min(1.0, max(0.0, (time_seconds - 15) / 45))
    Visual_discrimination = (a[0] + a[2] + a[3] + a[5]) / 8
    Audio_Discrimination = (a[6] + a[9]) / 4
    Survey_Score = sum(a) / 40

    features = [
        Language_vocab,
        Memory,
        Speed,
        Visual_discrimination,
        Audio_Discrimination,
        Survey_Score,
    ]

    # Console logging for transparency
    print("---- Dyslexia Feature Computation ----")
    print(f" Raw answers (0/1/2): {a}")
    print(f" time_seconds: {time_seconds}")
    print(f" Language_vocab:        {Language_vocab:.4f}")
    print(f" Memory:                {Memory:.4f}")
    print(f" Speed:                 {Speed:.4f}")
    print(f" Visual_discrimination: {Visual_discrimination:.4f}")
    print(f" Audio_Discrimination:  {Audio_Discrimination:.4f}")
    print(f" Survey_Score:          {Survey_Score:.4f}")
    print(f" Final feature vector:  {features}")
    print("--------------------------------------")
    return features


def _normalize_answers(raw: List[Any]) -> List[int]:
    """
    Accepts either:
      - numeric 0/1/2
      - strings "Low" | "Medium" | "High"
    Returns list of ints 0/1/2, length must be 10.
    Raises ValueError if invalid.
    """
    if len(raw) != 10:
        raise ValueError("10 answers required.")

    normalized: List[int] = []
    for idx, val in enumerate(raw):
        if isinstance(val, int):
            if val not in (0, 1, 2):
                raise ValueError(f"Answer at index {idx} invalid numeric value {val}; must be 0/1/2.")
            normalized.append(val)
        elif isinstance(val, str):
            mapped = ANSWER_MAP.get(val)
            if mapped is None:
                raise ValueError(f"Answer at index {idx} invalid string '{val}'; must be one of {list(ANSWER_MAP.keys())} or numeric 0/1/2.")
            normalized.append(mapped)
        else:
            raise ValueError(f"Answer at index {idx} has unsupported type {type(val).__name__}.")
    return normalized


@app.post("/api/predict-dyslexia")
async def predict_dyslexia(request: Request):
    """
    Expected JSON body:
      {
        "answers": [10 entries each 0/1/2 OR 'Low'/'Medium'/'High'],
        "time": <elapsed_seconds_number>
      }
    Returns:
      {
        "label": <int>,
        "features": [6 floats],
        "debug_log": "<multiline string identical to console printout>"
      }
    """
    try:
        data = await request.json()
    except Exception:
        return {"error": "Invalid JSON body."}

    answers_raw = data.get("answers", [])
    time_seconds = data.get("time", 30)

    print("=== /api/predict-dyslexia Incoming Payload ===")
    print(f" Raw answers payload: {answers_raw}")
    print(f" Reported time_seconds: {time_seconds}")
    print("==============================================")

    try:
        answers = _normalize_answers(answers_raw)
    except ValueError as ve:
        print(f" Answer normalization error: {ve}")
        return {"error": str(ve)}

    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            features = compute_features(answers, time_seconds)
            pred = model.predict([features])[0]
            print(f" Model prediction output: {pred}")
        debug_log = buf.getvalue()
        print(f" Model prediction output: {pred}")
        print("==============================================")
        return {
            "label": int(pred),
            "features": features,
            "debug_log": debug_log
        }
    except Exception as e:
        print(f" Prediction error: {e}")
        return {"error": f"Prediction failed: {e}"}


@app.post("/api/ocr")
async def ocr_image(image: UploadFile = File(...)):
    try:
        contents = await image.read()
        img = Image.open(io.BytesIO(contents))
        pytesseract.pytesseract.tesseract_cmd = os.getenv("TESSERACT_CMD", "tesseract")
        text = pytesseract.image_to_string(img, lang="eng")
        return {"text": text.strip()}
    except Exception as e:
        print(f"OCR error: {e}")
        return {"error": str(e)}


def convert_webm_to_mp4(webm_path: str) -> str:
    mp4_path = webm_path.replace(".webm", ".mp4")

    gpu_cmd = [
        "ffmpeg", "-y",
        "-hwaccel", "cuda",
        "-i", webm_path,
        "-c:v", "h264_nvenc",
        "-preset", "p4",
        "-cq", "23",
        "-pix_fmt", "yuv420p",
        mp4_path,
    ]
    cpu_cmd = [
        "ffmpeg", "-y",
        "-i", webm_path,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        mp4_path,
    ]

    print(f"Converting {webm_path} to {mp4_path} via ffmpeg (NVENC preferred)...")
    result = subprocess.run(gpu_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0:
        print("NVENC conversion failed, falling back to libx264.")
        print(result.stderr.decode())
        result = subprocess.run(cpu_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    print(result.stdout.decode())
    print(result.stderr.decode())
    return mp4_path


GAZE_MODEL_PATH = os.path.join(os.path.dirname(__file__), "weights", "resnet18.pt")
GAZE_ARCH = "resnet18"
GAZE_BINS = 90
GAZE_BINWIDTH = 4
GAZE_ANGLE_OFFSET = 180
GAZE_FRAME_STRIDE = int(os.getenv("GAZE_FRAME_STRIDE", "8"))

STT_MODEL_NAME = os.getenv("STT_MODEL_NAME", "small.en")
STT_BEAM_SIZE = int(os.getenv("STT_BEAM_SIZE", "1"))
STT_COMPUTE_TYPE = os.getenv("STT_COMPUTE_TYPE", "float16")
STT_DEFAULT_LANGUAGE = os.getenv("STT_DEFAULT_LANGUAGE", "en")
STT_VAD_FILTER = os.getenv("STT_VAD_FILTER", "0") == "1"
_STT_MODEL: Optional[WhisperModel] = None


def get_stt_model() -> WhisperModel:
    global _STT_MODEL
    if _STT_MODEL is None:
        _STT_MODEL = WhisperModel(
            STT_MODEL_NAME,
            device="cuda",
            compute_type=STT_COMPUTE_TYPE,
        )
        print(f"STT model initialized on CUDA: model={STT_MODEL_NAME}, compute_type={STT_COMPUTE_TYPE}")
    return _STT_MODEL


@app.on_event("startup")
def startup_warmup_gaze_runtime():
    try:
        warmup_gaze_runtime(GAZE_MODEL_PATH, GAZE_ARCH, GAZE_BINS)
        device = get_runtime_device(GAZE_MODEL_PATH, GAZE_ARCH, GAZE_BINS)
        print(f"Gaze runtime initialized on: {device}")
    except Exception as e:
        print(f"Gaze runtime warmup failed (will retry on first request): {e}")

    try:
        get_stt_model()
    except Exception as e:
        print(f"STT model warmup failed (will retry on first request): {e}")


@app.post("/api/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: Optional[str] = Form(None),
):
    """
    GPU speech-to-text for chat mic input.
    Expects multipart/form-data with an `audio` file from MediaRecorder.
    Returns recognized text without auto-sending to chat.
    """
    if not torch.cuda.is_available():
        return {
            "error": "CUDA GPU is not available in this backend environment.",
            "text": "",
        }

    temp_path = ""
    try:
        suffix = os.path.splitext(audio.filename or "")[1] or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tempf:
            tempf.write(await audio.read())
            tempf.flush()
            temp_path = tempf.name

        model = get_stt_model()
        segments, info = model.transcribe(
            temp_path,
            beam_size=STT_BEAM_SIZE,
            vad_filter=STT_VAD_FILTER,
            language=(language or STT_DEFAULT_LANGUAGE or None),
            condition_on_previous_text=False,
            without_timestamps=True,
            best_of=1,
            temperature=0.0,
        )
        text = " ".join(seg.text.strip() for seg in segments).strip()

        print(
            f"[STT] file={os.path.basename(temp_path)} "
            f"lang={info.language} prob={info.language_probability:.3f} chars={len(text)}"
        )
        return {
            "text": text,
            "language": info.language,
            "language_probability": info.language_probability,
        }
    except Exception as e:
        print(f"[STT] transcription error: {e}")
        return {"error": str(e), "text": ""}
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@app.post("/api/adhd-diagnose")
async def adhd_diagnose(
    answers: str = Form(...),
    video: UploadFile = File(...)
):
    # Parse answers
    try:
        answer_list = json.loads(answers)
        if not isinstance(answer_list, list) or len(answer_list) != 10:
            return {"error": "Answers must be a list of 10 numbers."}
        answer_list = [int(x) for x in answer_list]
    except Exception as e:
        return {"error": f"Invalid answers: {e}"}

    # Save temp video
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tempf:
        tempf.write(await video.read())
        tempf.flush()
        video_path = tempf.name
    print(f"Saved uploaded video to: {video_path}")

    # Convert to mp4
    mp4_path = convert_webm_to_mp4(video_path)
    if not os.path.exists(mp4_path):
        return {"error": "Video conversion failed. Try again with a longer recording."}

    # Gaze estimation parameters
    # Run gaze estimation (higher stride reduces latency while keeping stable signal)
    gaze_series = get_gaze_time_series(
        mp4_path,
        GAZE_MODEL_PATH,
        GAZE_ARCH,
        GAZE_BINS,
        GAZE_BINWIDTH,
        GAZE_ANGLE_OFFSET,
        frame_stride=GAZE_FRAME_STRIDE,
    )
    variability = compute_gaze_variability(gaze_series)

    ADHD_THRESHOLD = 0.229  # TODO: tune
    adhd_result = "ADHD" if variability > ADHD_THRESHOLD else "No ADHD"

    # ---- Structured console logging for gaze output ----
    try:
        print("\n================= ADHD Gaze Analysis =================")
        print(f" Video file (temp)          : {os.path.basename(video_path)}")
        print(f" Converted MP4              : {os.path.basename(mp4_path)}")
        print(f" Frames analyzed (stride=5) : {len(gaze_series)}")
        print(f" Variability (rad)          : {variability:.6f}")
        print(f" Threshold (rad)            : {ADHD_THRESHOLD:.6f}")
        print(f" Result                     : {adhd_result}")
        if len(gaze_series) > 0:
            sample = gaze_series[:3]
            print(" Sample (first up to 3 entries):")
            for i, g in enumerate(sample):
                print(f"   [{i}] {g}")
        print("======================================================\n")
    except Exception as log_err:
        print(f" Logging error (non-fatal): {log_err}")

    # Cleanup
    for p in (video_path, mp4_path):
        try:
            os.remove(p)
        except Exception:
            pass

    return {
        "adhd_gaze_variability": variability,
        "adhd_result": adhd_result,
        "num_gaze_frames": len(gaze_series),
    }


# =============================================================================
# ADHD Final (Preset Relay)
# =============================================================================

# In-memory store of the latest result (prototype scope; not multi-user safe)
_ADHD_FINAL_STORE: Dict[str, Optional[Dict[str, Any]]] = {"latest": None}


def _clamp_float(val: Any, lo: float, hi: float, fb: float) -> float:
    try:
        v = float(val)
        return max(lo, min(hi, v))
    except Exception:
        return fb


def _clamp_int(val: Any, lo: int, hi: int, fb: int) -> int:
    try:
        v = int(float(val))
        return max(lo, min(hi, v))
    except Exception:
        return fb


@app.post("/api/adhd/final")
async def adhd_final_post(request: Request):
    """
    Accepts a JSON payload from the Results page and stores it so the Adapt page
    (via the Next.js proxy) can GET it reliably.

    Expected JSON (fields optional but recommended):
      {
        "final_class": number 0..3,
        "mapped_preset": number 1..4,
        "quiz_class": number 0..3,
        "adhd_result": "ADHD" | "No ADHD",
        "gaze_variability": number,
        "gaze_points": number
      }
    Responds with the stored object.
    """
    try:
        data = await request.json()
    except Exception:
        return {"error": "Invalid JSON body."}

    final_class = _clamp_int(data.get("final_class", 0), 0, 3, 0)
    mapped_preset = _clamp_int(data.get("mapped_preset", 1), 1, 4, 1)
    quiz_class = _clamp_int(data.get("quiz_class", 0), 0, 3, 0)

    adhd_result = data.get("adhd_result")
    if adhd_result not in ("ADHD", "No ADHD", None):
        adhd_result = None

    gaze_variability_val = data.get("gaze_variability", None)
    gaze_variability = (
        _clamp_float(gaze_variability_val, -1e9, 1e9, 0.0)
        if gaze_variability_val is not None
        else None
    )

    gaze_points_val = data.get("gaze_points", None)
    gaze_points = (
        _clamp_int(gaze_points_val, 0, 10_000_000, 0)
        if gaze_points_val is not None
        else None
    )

    payload = {
        "final_class": final_class,
        "mapped_preset": mapped_preset,
        "quiz_class": quiz_class,
        "adhd_result": adhd_result,
        "gaze_variability": gaze_variability,
        "gaze_points": gaze_points,
    }

    _ADHD_FINAL_STORE["latest"] = payload
    print("\n[ADHD FINAL] Stored diagnosis:", payload)
    return payload


@app.get("/api/adhd/final")
async def adhd_final_get():
    """
    Returns the latest stored ADHD final record (or {} if none stored).
    The Next.js Adapt page uses this via the proxy to auto-apply the preset.
    """
    latest = _ADHD_FINAL_STORE.get("latest") or {}
    print("[ADHD FINAL] GET ->", latest)
    return latest
