import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Video,
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Maximize2,
  Camera,
  Upload,
} from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { API_BASE_URL } from "../api/config";
import { getLiveFeedStats } from "../api/realtime";

const MAX_INFERENCE_DIMENSION = 960;
const MIN_INFERENCE_INTERVAL_MS = 120;

type Detection = {
  bbox?: number[];
  boundingBox?: { x1: number; y1: number; x2: number; y2: number };
  confidence?: number;
  label?: string;
  mask?: number[][];
  object_id?: string | number;
  object_type?: string;
};

function getCaptureDimensions(width: number, height: number) {
  const longestSide = Math.max(width, height);
  if (!longestSide || longestSide <= MAX_INFERENCE_DIMENSION) {
    return {
      width,
      height,
      scaleX: 1,
      scaleY: 1,
    };
  }

  const ratio = MAX_INFERENCE_DIMENSION / longestSide;
  const captureWidth = Math.max(1, Math.round(width * ratio));
  const captureHeight = Math.max(1, Math.round(height * ratio));

  return {
    width: captureWidth,
    height: captureHeight,
    scaleX: width / captureWidth,
    scaleY: height / captureHeight,
  };
}

function scaleDetection(det: Detection, scaleX: number, scaleY: number): Detection {
  const nextDetection: Detection = { ...det };

  if (det.boundingBox) {
    nextDetection.boundingBox = {
      x1: det.boundingBox.x1 * scaleX,
      y1: det.boundingBox.y1 * scaleY,
      x2: det.boundingBox.x2 * scaleX,
      y2: det.boundingBox.y2 * scaleY,
    };
  }

  if (det.bbox) {
    nextDetection.bbox = [
      det.bbox[0] * scaleX,
      det.bbox[1] * scaleY,
      det.bbox[2] * scaleX,
      det.bbox[3] * scaleY,
    ];
  }

  if (Array.isArray(det.mask)) {
    nextDetection.mask = det.mask.map((point) => [point[0] * scaleX, point[1] * scaleY]);
  }

  return nextDetection;
}

function isCarrotDetection(det: Detection) {
  const objectType = det.object_type || det.label || "unknown";
  return objectType.toLowerCase() === "carrot";
}

interface LiveCameraModalProps {
  systemEnabled: boolean;
}

type SourceMode = "idle" | "webcam" | "upload";

export function LiveCameraModal({ systemEnabled }: LiveCameraModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [detectionCount, setDetectionCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showCarrots, setShowCarrots] = useState(false);
  const [showDebris, setShowDebris] = useState(true);


  const [processingRate, setProcessingRate] = useState(0);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [sourceMode, setSourceMode] = useState<SourceMode>("idle");
  const [backendStreamKey, setBackendStreamKey] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedVideoUrlRef = useRef<string | null>(null);
  const foreignObjectsDetectedRef = useRef(0);
  const detectionWindowStartRef = useRef<number | null>(null);
  const isProcessingRef = useRef (false);
  const lastInferenceAtRef = useRef(0);
  const lastProcessedVideoTimeRef = useRef(-1);
  const shouldResetTrackingRef = useRef(true);

  const resetDetectionSession = () => {
    setDetections([]);
    setDetectionCount(0);
    setProcessingRate(0);
    setWsConnected(false);
    detectionWindowStartRef.current = null;
    foreignObjectsDetectedRef.current = 0;
    lastInferenceAtRef.current = 0;
    lastProcessedVideoTimeRef.current = -1;
    shouldResetTrackingRef.current = true;
    isProcessingRef.current = false;
  };

  const revokeUploadedVideoUrl = () => {
    if (uploadedVideoUrlRef.current) {
      URL.revokeObjectURL(uploadedVideoUrlRef.current);
      uploadedVideoUrlRef.current = null;
    }
  };

  const clearVideoElement = () => {
    const video = videoRef.current;
    if (!video) return;

    video.pause();
    video.srcObject = null;
    video.removeAttribute("src");
    video.load();
    video.playbackRate = 1;
  };

  const switchToUploadedVideo = async (file: File) => {
    revokeUploadedVideoUrl();
    clearVideoElement();
    resetDetectionSession();

    const objectUrl = URL.createObjectURL(file);
    uploadedVideoUrlRef.current = objectUrl;

    setIsWebcamActive(false);
    setVideoFile(file);
    setSourceMode("upload");
    setIsPlaying(true);
  };

  const switchToWebcam = () => {
    revokeUploadedVideoUrl();
    clearVideoElement();
    resetDetectionSession();
    setVideoFile(null);
    setIsWebcamActive(true);
    setSourceMode("webcam");
    setBackendStreamKey((prev) => prev + 1);
    setWsConnected(true);
    setIsPlaying(true);
  };

  useEffect(() => {
    if (!isOpen || sourceMode !== "upload" || !videoFile) {
      return;
    }

    const video = videoRef.current;
    const objectUrl = uploadedVideoUrlRef.current;
    if (!video || !objectUrl) {
      return;
    }

    video.src = objectUrl;
    video.load();

    if (!isPlaying) {
      return;
    }

    void video.play().catch(() => {
      setIsPlaying(false);
    });
  }, [isOpen, isPlaying, sourceMode, videoFile]);

  useEffect(() => {
    if (sourceMode !== "webcam" || !isPlaying) {
      return;
    }

    let cancelled = false;

    const loadStats = async () => {
      try {
        const stats = await getLiveFeedStats();
        if (cancelled) {
          return;
        }
        setDetectionCount(stats.active_detections);
        setProcessingRate(stats.foreign_objects_per_minute);
        setWsConnected(Boolean(stats.stream_connected));
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load live feed stats", error);
          setWsConnected(false);
        }
      }
    };

    void loadStats();
    const intervalId = window.setInterval(() => {
      void loadStats();
    }, 750);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [sourceMode, isPlaying]);

  // Close model if system turns off
  useEffect(() => {
    if (!systemEnabled){
      setIsOpen(false);
    }
  }, [systemEnabled]);

  // HTTP Polling setup
  useEffect(() => {
    const shouldUseUpload = sourceMode === "upload" && isPlaying;
    if (!systemEnabled || !shouldUseUpload) return;

    let cancelled = false;

    const sendFrame = async () => {
      const video = videoRef.current;
      const now = performance.now();

      if (cancelled || !video || video.paused || video.ended || video.readyState < 2 
        || video.videoHeight === 0 || video.videoWidth === 0 || isProcessingRef.current){
          if (!cancelled && video && !video.paused && !video.ended){
            requestAnimationFrame (() => {
              void sendFrame();
            });
          }
          return;
     }

      if (
        now - lastInferenceAtRef.current < MIN_INFERENCE_INTERVAL_MS ||
        Math.abs(video.currentTime - lastProcessedVideoTimeRef.current) < 0.001
      ) {
        requestAnimationFrame (() => {
          void sendFrame();
        });
        return;
      }

     isProcessingRef.current = true;
     lastInferenceAtRef.current = now;
     lastProcessedVideoTimeRef.current = video.currentTime;

    
    try {
      const canvas = document.createElement('canvas');
      const sourceWidth = video.videoWidth;
      const sourceHeight = video.videoHeight;
      const capture = getCaptureDimensions(sourceWidth, sourceHeight);
      canvas.width = capture.width;
      canvas.height = capture.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      ctx.drawImage(video, 0, 0, capture.width, capture.height);

      const blob = await new Promise<Blob | null >((resolve) => {
        canvas.toBlob (resolve, "image/jpeg", 0.65);
      });

      if (!blob) return;

      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');

      const params = new URLSearchParams({ capture_mode: "tracking" });
      if (shouldResetTrackingRef.current) {
        params.set("reset_tracking", "true");
      }

      const response = await fetch(`${API_BASE_URL}/run-inference?${params.toString()}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok){
        console.error("HTTP error", response.status);
        setWsConnected(false);
        return;
      }

      const data = await response.json();
      shouldResetTrackingRef.current = false;

      if (data.error) {
        console.error("Inference error", data.error);
        setWsConnected(false);
        return;
      }

      setWsConnected (true);

      if (data.event?.detections) {
        const scaledDetections = data.event.detections.map((det: Detection) =>
          scaleDetection(det, capture.scaleX, capture.scaleY)
        );
        setDetections(scaledDetections);
        setDetectionCount(scaledDetections.length);
        if (detectionWindowStartRef.current === null) {
          detectionWindowStartRef.current = Date.now();
          foreignObjectsDetectedRef.current = 0;
        }

        const newForeignObjectEvents = ((data.event?.logEvents as Array<{ detections?: Detection[] }> | undefined) ?? [])
          .filter((logEvent) =>
            (logEvent.detections ?? []).some((det) => !isCarrotDetection(det))
          ).length;
        foreignObjectsDetectedRef.current += newForeignObjectEvents;

        const elapsedSeconds = (Date.now() - detectionWindowStartRef.current) / 1000;

        if (elapsedSeconds > 0) {
          const foreignObjectsPerMinute =
            (foreignObjectsDetectedRef.current / elapsedSeconds) * 60;
          setProcessingRate(foreignObjectsPerMinute);
        }
      }
    } catch (err){
      console.error("Fetch error", err);
      setWsConnected(false);
    } finally {
      isProcessingRef.current = false;

      if (!cancelled){
        requestAnimationFrame(() => {
          void sendFrame();
        });
      }
    }
  };

  void sendFrame();

  return () => {
    cancelled = true;
    isProcessingRef.current = false;
  };
}, [isPlaying, videoFile, isOpen, sourceMode, systemEnabled]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void switchToUploadedVideo(file);
    }
    event.target.value = "";
  };

  const togglePlay = () => {
    if (sourceMode === "webcam") {
      setIsPlaying((prev) => {
        const next = !prev;
        if (next) {
          setBackendStreamKey((current) => current + 1);
        }
        setWsConnected(next);
        return next;
      });
      return;
    }


    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Stop webcam/video when closing modal
  useEffect(() => {
    if (!isOpen) {
      revokeUploadedVideoUrl();
      clearVideoElement();
      setVideoFile(null);
      setSourceMode("idle");
      setIsPlaying(false);
      setIsWebcamActive(false);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          className={`flex items-center gap-2 ${systemEnabled
            ? "bg-blue-600 hover:bg-blue-700 text-white"
            : "bg-gray-400 cursor-not-allowed"
            }`}
          disabled={!systemEnabled}
        >
          <Video className="h-4 w-4" />
          {systemEnabled ? "View Live Camera" : "Camera Disabled"}
        </Button>
      </DialogTrigger>

      <DialogContent
        className="!max-w-[90vw] !w-full !h-[100vh] bg-background p-10 overflow-y-auto flex flex-col"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Live Camera Feed – Conveyor Belt Monitor
          </DialogTitle>
          <DialogDescription>
            Real-time camera feed from the carrot processing conveyor belt
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">

          {/* Video Feed */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video shadow-lg">
            {sourceMode === "webcam" && isPlaying ? (
              <img
                key={backendStreamKey}
                src={`${API_BASE_URL}/video-feed-preview?stream=${backendStreamKey}`}
                alt="Live camera feed"
                className="w-full h-full object-contain"
                onLoad={() => setWsConnected(true)}
                onError={() => setWsConnected(false)}
              />
            ) : (
              <video
              key={videoFile ? `${videoFile.name}-${videoFile.lastModified}` : "uploaded-video"}
              ref={videoRef}
              id="liveCameraFeed"
              playsInline
              muted={isMuted}
              className="w-full h-full object-contain"
              onEnded={() => setIsPlaying(false)}
            />
            )}



            {/* Recording indicator */}
            {isRecording && (
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-white text-sm font-medium">REC</span>
              </div>
            )}

            {/* WS Status indicator */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-white text-sm font-medium">{wsConnected ? 'Stream Connected' : 'Stream Disconnected'}</span>
            </div>


            {/* Detection visual overlay */}
            {sourceMode === "upload" && videoRef.current && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox={`0 0 ${videoRef.current.videoWidth || 1920} ${videoRef.current.videoHeight || 1080}`}
                preserveAspectRatio="xMidYMid meet"
              >
                {detections.map((det, idx) => {
                  const bbox = det.bbox
                    ? det.bbox
                    : det.boundingBox
                      ? [det.boundingBox.x1, det.boundingBox.y1, det.boundingBox.x2, det.boundingBox.y2]
                      : [0, 0, 0, 0];

                  const [x1, y1, x2, y2] = bbox;
                  const width = x2 - x1;
                  const height = y2 - y1;

                  const objectType = det.object_type || det.label || "unknown";
                  const isCarrot = isCarrotDetection(det);

                  if (isCarrot && !showCarrots) return null;
                  if (!isCarrot && !showDebris) return null;

                  const color = isCarrot ? "#22c55e" : "#ef4444";
                  const hasMask = Array.isArray(det.mask) && det.mask.length > 0;
                  const maskPoints: number[][] = hasMask ? det.mask ?? [] : [];
                  const hasBox = width > 0 && height > 0 && !hasMask;
                  const showLabel = !isCarrot;

                  return (
                    <g key={det.object_id || idx}>
                      {hasMask && (
                        <polygon
                          points={maskPoints.map((p: number[]) => p.join(",")).join(" ")}
                          fill={color}
                          fillOpacity="0.4"
                          stroke={color}
                          strokeWidth="2"
                        />
                      )}
                      {hasBox && (
                        <rect
                          x={x1}
                          y={y1}
                          width={width}
                          height={height}
                          fill="none"
                          stroke={color}
                          strokeWidth="4"
                        />
                      )}
                      {showLabel && (
                        <text
                          x={x1}
                          y={y1 - 10}
                          fill={color}
                          fontSize="24"
                          fontWeight="bold"
                        >
                          {objectType}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            )}
            {detectionCount > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-red-500 text-white text-lg animate-pulse">
                    {detectionCount} OBJECT{detectionCount === 1 ? "" : "S"} DETECTED
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {/* Camera Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="video/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload Video
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  switchToWebcam();
                }}
                className="flex items-center gap-2"
              >
                <Camera className="h-4 w-4" />
                Use Webcam
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={togglePlay}
                disabled={!videoFile && !isWebcamActive}
                className="flex items-center gap-2"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isPlaying ? "Pause" : "Play"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRecording(!isRecording)}
                className="flex items-center gap-2"
              >
                <Square className="h-4 w-4" />
                {isRecording ? "Stop Recording" : "Start Recording"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMuted(!isMuted)}
                className="flex items-center gap-2"
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                {isMuted ? "Unmute" : "Mute"}
              </Button>

              <Button variant="outline" size="sm">
                <Maximize2 className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDebug(!showDebug)}
                className={showDebug ? "bg-accent" : ""}
              >
                <code className="text-xs">DBG</code>
              </Button>
            </div>

            <div className="flex items-center gap-3">


              <Card className="p-2">
                <div className="text-sm">
                  <span className="font-medium">Camera Status:</span>
                  <Badge className={`ml-1 ${sourceMode !== "idle" && isPlaying ? 'bg-green-500' : 'bg-yellow-500'} text-white`}>
                    {sourceMode !== "idle" && isPlaying ? 'Ready' : 'No Source'}
                  </Badge>
                </div>
              </Card>
            </div>
          </div>

          {/* Display Options */}
          <div className="flex items-center gap-6 p-4 bg-muted/50 rounded-lg border border-border">
            <span className="text-sm font-medium">Display Options:</span>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showCarrots"
                checked={showCarrots}
                onCheckedChange={(checked) => setShowCarrots(checked as boolean)}
              />
              <Label htmlFor="showCarrots" className="text-sm cursor-pointer">Show Carrots</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showDebris"
                checked={showDebris}
                onCheckedChange={(checked) => setShowDebris(checked as boolean)}
              />
              <Label htmlFor="showDebris" className="text-sm cursor-pointer">Show Debris</Label>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Live Detections</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">{detectionCount}</div>
                <p className="text-xs text-muted-foreground">Active objects</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Foreign Objects Detected / Min</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">~{Math.round(processingRate)}/min</div>
                <p className="text-xs text-muted-foreground">Logged foreign-material detections</p>
              </CardContent>
            </Card>
          </div>

          {/* Debug Panel */}
          {showDebug && (
            <Card className="mt-4 bg-muted text-muted-foreground border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono">Debug Console</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs font-mono space-y-1">
                  <div>Status: <span className={wsConnected ? "text-green-400" : "text-red-400"}>{wsConnected ? "Connected" : "Disconnected"}</span></div>
                  <div>Protocol: HTTP Polling (POST)</div>
                  <div>Detections: {detectionCount}</div>
                  <div>Last Error: {wsRef.current?.readyState === WebSocket.CLOSED ? "Connection Closed" : "None"}</div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
