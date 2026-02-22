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
  hasVideo?: boolean;
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scenes = existingAnimation?.scenes || [];
  const currentScene = scenes[currentSceneIndex];
  const isLovableGenerating = videoStatus === "generating_lovable";
  const isCompleted = videoStatus === "lovable_completed" && scenes.length > 0;

  // Does the current scene have a real video clip?
  const currentHasVideo = !!(currentScene?.hasVideo && currentScene?.videoUrl && !currentScene.videoUrl.endsWith('.png'));

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
      }, 3000);
      return () => clearInterval(poll);
    }
  }, [isLovableGenerating, projectId, onVideoGenerated]);

  // Auto-advance scenes when playing
  useEffect(() => {
    if (isPlaying && scenes.length > 0 && !currentHasVideo) {
      // For image-only fallback scenes, auto-advance after duration
      const sceneDuration = (currentScene?.duration || 5) * 1000;
      intervalRef.current = setInterval(() => {
        setCurrentSceneIndex((prev) => {
          if (prev < scenes.length - 1) return prev + 1;
          setIsPlaying(false);
          return 0;
        });
      }, sceneDuration);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, currentSceneIndex, scenes.length, currentHasVideo]);

  // Handle video element for real video clips
  useEffect(() => {
    if (videoRef.current && currentHasVideo && currentScene?.videoUrl) {
      videoRef.current.src = currentScene.videoUrl;
      videoRef.current.volume = isMuted ? 0 : volume;
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [currentSceneIndex, currentScene?.videoUrl, currentHasVideo, isPlaying, volume, isMuted]);

  // When video ends, advance to next scene
  const handleVideoEnded = useCallback(() => {
    if (currentSceneIndex < scenes.length - 1) {
      setCurrentSceneIndex(prev => prev + 1);
    } else {
      setIsPlaying(false);
      setCurrentSceneIndex(0);
    }
  }, [currentSceneIndex, scenes.length]);

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

    try {
      const { error } = await supabase.functions.invoke("generate-lovable-animation", {
        body: { projectId },
      });
      if (error) throw error;
      toast.success("Generating your animated story video with AI...");
    } catch (error: any) {
      console.error("Animation error:", error);
      toast.error(error.message || "Failed to start animation generation");
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    // Download the first video clip as a sample, or build combined download
    const videoScenes = scenes.filter(s => s.hasVideo && s.videoUrl);
    if (videoScenes.length === 0) {
      toast.error("No video clips available for download");
      return;
    }

    // Download the first video clip
    try {
      const response = await fetch(videoScenes[0].videoUrl!);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `story-animation-scene1-${Date.now()}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Video clip downloaded!");
    } catch (err) {
      toast.error("Failed to download video");
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

  const getTotalDuration = () => scenes.reduce((sum, s) => sum + (s.duration || 5), 0);

  const getCurrentOverallTime = () => {
    const prev = scenes.slice(0, currentSceneIndex).reduce((s, sc) => s + (sc.duration || 5), 0);
    return prev + currentTime;
  };

  const videoClipCount = scenes.filter(s => s.hasVideo).length;

  // ─── Generate Button ──────────────────────────────────────
  if (!isCompleted && !isLovableGenerating && !generating) {
    return (
      <Card className="shadow-[var(--shadow-medium)] border-2 border-pink-200/50 bg-gradient-to-br from-pink-50/50 to-purple-50/50 dark:from-pink-950/20 dark:to-purple-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="w-6 h-6 text-pink-500" />
            Generate 3D Animated Story Video
          </CardTitle>
          <CardDescription>
            Create a cinematic animated video with AI-generated motion, character movement, and narration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {[
              "AI-animated video clips",
              "Character movement & motion",
              "Synced voice narration",
              "Downloadable MP4",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>

          <div className="bg-pink-100/50 dark:bg-pink-950/30 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-pink-700 dark:text-pink-300">Animation Pipeline:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• AI generates scene illustrations (Pixar-quality)</li>
              <li>• Each scene animated as a 5-second video clip (Runway ML)</li>
              <li>• Characters move, gesture, and interact naturally</li>
              <li>• Voice narration synced to each scene (ElevenLabs)</li>
            </ul>
          </div>

          <div className="bg-amber-50/50 dark:bg-amber-950/30 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300">
            <p className="font-medium">⏱ Generation Time</p>
            <p className="text-muted-foreground text-xs mt-1">
              AI video generation takes 3–5 minutes. Each scene becomes a real animated clip.
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
      progress < 5
        ? { phase: "Starting…", icon: "🎬" }
        : progress < 30
        ? { phase: "Phase 1 — Painting scene illustrations", icon: "🎨" }
        : progress < 40
        ? { phase: "Phase 2 — Starting AI video generation", icon: "🎥" }
        : progress < 75
        ? { phase: "Phase 3 — Rendering animated video clips (Runway ML)", icon: "🎞️" }
        : progress < 90
        ? { phase: "Phase 4 — Recording voice narration", icon: "🎙️" }
        : { phase: "Phase 5 — Finalizing your video", icon: "✅" };

    return (
      <Card className="shadow-[var(--shadow-medium)] border-2 border-pink-200/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
            Creating Your Animated Video…
          </CardTitle>
          <CardDescription>Generating AI-animated video clips with character motion</CardDescription>
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
              AI video generation takes 3–5 minutes. Please keep this tab open.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p className="font-medium mb-2">Pipeline stages:</p>
            <ul className="space-y-1">
              <li className={progress >= 3 ? "text-green-600" : ""}>
                {progress >= 30 ? "✓" : progress >= 3 ? "⟳" : "○"} Generating scene illustrations
              </li>
              <li className={progress >= 32 ? "text-green-600" : ""}>
                {progress >= 40 ? "✓" : progress >= 32 ? "⟳" : "○"} Starting Runway AI video tasks
              </li>
              <li className={progress >= 40 ? "text-green-600" : ""}>
                {progress >= 75 ? "✓" : progress >= 40 ? "⟳" : "○"} Rendering animated video clips
              </li>
              <li className={progress >= 77 ? "text-green-600" : ""}>
                {progress >= 90 ? "✓" : progress >= 77 ? "⟳" : "○"} Recording voice narration
              </li>
              <li className={progress >= 92 ? "text-green-600" : ""}>
                {progress >= 100 ? "✓" : progress >= 92 ? "⟳" : "○"} Saving &amp; finalizing
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
                {videoClipCount} animated clips
              </Badge>
              <Badge variant="secondary" className="bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300">
                Scene {currentSceneIndex + 1} / {scenes.length}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Video / Image player */}
          <div className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-950 dark:to-purple-950">
            {currentScene && (
              <>
                {/* Render video element if scene has a video clip */}
                {currentHasVideo ? (
                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    onEnded={handleVideoEnded}
                    playsInline
                    muted={isMuted}
                  />
                ) : (
                  <img
                    src={currentScene.imageUrl}
                    alt={`Scene ${currentScene.sceneNumber}`}
                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
                  />
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent pointer-events-none" />

                {/* Scene label */}
                <div className="absolute top-3 left-3">
                  <Badge className="bg-pink-500/80 text-white backdrop-blur-sm text-xs">
                    {currentHasVideo ? "🎥" : "🖼️"} Scene {currentScene.sceneNumber}
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
                  {scene.hasVideo ? "🎥" : "🖼️"} {idx + 1}
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

              {/* Download button */}
              <Button
                variant="default"
                size="sm"
                onClick={handleDownload}
                disabled={videoClipCount === 0}
                className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
              >
                <Download className="h-4 w-4 mr-1" />
                Download MP4
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 pt-2 border-t border-border text-center text-sm">
            <div>
              <p className="text-muted-foreground">Duration</p>
              <p className="font-bold text-lg">{formatDuration(getTotalDuration())}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Scenes</p>
              <p className="font-bold text-lg">{scenes.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Video Clips</p>
              <p className="font-bold text-lg text-purple-600">{videoClipCount}</p>
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

          {/* Hidden audio for narration */}
          <audio ref={audioRef} className="hidden" />
        </CardContent>
      </Card>
    );
  }

  return null;
};
