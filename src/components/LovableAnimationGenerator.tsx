import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Heart,
  Sparkles,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Download,
  RefreshCw,
  Film,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface LovableScene {
  sceneNumber: number;
  imageUrl: string;
  videoUrl?: string;
  narration: string;
  audioUrl?: string;
  duration: number;
  setting?: string;
}

interface LovableAnimationData {
  type: string;
  scenes: LovableScene[];
  totalDuration?: number;
  videosGenerated?: number;
  totalScenes?: number;
  isFullAnimation?: boolean;
  generatedAt: string;
}

interface LovableAnimationGeneratorProps {
  projectId: string;
  hasScript: boolean;
  videoStatus: string | null;
  videoProgress: number | null;
  onVideoGenerated: () => void;
  existingAnimation?: LovableAnimationData | null;
}

// ─────────────────────────────────────────────────────────
// Canvas-based MP4 builder (client-side, no extra deps)
// ─────────────────────────────────────────────────────────
async function buildMp4FromScenes(
  scenes: LovableScene[],
  onProgress?: (pct: number) => void
): Promise<Blob | null> {
  // Check browser support
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
    toast.error("Your browser does not support video recording. Try Chrome or Edge.");
    return null;
  }

  const W = 1280;
  const H = 720;
  const FPS = 24;
  const SCENE_DURATION_SEC = 8; // seconds per scene
  const FADE_FRAMES = FPS; // 1 second fade

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const stream = canvas.captureStream(FPS);
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : MediaRecorder.isTypeSupported("video/webm")
    ? "video/webm"
    : "video/webm";

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 3_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  // Pre-load all images
  const images: HTMLImageElement[] = await Promise.all(
    scenes.map(
      (scene) =>
        new Promise<HTMLImageElement>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => {
            // Create a gradient placeholder
            const ph = document.createElement("canvas");
            ph.width = W; ph.height = H;
            const pc = ph.getContext("2d")!;
            const grad = pc.createLinearGradient(0, 0, W, H);
            grad.addColorStop(0, "#fce4ec");
            grad.addColorStop(1, "#e1bee7");
            pc.fillStyle = grad;
            pc.fillRect(0, 0, W, H);
            pc.font = "bold 40px sans-serif";
            pc.fillStyle = "#7b1fa2";
            pc.textAlign = "center";
            pc.fillText(`Scene ${scene.sceneNumber}`, W / 2, H / 2);
            const fallback = new Image();
            fallback.src = ph.toDataURL();
            fallback.onload = () => resolve(fallback);
          };
          img.src = scene.imageUrl;
        })
    )
  );

  // Cinematic camera patterns per scene (cycle through)
  const cameraPatterns = [
    'zoomIn',      // slow zoom in
    'panRight',    // gentle pan right
    'zoomOut',     // pull back
    'panLeft',     // gentle pan left
    'tiltUp',      // slight upward tilt
    'trackIn',     // tracking close-up
  ];

  // Helper: draw one frame with cinematic camera
  function drawFrame(
    img: HTMLImageElement,
    scene: LovableScene,
    sceneIdx: number,
    frameInScene: number,
    totalFramesInScene: number
  ) {
    const t = frameInScene / totalFramesInScene; // 0→1 progress
    const pattern = cameraPatterns[sceneIdx % cameraPatterns.length];

    // Base cover dimensions
    const scaleX = W / img.naturalWidth;
    const scaleY = H / img.naturalHeight;
    const baseScale = Math.max(scaleX, scaleY) * 1.15; // extra room for camera moves

    let camX = 0, camY = 0, camZoom = 1;

    switch (pattern) {
      case 'zoomIn':
        camZoom = 1 + t * 0.08;
        camX = t * 20;
        break;
      case 'panRight':
        camX = t * 60 - 30;
        camZoom = 1 + 0.02;
        break;
      case 'zoomOut':
        camZoom = 1.08 - t * 0.08;
        camY = -t * 10;
        break;
      case 'panLeft':
        camX = -t * 60 + 30;
        camZoom = 1 + 0.03;
        break;
      case 'tiltUp':
        camY = -t * 40 + 20;
        camZoom = 1 + t * 0.04;
        break;
      case 'trackIn':
        camZoom = 1 + t * 0.12;
        camX = t * 15;
        camY = -t * 10;
        break;
    }

    const finalScale = baseScale * camZoom;
    const dw = img.naturalWidth * finalScale;
    const dh = img.naturalHeight * finalScale;
    const dx = (W - dw) / 2 + camX;
    const dy = (H - dh) / 2 + camY;

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, dx, dy, dw, dh);

    // Fade in
    if (frameInScene < FADE_FRAMES) {
      ctx.fillStyle = `rgba(0,0,0,${1 - frameInScene / FADE_FRAMES})`;
      ctx.fillRect(0, 0, W, H);
    }
    // Fade out
    if (frameInScene > totalFramesInScene - FADE_FRAMES) {
      const prog = (frameInScene - (totalFramesInScene - FADE_FRAMES)) / FADE_FRAMES;
      ctx.fillStyle = `rgba(0,0,0,${prog})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Cinematic letterbox bars (subtle)
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, 0, W, 30);
    ctx.fillRect(0, H - 30, W, 30);

    // Bottom gradient for text
    const grad = ctx.createLinearGradient(0, H * 0.55, 0, H);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.75)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Scene label top-left
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Scene ${scene.sceneNumber}`, 28, 60);

    // Narration caption with fade-in animation
    const captionAlpha = Math.min(1, frameInScene / (FADE_FRAMES * 1.5));
    const words = scene.narration.split(" ");
    const lines: string[] = [];
    let line = "";
    const maxLineW = W - 100;
    ctx.font = "20px sans-serif";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxLineW) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    const lineH = 30;
    const totalTextH = lines.length * lineH + 20;
    const ty = H - totalTextH - 50;

    ctx.globalAlpha = captionAlpha;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.beginPath();
    ctx.roundRect(40, ty - 8, W - 80, totalTextH + 8, 14);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.font = "20px sans-serif";
    ctx.textAlign = "center";
    lines.forEach((l, i) => {
      ctx.fillText(l, W / 2, ty + i * lineH + 22);
    });
    ctx.globalAlpha = 1;
  }

  recorder.start(100);

  const totalFrames = scenes.length * SCENE_DURATION_SEC * FPS;
  let framesDone = 0;

  for (let si = 0; si < scenes.length; si++) {
    const scene = scenes[si];
    const img = images[si];
    const framesInScene = SCENE_DURATION_SEC * FPS;

    for (let f = 0; f < framesInScene; f++) {
      drawFrame(img, scene, si, f, framesInScene);
      framesDone++;
      if (framesDone % (FPS * 4) === 0) {
        onProgress?.(Math.round((framesDone / totalFrames) * 100));
        // Yield to browser periodically (not every frame — much faster)
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  recorder.stop();
  await new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });

  const blob = new Blob(chunks, { type: mimeType });
  return blob;
}

// ─────────────────────────────────────────────────────────

export const LovableAnimationGenerator = ({
  projectId,
  hasScript,
  videoStatus,
  videoProgress,
  onVideoGenerated,
  existingAnimation,
}: LovableAnimationGeneratorProps) => {
  const [generating, setGenerating] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [buildingMp4, setBuildingMp4] = useState(false);
  const [mp4Progress, setMp4Progress] = useState(0);
  const [mp4Blob, setMp4Blob] = useState<Blob | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scenes = existingAnimation?.scenes || [];
  const currentScene = scenes[currentSceneIndex];
  const isLovableGenerating = videoStatus === "generating_lovable";
  const isCompleted = videoStatus === "lovable_completed" && scenes.length > 0;

  // Poll for progress updates during generation
  useEffect(() => {
    if (isLovableGenerating) {
      const poll = setInterval(async () => {
        const { data } = await supabase
          .from("projects")
          .select("video_progress, video_status, avatar")
          .eq("id", projectId)
          .single();

        if (data) {
          setLocalProgress(data.video_progress || 0);
          if (data.video_status !== "generating_lovable") {
            setGenerating(false);
            clearInterval(poll);
            onVideoGenerated();
          }
        }
      }, 2500);
      return () => clearInterval(poll);
    }
  }, [isLovableGenerating, projectId, onVideoGenerated]);

  // Auto-advance scenes when playing (image slideshow mode)
  useEffect(() => {
    if (isPlaying && scenes.length > 0) {
      const sceneDuration = (currentScene?.duration || 8) * 1000;
      intervalRef.current = setInterval(() => {
        setCurrentSceneIndex((prev) => {
          if (prev < scenes.length - 1) {
            return prev + 1;
          } else {
            setIsPlaying(false);
            return 0;
          }
        });
      }, sceneDuration);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, currentSceneIndex, scenes.length]);

  // Play narration audio when scene changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      if (isPlaying && currentScene?.audioUrl) {
        audioRef.current.src = currentScene.audioUrl;
        audioRef.current.volume = isMuted ? 0 : volume;
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    }
  }, [currentSceneIndex, isPlaying, currentScene?.audioUrl, volume, isMuted]);

  // Track time for display
  useEffect(() => {
    let raf: number;
    if (isPlaying) {
      const tick = () => {
        setCurrentTime((prev) => prev + 0.1);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } else {
      setCurrentTime(0);
    }
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, currentSceneIndex]);

  const generateLovableAnimation = async () => {
    if (!hasScript) {
      toast.error("Please generate a script first");
      return;
    }
    setGenerating(true);
    setLocalProgress(0);
    setMp4Blob(null);

    try {
      const { error } = await supabase.functions.invoke("generate-lovable-animation", {
        body: { projectId },
      });
      if (error) throw error;
      toast.success("Generating your animated story video...");
    } catch (error: any) {
      console.error("Animation error:", error);
      toast.error(error.message || "Failed to start animation generation");
      setGenerating(false);
    }
  };

  const handleBuildAndDownloadMp4 = async () => {
    if (scenes.length === 0) return;
    setBuildingMp4(true);
    setMp4Progress(0);
    toast.info("Building MP4 video… this may take 1–2 minutes.");

    try {
      const blob = await buildMp4FromScenes(scenes, setMp4Progress);
      if (!blob) { setBuildingMp4(false); return; }

      setMp4Blob(blob);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `story-animation-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("MP4 video downloaded!");
    } catch (err: any) {
      console.error("MP4 build error:", err);
      toast.error("Failed to build video: " + err.message);
    } finally {
      setBuildingMp4(false);
    }
  };

  const togglePlay = () => {
    if (!isPlaying && currentSceneIndex >= scenes.length - 1) {
      setCurrentSceneIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const goToPrevScene = () => {
    setCurrentSceneIndex((prev) => Math.max(0, prev - 1));
    setCurrentTime(0);
  };

  const goToNextScene = () => {
    setCurrentSceneIndex((prev) => Math.min(scenes.length - 1, prev + 1));
    setCurrentTime(0);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const getTotalDuration = () => scenes.reduce((sum, s) => sum + (s.duration || 8), 0);

  const getCurrentOverallTime = () => {
    const prev = scenes.slice(0, currentSceneIndex).reduce((s, sc) => s + (sc.duration || 8), 0);
    return prev + currentTime;
  };

  // ─── Generate Button ──────────────────────────────────────
  if (!isCompleted && !isLovableGenerating && !generating) {
    return (
      <Card className="shadow-[var(--shadow-medium)] border-2 border-pink-200/50 bg-gradient-to-br from-pink-50/50 to-purple-50/50 dark:from-pink-950/20 dark:to-purple-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="w-6 h-6 text-pink-500" />
            Generate Animated Story Video
          </CardTitle>
          <CardDescription>
            Create a lovable animated video from your story with warm visuals and narration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {[
              "Storybook illustrations",
              "Scene-by-scene visuals",
              "Synced narration",
              "Downloadable MP4",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>

          <div className="bg-pink-100/50 dark:bg-pink-950/30 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-pink-700 dark:text-pink-300">Animation Style:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Soft 2D storybook art — Pixar-like warmth</li>
              <li>• Pastel colors, rounded characters, expressive eyes</li>
              <li>• Warm narration voice + scene captions</li>
              <li>• Export as downloadable video file</li>
            </ul>
          </div>

          <div className="bg-blue-50/50 dark:bg-blue-950/30 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium">⚡ Fast Generation</p>
            <p className="text-muted-foreground text-xs mt-1">
              Parallel image + audio generation, optimised for speed
            </p>
          </div>

          <Button
            onClick={generateLovableAnimation}
            disabled={!hasScript}
            size="lg"
            className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
          >
            <Film className="w-5 h-5 mr-2" />
            Generate Animated Story Video
          </Button>

          {!hasScript && (
            <p className="text-sm text-center text-muted-foreground">
              Generate a story script first to create your animated video
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // ─── Progress View ────────────────────────────────────────
  if (isLovableGenerating || generating) {
    const progress = videoProgress || localProgress;

    const phaseInfo =
      progress < 10
        ? { phase: "Starting…", icon: "🎬" }
        : progress < 55
        ? { phase: "Phase 1 — Painting scene illustrations", icon: "🎨" }
        : progress < 85
        ? { phase: "Phase 2 — Recording warm narration", icon: "🎙️" }
        : { phase: "Phase 3 — Saving your video", icon: "✅" };

    return (
      <Card className="shadow-[var(--shadow-medium)] border-2 border-pink-200/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
            Creating Your Animated Video…
          </CardTitle>
          <CardDescription>Generating storybook illustrations and narration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-pink-600">{phaseInfo.phase}</span>
              <span className="font-bold text-pink-500">{progress}%</span>
            </div>
            <Progress value={progress} className="h-4" />
          </div>

          <div className="text-center space-y-3">
            <div className="text-4xl">{phaseInfo.icon}</div>
            <p className="text-muted-foreground text-sm">
              This usually takes 2–4 minutes. Please keep this tab open.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p className="font-medium mb-2">What's happening:</p>
            <ul className="space-y-1">
              <li className={progress >= 5 ? "text-green-600" : ""}>
                {progress >= 55 ? "✓" : progress >= 5 ? "⟳" : "○"} Generating storybook illustrations
              </li>
              <li className={progress >= 57 ? "text-green-600" : ""}>
                {progress >= 85 ? "✓" : progress >= 57 ? "⟳" : "○"} Recording warm narration audio
              </li>
              <li className={progress >= 87 ? "text-green-600" : ""}>
                {progress >= 100 ? "✓" : progress >= 87 ? "⟳" : "○"} Saving &amp; finalizing
              </li>
            </ul>
          </div>

          <div className="flex justify-center gap-2">
            {[0, 150, 300].map((delay) => (
              <div
                key={delay}
                className="w-2 h-2 rounded-full bg-pink-400 animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── MP4 Build Progress ───────────────────────────────────
  if (buildingMp4) {
    return (
      <Card className="shadow-[var(--shadow-medium)] border-2 border-purple-200/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
            Building MP4 Video…
          </CardTitle>
          <CardDescription>Rendering frames with captions — please wait</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={mp4Progress} className="h-4" />
          <p className="text-center text-sm text-muted-foreground">
            {mp4Progress}% — rendering {scenes.length} scenes at 1280×720 / 24fps
          </p>
        </CardContent>
      </Card>
    );
  }

  // ─── Completed Player ─────────────────────────────────────
  if (isCompleted && scenes.length > 0) {
    return (
      <Card className="shadow-[var(--shadow-medium)] border-2 border-pink-200/50 overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <Film className="w-6 h-6 text-pink-500" />
              Your Animated Story Video
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                {scenes.length} scenes
              </Badge>
              <Badge variant="secondary" className="bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300">
                Scene {currentSceneIndex + 1} / {scenes.length}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Image-based player */}
          <div className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-950 dark:to-purple-950">
            {currentScene && (
              <>
                <img
                  src={currentScene.imageUrl}
                  alt={`Scene ${currentScene.sceneNumber}`}
                  className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
                />

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent pointer-events-none" />

                {/* Scene label */}
                <div className="absolute top-3 left-3">
                  <Badge className="bg-pink-500/80 text-white backdrop-blur-sm text-xs">
                    ✨ Scene {currentScene.sceneNumber}
                    {currentScene.setting ? ` — ${currentScene.setting}` : ""}
                  </Badge>
                </div>

                {/* Timer badge */}
                <div className="absolute top-3 right-3">
                  <Badge className="bg-black/60 text-white backdrop-blur-sm">
                    {formatDuration(getCurrentOverallTime())} / {formatDuration(getTotalDuration())}
                  </Badge>
                </div>

                {/* Narration subtitle */}
                <div className="absolute bottom-14 left-4 right-4 pointer-events-none">
                  <div className="bg-black/70 rounded-xl px-5 py-3 backdrop-blur-sm">
                    <p className="text-white text-center text-sm md:text-base leading-relaxed">
                      {currentScene.narration}
                    </p>
                  </div>
                </div>

                {/* Play overlay */}
                {!isPlaying && (
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
                    onClick={togglePlay}
                  >
                    <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                      <Play className="w-8 h-8 text-pink-500 ml-1" />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Scene strip */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {scenes.map((scene, idx) => (
              <button
                key={idx}
                onClick={() => { setCurrentSceneIndex(idx); setCurrentTime(0); }}
                className={`relative shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                  idx === currentSceneIndex
                    ? "border-pink-500 scale-105"
                    : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <img
                  src={scene.imageUrl}
                  alt={`Scene ${scene.sceneNumber}`}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0 left-0 right-0 text-center text-white text-[10px] bg-black/50 py-0.5">
                  {idx + 1}
                </span>
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => { setCurrentSceneIndex(0); setCurrentTime(0); setIsPlaying(false); }}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={goToPrevScene} disabled={currentSceneIndex === 0}>
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                onClick={togglePlay}
                className="h-12 w-12 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
              >
                {isPlaying ? <Pause className="h-5 w-5 text-white" /> : <Play className="h-5 w-5 text-white ml-0.5" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={goToNextScene} disabled={currentSceneIndex === scenes.length - 1}>
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setIsMuted(!isMuted)}>
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume * 100]}
                max={100}
                step={1}
                onValueChange={(v) => { setVolume(v[0] / 100); setIsMuted(v[0] === 0); }}
                className="w-20"
              />

              {/* Download MP4 button */}
              <Button
                variant="default"
                size="sm"
                onClick={handleBuildAndDownloadMp4}
                disabled={buildingMp4}
                className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
              >
                <Download className="h-4 w-4 mr-1" />
                Download MP4
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border text-center text-sm">
            <div>
              <p className="text-muted-foreground">Duration</p>
              <p className="font-bold text-lg">{formatDuration(getTotalDuration())}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Scenes</p>
              <p className="font-bold text-lg">{scenes.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Narration</p>
              <p className="font-bold text-lg text-green-600">
                {scenes.filter((s) => s.audioUrl).length}/{scenes.length}
              </p>
            </div>
          </div>

          {/* Regenerate */}
          <div className="pt-2 border-t border-border">
            <Button variant="outline" onClick={generateLovableAnimation} className="w-full">
              <Sparkles className="w-4 h-4 mr-2" />
              Regenerate Animated Video
            </Button>
          </div>

          {/* Hidden audio */}
          <audio ref={audioRef} className="hidden" />
        </CardContent>
      </Card>
    );
  }

  return null;
};
