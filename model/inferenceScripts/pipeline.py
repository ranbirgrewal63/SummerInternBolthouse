from ultralytics import YOLO
import time
import uuid
import os
import cv2
import numpy as np
import threading
from collections import deque
from backend.settings import PROJECT_ROOT, SNAPSHOT_DIR, ensure_runtime_dirs, storage_relative_path


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BYTETRACK_CFG = os.path.join(BASE_DIR, "..", "bytetrack.yaml")
DETECTION_MODEL_PATH = os.path.join(PROJECT_ROOT, "weights2", "best.pt")

LOG_COOLDOWN = 5
CARROT_LABEL = "carrot"
DETECTION_CONFIDENCE = 0.35
MASK_OVERLAY_ALPHA = 0.25
CARROT_COLOR = (34, 197, 94)
DEBRIS_COLOR = (68, 68, 239)
SNAPSHOT_DELAY_SECONDS = 1.50
TRACK_EXIT_GRACE_SECONDS = 0.2
MIN_TRACK_AGE_BEFORE_EXIT_LOG = 0.2
SNAPSHOT_AREA_REFRESH_RATIO = 1.1
SNAPSHOT_FRAME_REFRESH_SECONDS = 0.15
MIN_SNAPSHOT_BOX_AREA_RATIO = 0.015
CAPTURE_ZONE_X_MIN = 0.20
CAPTURE_ZONE_X_MAX = 0.80
CAPTURE_ZONE_Y_MIN = 0.15
CAPTURE_ZONE_Y_MAX = 0.85
MIN_CARROT_LOG_BOX_AREA_RATIO = 0.003
RECENT_LOG_MATCH_SECONDS = 1.5
RECENT_LOG_IOU_THRESHOLD = 0.5

ensure_runtime_dirs()


class ForeignMaterialTracker:
    def __init__(self):
        # NOTE: previously this class also loaded a separate segmentation
        # model (weight_seg/best.pt) just to detect carrots, and ran BOTH
        # models on every single frame. That model was an untested
        # placeholder trained on unrelated data, and running two models
        # per frame roughly doubled processing time -- a major source of
        # dashboard lag. The main detection model already knows both
        # "Carrot" and "foreign object", so we just use that one model
        # for everything now.
        self.model = YOLO(DETECTION_MODEL_PATH)
        self.reset_tracking_state()

    def reset_tracking_state(self):
        self.pending_snapshot_tracks = {}
        self.logged_track_keys = set()
        self.logged_carrot_track_keys = set()
        self.last_log_time = {}
        self.recently_logged_detections = []

    @staticmethod
    def _resolve_class_ids(names, include_labels=None, exclude_labels=None):
        include = {label.lower() for label in include_labels or set()}
        exclude = {label.lower() for label in exclude_labels or set()}
        class_ids = []
        name_items = names.items() if isinstance(names, dict) else enumerate(names)

        for class_id, label in name_items:
            label_name = str(label).lower()
            if include and label_name not in include:
                continue
            if exclude and label_name in exclude:
                continue
            class_ids.append(int(class_id))

        return class_ids or None

    def _save_snapshot(self, annotated_frame, event_id):
        path = os.path.join(SNAPSHOT_DIR, f"foreign_material_{event_id}.jpg")
        cv2.imwrite(path, annotated_frame)
        return storage_relative_path(path)

    @staticmethod
    def _clone_detection(det):
        cloned = {
            "label": det["label"],
            "trackId": det.get("trackId"),
            "confidence": det["confidence"],
            "boundingBox": dict(det["boundingBox"]),
        }
        if "mask" in det:
            cloned["mask"] = [list(point) for point in det.get("mask", [])]
        return cloned

    @staticmethod
    def _box_area(det):
        bbox = det["boundingBox"]
        return max(0.0, bbox["x2"] - bbox["x1"]) * max(0.0, bbox["y2"] - bbox["y1"])

    @staticmethod
    def _box_iou(det_a, det_b):
        bbox_a = det_a["boundingBox"]
        bbox_b = det_b["boundingBox"]
        x1 = max(bbox_a["x1"], bbox_b["x1"])
        y1 = max(bbox_a["y1"], bbox_b["y1"])
        x2 = min(bbox_a["x2"], bbox_b["x2"])
        y2 = min(bbox_a["y2"], bbox_b["y2"])

        intersection = max(0.0, x2 - x1) * max(0.0, y2 - y1)
        if intersection <= 0.0:
            return 0.0

        area_a = ForeignMaterialTracker._box_area(det_a)
        area_b = ForeignMaterialTracker._box_area(det_b)
        union = area_a + area_b - intersection
        if union <= 0.0:
            return 0.0

        return intersection / union

    @staticmethod
    def _track_key(det):
        track_id = det.get("trackId")
        if track_id is None:
            return None
        return (det["label"].lower(), int(track_id))

    def _prune_recently_logged_detections(self, now):
        self.recently_logged_detections = [
            recent
            for recent in self.recently_logged_detections
            if now - recent["logged_at"] <= RECENT_LOG_MATCH_SECONDS
        ]

    def _was_recently_logged(self, det, now):
        self._prune_recently_logged_detections(now)
        label = det["label"].lower()

        for recent in self.recently_logged_detections:
            logged_det = recent["detection"]
            if logged_det["label"].lower() != label:
                continue
            if self._box_iou(det, logged_det) >= RECENT_LOG_IOU_THRESHOLD:
                return True

        return False

    def _remember_logged_detection(self, det, now):
        self._prune_recently_logged_detections(now)
        self.recently_logged_detections.append(
            {
                "logged_at": now,
                "detection": self._clone_detection(det),
            }
        )

    @staticmethod
    def _snapshot_metrics(det, frame_shape):
        frame_height, frame_width = frame_shape[:2]
        if frame_height <= 0 or frame_width <= 0:
            return {
                "area": 0.0,
                "area_ratio": 0.0,
                "center_x_ratio": 0.0,
                "center_y_ratio": 0.0,
                "inside_capture_zone": False,
                "capture_score": 0.0,
            }

        bbox = det["boundingBox"]
        width = max(0.0, bbox["x2"] - bbox["x1"])
        height = max(0.0, bbox["y2"] - bbox["y1"])
        area = width * height
        area_ratio = area / float(frame_width * frame_height)
        center_x_ratio = ((bbox["x1"] + bbox["x2"]) / 2.0) / float(frame_width)
        center_y_ratio = ((bbox["y1"] + bbox["y2"]) / 2.0) / float(frame_height)
        inside_capture_zone = (
            CAPTURE_ZONE_X_MIN <= center_x_ratio <= CAPTURE_ZONE_X_MAX
            and CAPTURE_ZONE_Y_MIN <= center_y_ratio <= CAPTURE_ZONE_Y_MAX
            and area_ratio >= MIN_SNAPSHOT_BOX_AREA_RATIO
        )

        distance_x = abs(center_x_ratio - 0.5)
        distance_y = abs(center_y_ratio - 0.5)
        centeredness = max(0.0, 1.0 - (distance_x * 1.5 + distance_y))

        return {
            "area": area,
            "area_ratio": area_ratio,
            "center_x_ratio": center_x_ratio,
            "center_y_ratio": center_y_ratio,
            "inside_capture_zone": inside_capture_zone,
            "capture_score": area_ratio * centeredness,
        }

    def _deduplicate(self, detections, distance_thresh=100):
        kept = []
        for det in sorted(detections, key=lambda d: d["confidence"], reverse=True):
            label = det["label"]
            cx = (det["boundingBox"]["x1"] + det["boundingBox"]["x2"]) / 2
            cy = (det["boundingBox"]["y1"] + det["boundingBox"]["y2"]) / 2
            duplicate = any(
                k["label"] == label
                and abs(cx - (k["boundingBox"]["x1"] + k["boundingBox"]["x2"]) / 2) < distance_thresh
                and abs(cy - (k["boundingBox"]["y1"] + k["boundingBox"]["y2"]) / 2) < distance_thresh
                for k in kept
            )
            if not duplicate:
                kept.append(det)
        return kept

    def _annotate_frame(self, frame, detections, include_carrots=False):
        annotated = frame.copy()

        if include_carrots:
            mask_overlay = annotated.copy()
            drew_mask = False

            for det in detections:
                if det["label"].lower() != CARROT_LABEL:
                    continue

                mask_points = det.get("mask") or []
                if len(mask_points) < 3:
                    continue

                polygon = np.asarray(mask_points, dtype=np.int32)
                cv2.fillPoly(mask_overlay, [polygon], CARROT_COLOR)
                drew_mask = True

            if drew_mask:
                annotated = cv2.addWeighted(
                    mask_overlay,
                    MASK_OVERLAY_ALPHA,
                    annotated,
                    1.0 - MASK_OVERLAY_ALPHA,
                    0,
                )

        for det in detections:
            label = det["label"].lower()
            bbox = det["boundingBox"]
            x1 = int(round(bbox["x1"]))
            y1 = int(round(bbox["y1"]))
            x2 = int(round(bbox["x2"]))
            y2 = int(round(bbox["y2"]))

            if label == CARROT_LABEL:
                if not include_carrots:
                    continue
                mask_points = det.get("mask") or []
                if len(mask_points) >= 3:
                    polygon = np.asarray(mask_points, dtype=np.int32)
                    cv2.polylines(annotated, [polygon], True, CARROT_COLOR, 2)
                elif x2 > x1 and y2 > y1:
                    cv2.rectangle(annotated, (x1, y1), (x2, y2), CARROT_COLOR, 2)
                continue

            cv2.rectangle(annotated, (x1, y1), (x2, y2), DEBRIS_COLOR, 2)
            caption = f"{det['label']} {det['confidence']:.2f}"
            cv2.putText(
                annotated,
                caption,
                (x1, max(y1 - 10, 25)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                DEBRIS_COLOR,
                2,
                cv2.LINE_AA,
            )

        return annotated

    def _build_log_event(self, detection, snapshot_frame, snapshot_time, related_detections=None):
        event_id = str(uuid.uuid4())
        annotated_snapshot = self._annotate_frame(snapshot_frame, [detection], include_carrots=False)
        snapshot_path = self._save_snapshot(annotated_snapshot, event_id)
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(snapshot_time))
        payload_detections = [self._clone_detection(detection)]

        for related in related_detections or []:
            if related.get("label", "").lower() == detection["label"].lower() and related.get("trackId") == detection.get("trackId"):
                continue
            payload_detections.append(self._clone_detection(related))

        return {
            "eventId": event_id,
            "timestamp": timestamp,
            "cameraId": "test-camera-1",
            "snapshot": snapshot_path,
            "model": "best.pt",
            "detections": payload_detections,
            "shouldLog": True,
        }

    def _build_carrot_log_event(self, detection, event_time):
        event_id = str(uuid.uuid4())
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(event_time))
        return {
            "eventId": event_id,
            "timestamp": timestamp,
            "cameraId": "test-camera-1",
            "snapshot": "",
            "model": "best.pt",
            "detections": [self._clone_detection(detection)],
            "shouldLog": True,
        }

    @staticmethod
    def _cooldown_key(det):
        track_id = det.get("trackId")
        label = det["label"].lower()
        if track_id is not None:
            return f"{label}:{int(track_id)}"

        bbox = det["boundingBox"]
        center_x = int(round((bbox["x1"] + bbox["x2"]) / 2.0 / 25.0))
        center_y = int(round((bbox["y1"] + bbox["y2"]) / 2.0 / 25.0))
        return f"{label}:{center_x}:{center_y}"

    def _update_delayed_snapshot_candidates(self, frame, detections, now):
        current_track_keys = set()
        carrot_detections = [
            self._clone_detection(det)
            for det in detections
            if det["label"].lower() == CARROT_LABEL
        ]

        for det in detections:
            if det["label"].lower() == CARROT_LABEL:
                continue

            track_key = self._track_key(det)
            if track_key is None or track_key in self.logged_track_keys:
                continue
            if self._was_recently_logged(det, now):
                self.logged_track_keys.add(track_key)
                self.pending_snapshot_tracks.pop(track_key, None)
                continue

            current_track_keys.add(track_key)
            metrics = self._snapshot_metrics(det, frame.shape)
            area = metrics["area"]
            state = self.pending_snapshot_tracks.get(track_key)

            if state is None:
                self.pending_snapshot_tracks[track_key] = {
                    "label": det["label"],
                    "first_seen": now,
                    "last_seen": now,
                    "best_seen": now,
                    "best_area": area,
                    "last_frame_refresh": now,
                    "best_detection": self._clone_detection(det),
                    "best_frame": frame.copy(),
                    "best_capture_score": metrics["capture_score"],
                    "best_capture_detection": self._clone_detection(det) if metrics["inside_capture_zone"] else None,
                    "best_capture_frame": frame.copy() if metrics["inside_capture_zone"] else None,
                    "best_capture_seen": now if metrics["inside_capture_zone"] else None,
                    "best_capture_related_detections": [self._clone_detection(c) for c in carrot_detections] if metrics["inside_capture_zone"] else [],
                }
                continue

            state["last_seen"] = now
            improved = area > state["best_area"]
            refresh_due = now - state["last_frame_refresh"] >= SNAPSHOT_FRAME_REFRESH_SECONDS
            meaningful_gain = area >= state["best_area"] * SNAPSHOT_AREA_REFRESH_RATIO

            if improved and (meaningful_gain or refresh_due):
                state["best_area"] = area
                state["best_seen"] = now
                state["last_frame_refresh"] = now
                state["best_detection"] = self._clone_detection(det)
                state["best_frame"] = frame.copy()

            if metrics["inside_capture_zone"] and metrics["capture_score"] >= state["best_capture_score"]:
                state["best_capture_score"] = metrics["capture_score"]
                state["best_capture_detection"] = self._clone_detection(det)
                state["best_capture_frame"] = frame.copy()
                state["best_capture_seen"] = now
                state["best_capture_related_detections"] = [self._clone_detection(c) for c in carrot_detections]

        return current_track_keys

    def _collect_carrot_log_events(self, carrot_tracks, frame_shape, now):
        log_events = []
        for det in carrot_tracks:
            track_id = det.get("trackId")
            if track_id is None:
                continue

            track_key = int(track_id)
            if track_key in self.logged_carrot_track_keys:
                continue

            metrics = self._snapshot_metrics(det, frame_shape)
            if not metrics["inside_capture_zone"]:
                continue
            if metrics["area_ratio"] < MIN_CARROT_LOG_BOX_AREA_RATIO:
                continue

            self.logged_carrot_track_keys.add(track_key)
            log_events.append(self._build_carrot_log_event(det, now))

        return log_events

    def _finalize_delayed_snapshot_events(self, current_track_keys, now):
        ready_candidates = []
        stale_keys = []

        for track_key, state in list(self.pending_snapshot_tracks.items()):
            visible_for = now - state["first_seen"]
            missing_for = 0.0 if track_key in current_track_keys else now - state["last_seen"]
            ready_by_delay = visible_for >= SNAPSHOT_DELAY_SECONDS
            ready_on_exit = (
                missing_for >= TRACK_EXIT_GRACE_SECONDS
                and visible_for >= MIN_TRACK_AGE_BEFORE_EXIT_LOG
            )

            if ready_by_delay or ready_on_exit:
                ready_candidates.append((track_key, state))
                continue

            if missing_for >= TRACK_EXIT_GRACE_SECONDS and visible_for < MIN_TRACK_AGE_BEFORE_EXIT_LOG:
                stale_keys.append(track_key)

        for track_key in stale_keys:
            self.pending_snapshot_tracks.pop(track_key, None)

        ready_candidates.sort(key=lambda item: item[1]["best_area"], reverse=True)
        log_events = []

        for track_key, state in ready_candidates:
            self.pending_snapshot_tracks.pop(track_key, None)
            self.logged_track_keys.add(track_key)
            best_capture_detection = state.get("best_capture_detection")
            best_capture_frame = state.get("best_capture_frame")
            best_capture_seen = state.get("best_capture_seen")
            best_capture_related_detections = state.get("best_capture_related_detections", [])

            if best_capture_detection is None or best_capture_frame is None or best_capture_seen is None:
                continue
            if self._was_recently_logged(best_capture_detection, now):
                continue

            cooldown_key = self._cooldown_key(best_capture_detection)
            last_time = self.last_log_time.get(cooldown_key, 0)
            if now - last_time < LOG_COOLDOWN:
                continue

            self.last_log_time[cooldown_key] = now
            log_event = self._build_log_event(
                best_capture_detection,
                best_capture_frame,
                best_capture_seen,
                related_detections=best_capture_related_detections,
            )
            self._remember_logged_detection(best_capture_detection, now)
            log_events.append(log_event)

        return log_events

    def process_frame(self, frame, use_delayed_snapshot=False, include_carrots_overlay=False):
        # NOTE: single model call now, detecting BOTH Carrot and foreign
        # object in one pass -- no more classes= filter excluding carrot,
        # and no more separate segmentation model call. This is the fix
        # for both the dashboard lag (was running 2 models/frame) and for
        # carrot tracking (carrots now get real track IDs from ByteTrack,
        # instead of coming from the segmentation model with no track ID
        # at all, which meant carrot counting was silently broken before).
        results = self.model.track(
            frame,
            persist=True,
            tracker=BYTETRACK_CFG,
            verbose=False,
            iou=0.5,
            conf=DETECTION_CONFIDENCE,
        )

        now = time.time()
        detections = []
        tracked_carrots = []

        if results:
            result = results[0]
            if result.boxes is not None and result.boxes.id is not None:
                boxes = result.boxes.xyxy.cpu()
                ids = result.boxes.id.cpu()
                clss = result.boxes.cls.tolist()
                confs = result.boxes.conf.tolist()

                for box, obj_id, cls, conf in zip(boxes, ids.tolist(), clss, confs):
                    label = self.model.names[int(cls)]

                    x1, y1, x2, y2 = box.tolist()
                    tracked_detection = {
                        "label": label,
                        "trackId": int(obj_id),
                        "confidence": conf,
                        "boundingBox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                    }

                    if label.lower() == CARROT_LABEL:
                        tracked_carrots.append(tracked_detection)
                        continue

                    detections.append(
                        tracked_detection
                    )

                detections = self._deduplicate(detections)

        annotated_frame = self._annotate_frame(
            frame,
            detections + tracked_carrots,
            include_carrots=include_carrots_overlay,
        )
        log_events = []
        carrot_detections = [
            self._clone_detection(det)
            for det in detections
            if det["label"].lower() == CARROT_LABEL
        ]

        if use_delayed_snapshot:
            current_track_keys = self._update_delayed_snapshot_candidates(frame, detections, now)
            log_events = self._finalize_delayed_snapshot_events(current_track_keys, now)
        else:
            for det in detections:
                if det["label"].lower() == CARROT_LABEL:
                    continue

                cooldown_key = self._cooldown_key(det)
                last_time = self.last_log_time.get(cooldown_key, 0)
                if now - last_time < LOG_COOLDOWN:
                    continue

                self.last_log_time[cooldown_key] = now
                log_events.append(
                    self._build_log_event(
                        det,
                        frame,
                        now,
                        related_detections=carrot_detections,
                    )
                )

        log_events.extend(self._collect_carrot_log_events(tracked_carrots, frame.shape, now))

        frame_event_id = str(uuid.uuid4())
        snapshot_path = log_events[0]["snapshot"] if log_events else ""

        event = {
            "eventId": frame_event_id,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "cameraId": "test-camera-1",
            "snapshot": snapshot_path,
            "model": "best.pt",
            "detections": detections + tracked_carrots,
            "shouldLog": len(log_events) > 0,
        }

        if log_events:
            event["logEvents"] = log_events

        return event, annotated_frame


image_track = None
_live_camera_processor = None
_live_camera_processor_lock = threading.Lock()


def infer_image(
    image_path: str,
    use_delayed_snapshot: bool = False,
    reset_tracking_state: bool = False,
):
    global image_track
    if image_track is None:
        image_track = ForeignMaterialTracker()
    elif reset_tracking_state:
        image_track.reset_tracking_state()
    frame = cv2.imread(image_path)
    event, _ = image_track.process_frame(
        frame,
        use_delayed_snapshot=use_delayed_snapshot,
        include_carrots_overlay=False,
    )
    return event


class LiveCameraProcessor:
    def __init__(self, camera_index="http://192.168.1.48:8080/video", on_event=None):
        self.camera_index = camera_index
        self.on_event = on_event
        self.tracker = ForeignMaterialTracker()
        self.latest_frame = None
        self.frame_counter = 0
        self.running = False
        self.error_message = None
        self.lock = threading.Lock()
        self.condition = threading.Condition(self.lock)
        self.thread = None
        self.latest_stats = {
            "active_detections": 0,
            "foreign_objects_per_minute": 0.0,
            "stream_connected": False,
            "last_frame_timestamp": None,
            "foreign_object_detected": False,
        }
        self.foreign_event_timestamps = deque()

    def set_on_event(self, on_event) -> None:
        if on_event is None:
            return
        with self.lock:
            self.on_event = on_event

    def _open_capture(self):
        # If camera_index is a string (like an RTSP/HTTP URL), connect to
        # it directly -- CAP_DSHOW only applies to local Windows camera
        # indexes, not network streams, so skip it for those sources.
        if isinstance(self.camera_index, str):
            cap = cv2.VideoCapture(self.camera_index)
        else:
            cap = cv2.VideoCapture(self.camera_index, cv2.CAP_DSHOW)
            if not cap.isOpened():
                cap = cv2.VideoCapture(self.camera_index)
        if not cap.isOpened():
            raise RuntimeError("Could not open camera error in pipeline.py")
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        return cap

    def start(self) -> None:
        with self.lock:
            if self.running and self.thread is not None:
                return
            self.running = True
            self.error_message = None
            self.thread = threading.Thread(target=self._run, daemon=True)
            self.thread.start()

    def _run(self) -> None:
        cap = None
        frame_skip_counter = 0
        FRAME_SKIP = 2  # process every 2nd frame; raise to 3 if still laggy
        try:
            cap = self._open_capture()
            while True:
                with self.lock:
                    if not self.running:
                        break

                success, frame = cap.read()
                if not success:
                    time.sleep(0.05)
                    continue

                frame_skip_counter += 1
                if frame_skip_counter % FRAME_SKIP != 0:
                    continue  # keep reading to stay current, skip inference this frame

                # Downscale before inference -- 640px is plenty for detection
                h, w = frame.shape[:2]
                frame = cv2.resize(frame, (640, int(h * 640 / w)))

                event, annotated_frame = self.tracker.process_frame(
                    frame,
                    use_delayed_snapshot=True,
                    include_carrots_overlay=True,
                )

                foreign_event_count = len(
                    [
                        log_event
                        for log_event in (event.get("logEvents") or [])
                        if any(
                            str(det.get("label", "")).lower() != CARROT_LABEL
                            for det in log_event.get("detections", [])
                        )
                    ]
                )
                now = time.time()

                callback = None
                with self.lock:
                    callback = self.on_event
                    current_detections = event.get("detections", [])
                    self.latest_stats["active_detections"] = len(current_detections)
                    self.latest_stats["last_frame_timestamp"] = now
                    self.latest_stats["stream_connected"] = True
                    # True only while a foreign object is visible in THIS
                    # frame -- this is what the driver's red-screen alert
                    # polls to decide whether to flash the screen red.
                    self.latest_stats["foreign_object_detected"] = any(
                        str(det.get("label", "")).lower() != CARROT_LABEL
                        for det in current_detections
                    )
                    for _ in range(foreign_event_count):
                        self.foreign_event_timestamps.append(now)
                    while self.foreign_event_timestamps and now - self.foreign_event_timestamps[0] > 60.0:
                        self.foreign_event_timestamps.popleft()
                    self.latest_stats["foreign_objects_per_minute"] = float(len(self.foreign_event_timestamps))

                if callback is not None and event.get("shouldLog"):
                    callback(event)

                ok, buffer = cv2.imencode(".jpg", annotated_frame)
                if not ok:
                    continue

                frame_bytes = buffer.tobytes()
                with self.condition:
                    self.latest_frame = frame_bytes
                    self.frame_counter += 1
                    self.condition.notify_all()
        except Exception as exc:
            with self.condition:
                self.error_message = str(exc)
                self.running = False
                self.latest_stats["stream_connected"] = False
                self.condition.notify_all()
        finally:
            if cap is not None:
                cap.release()
    def get_stats(self):
        self.start()
        with self.lock:
            return dict(self.latest_stats)

    def stream(self):
        self.start()
        last_frame_counter = -1

        while True:
            with self.condition:
                if self.error_message and self.latest_frame is None:
                    raise RuntimeError(self.error_message)

                self.condition.wait_for(
                    lambda: self.frame_counter != last_frame_counter or self.error_message is not None,
                    timeout=5.0,
                )

                if self.error_message and self.latest_frame is None:
                    raise RuntimeError(self.error_message)

                frame_bytes = self.latest_frame
                last_frame_counter = self.frame_counter

            if frame_bytes is None:
                continue

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
            )


def _get_live_camera_processor(camera_index="http://192.168.1.48:8080/video", on_event=None):
    global _live_camera_processor
    with _live_camera_processor_lock:
        if _live_camera_processor is None:
            _live_camera_processor = LiveCameraProcessor(
                camera_index=camera_index,
                on_event=on_event,
            )
        else:
            _live_camera_processor.set_on_event(on_event)
        return _live_camera_processor


def continous_feed(camera_index="http://192.168.1.48:8080/video", on_event=None):
    processor = _get_live_camera_processor(camera_index=camera_index, on_event=on_event)
    yield from processor.stream()


def preview_feed(camera_index="http://192.168.1.48:8080/video"):
    processor = _get_live_camera_processor(camera_index=camera_index, on_event=None)
    yield from processor.stream()


def get_live_feed_stats(camera_index="http://192.168.1.48:8080/video", on_event=None):
    processor = _get_live_camera_processor(camera_index=camera_index, on_event=on_event)
    return processor.get_stats()