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
  Loader2
} from "lucide-react";

interface LovableScene {
  sceneNumber: number;
  imageUrl: string;
  videoUrl?: string;
  narration: string;
  audioUrl?: string;
  duration: number;
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
  existingAnimation
}: LovableAnimationGeneratorProps) => {
  const [generating, setGenerating] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scenes = existingAnimation?.scenes || [];
  const currentScene = scenes[currentSceneIndex];
  const isLovableGenerating = videoStatus === 'generating_lovable';
  const isCompleted = videoStatus === 'lovable_completed' && scenes.length > 0;
  const hasRealVideos = scenes.some(s => s.videoUrl);

  // Poll for progress updates during generation
  useEffect(() => {
    if (isLovableGenerating) {
      const pollProgress = setInterval(async () => {
        const { data } = await supabase
          .from('projects')
          .select('video_progress, video_status, avatar')
          .eq('id', projectId)
          .single();
        
        if (data) {
          setLocalProgress(data.video_progress || 0);
          if (data.video_status !== 'generating_lovable') {
            setGenerating(false);
            onVideoGenerated();
          }
        }
      }, 2000);

      return () => clearInterval(pollProgress);
    }
  }, [isLovableGenerating, projectId, onVideoGenerated]);

  // Handle video end - move to next scene
  const handleVideoEnd = useCallback(() => {
    if (currentSceneIndex < scenes.length - 1) {
      setCurrentSceneIndex(prev => prev + 1);
      setIsVideoLoaded(false);
    } else {
      setIsPlaying(false);
      setCurrentSceneIndex(0);
    }
  }, [currentSceneIndex, scenes.length]);

  // Play/pause video when scene changes or play state changes
  useEffect(() => {
    if (videoRef.current && currentScene?.videoUrl) {
      videoRef.current.volume = isMuted ? 0 : volume;
      
      if (isPlaying && isVideoLoaded) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, isVideoLoaded, volume, isMuted]);

  // Sync audio with video
  useEffect(() => {
    if (audioRef.current && currentScene?.audioUrl && isPlaying) {
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, [currentSceneIndex, isPlaying, currentScene?.audioUrl, volume, isMuted]);

  // Update time display
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const handleTimeUpdate = () => {
        setCurrentTime(video.currentTime);
      };
      video.addEventListener('timeupdate', handleTimeUpdate);
      return () => video.removeEventListener('timeupdate', handleTimeUpdate);
    }
  }, [currentSceneIndex]);

  const generateLovableAnimation = async () => {
    if (!hasScript) {
      toast.error("Please generate a script first");
      return;
    }

    setGenerating(true);
    setLocalProgress(0);

    try {
      const { error } = await supabase.functions.invoke('generate-lovable-animation', {
        body: { projectId }
      });

      if (error) throw error;

      toast.success("Real animated video generation started! This may take several minutes...");
    } catch (error: any) {
      console.error('Animation error:', error);
      toast.error(error.message || "Failed to start animation generation");
      setGenerating(false);
    }
  };

  const togglePlay = () => {
    if (!isPlaying && currentSceneIndex >= scenes.length - 1) {
      setCurrentSceneIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const goToPrevScene = () => {
    setCurrentSceneIndex(prev => Math.max(0, prev - 1));
    setIsVideoLoaded(false);
  };

  const goToNextScene = () => {
    setCurrentSceneIndex(prev => Math.min(scenes.length - 1, prev + 1));
    setIsVideoLoaded(false);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTotalDuration = () => {
    return scenes.reduce((sum, s) => sum + (s.duration || 5), 0);
  };

  const getCurrentOverallTime = () => {
    const previousScenesDuration = scenes
      .slice(0, currentSceneIndex)
      .reduce((sum, s) => sum + (s.duration || 5), 0);
    return previousScenesDuration + currentTime;
  };

  const downloadVideo = () => {
    // Download all scene videos or the main video
    if (currentScene?.videoUrl) {
      const link = document.createElement('a');
      link.href = currentScene.videoUrl;
      link.download = `lovable-animation-scene-${currentSceneIndex + 1}.mp4`;
      link.click();
      toast.success("Downloading video...");
    }
  };

  const downloadAllVideos = async () => {
    toast.info("Downloading all scene videos...");
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      if (scene.videoUrl) {
        const link = document.createElement('a');
        link.href = scene.videoUrl;
        link.download = `lovable-animation-scene-${i + 1}.mp4`;
        link.click();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  // Show generate button if no animation exists
  if (!isCompleted && !isLovableGenerating && !generating) {
    return (
      <Card className="shadow-[var(--shadow-medium)] border-2 border-pink-200/50 bg-gradient-to-br from-pink-50/50 to-purple-50/50 dark:from-pink-950/20 dark:to-purple-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="w-6 h-6 text-pink-500" />
            Generate Animated Story Video
          </CardTitle>
          <CardDescription>
            Create a real, playable animated video from your story with warm, lovable visuals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Real MP4 videos</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Scene-by-scene animation</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Synced narration</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Downloadable output</span>
            </div>
          </div>

          <div className="bg-pink-100/50 dark:bg-pink-950/30 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-pink-700 dark:text-pink-300">Animation Style:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Soft 2D animation with Pixar-like warmth</li>
              <li>• Pastel colors, rounded characters, expressive eyes</li>
              <li>• Gentle movements, magical sparkles, smooth transitions</li>
              <li>• Child-friendly, emotionally comforting atmosphere</li>
            </ul>
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

  // Show progress during generation
  if (isLovableGenerating || generating) {
    const progress = videoProgress || localProgress;
    
    const getPhaseInfo = () => {
      if (progress < 30) return { phase: "Phase 1/4", desc: "✨ Painting lovable scene illustrations...", icon: "🎨" };
      if (progress < 70) return { phase: "Phase 2/4", desc: "🎬 Generating animated videos for each scene...", icon: "📹" };
      if (progress < 85) return { phase: "Phase 3/4", desc: "🎙️ Recording warm narration audio...", icon: "🔊" };
      return { phase: "Phase 4/4", desc: "📦 Uploading and finalizing your video...", icon: "✅" };
    };

    const phaseInfo = getPhaseInfo();

    return (
      <Card className="shadow-[var(--shadow-medium)] border-2 border-pink-200/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
            Creating Your Animated Video...
          </CardTitle>
          <CardDescription>
            Generating real animated MP4 video with scenes, movements, and narration
          </CardDescription>
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
            <p className="text-muted-foreground">
              {phaseInfo.desc}
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p className="font-medium mb-2">What's happening:</p>
            <ul className="space-y-1">
              <li className={progress >= 0 ? "text-green-600" : ""}>
                {progress >= 30 ? "✓" : "○"} Generating storybook-style images
              </li>
              <li className={progress >= 30 ? "text-green-600" : ""}>
                {progress >= 70 ? "✓" : progress >= 30 ? "○" : "○"} Creating animated video from each image
              </li>
              <li className={progress >= 70 ? "text-green-600" : ""}>
                {progress >= 85 ? "✓" : progress >= 70 ? "○" : "○"} Adding warm voice narration
              </li>
              <li className={progress >= 85 ? "text-green-600" : ""}>
                {progress >= 100 ? "✓" : progress >= 85 ? "○" : "○"} Finalizing playable video files
              </li>
            </ul>
          </div>

          <div className="flex justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show completed animation player with REAL video playback
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
                {existingAnimation?.videosGenerated || 0} videos generated
              </Badge>
              <Badge variant="secondary" className="bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300">
                Scene {currentSceneIndex + 1} of {scenes.length}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Video Player */}
          <div 
            ref={containerRef}
            className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-950 dark:to-purple-950"
          >
            {currentScene && (
              <>
                {/* Real Video or Image Fallback */}
                {currentScene.videoUrl ? (
                  <video
                    ref={videoRef}
                    src={currentScene.videoUrl}
                    className="absolute inset-0 w-full h-full object-cover"
                    onLoadedData={() => setIsVideoLoaded(true)}
                    onEnded={handleVideoEnd}
                    playsInline
                    muted={isMuted}
                  />
                ) : (
                  <img
                    src={currentScene.imageUrl}
                    alt={`Scene ${currentScene.sceneNumber}`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                
                {/* Narration Subtitle */}
                <div className="absolute bottom-16 left-4 right-4 pointer-events-none">
                  <div className="mx-auto max-w-2xl">
                    <div className="bg-black/70 rounded-xl px-5 py-4 backdrop-blur-sm">
                      <p className="text-white text-center text-sm md:text-base leading-relaxed">
                        {currentScene.narration}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Video/Scene indicator */}
                <div className="absolute top-4 right-4 flex gap-2">
                  {currentScene.videoUrl && (
                    <Badge className="bg-green-500/80 text-white backdrop-blur-sm">
                      <Film className="w-3 h-3 mr-1" />
                      Video
                    </Badge>
                  )}
                  <Badge className="bg-pink-500/80 text-white backdrop-blur-sm">
                    {formatDuration(getCurrentOverallTime())} / {formatDuration(getTotalDuration())}
                  </Badge>
                </div>

                {/* Play overlay when paused */}
                {!isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer" onClick={togglePlay}>
                    <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                      <Play className="w-8 h-8 text-pink-500 ml-1" />
                    </div>
                  </div>
                )}

                {/* Loading indicator for video */}
                {isPlaying && currentScene.videoUrl && !isVideoLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Scene Progress Slider */}
          <div className="space-y-2">
            <Slider
              value={[currentSceneIndex]}
              max={Math.max(0, scenes.length - 1)}
              step={1}
              onValueChange={(value) => {
                setCurrentSceneIndex(value[0]);
                setIsVideoLoaded(false);
              }}
              className="cursor-pointer"
            />
            <div className="flex justify-between">
              {scenes.map((scene, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentSceneIndex(idx);
                    setIsVideoLoaded(false);
                  }}
                  className={`flex flex-col items-center gap-1 transition-colors ${
                    idx === currentSceneIndex ? 'text-pink-500' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full transition-colors ${
                    idx === currentSceneIndex ? 'bg-pink-500' : scene.videoUrl ? 'bg-green-400' : 'bg-muted'
                  }`} />
                  {scenes.length <= 6 && (
                    <span className="text-xs">{idx + 1}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => {
                setCurrentSceneIndex(0);
                setIsVideoLoaded(false);
              }}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={goToPrevScene}
                disabled={currentSceneIndex === 0}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                onClick={togglePlay}
                className="h-12 w-12 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5 text-white" />
                ) : (
                  <Play className="h-5 w-5 text-white ml-0.5" />
                )}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={goToNextScene}
                disabled={currentSceneIndex === scenes.length - 1}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume * 100]}
                max={100}
                step={1}
                onValueChange={(value) => {
                  setVolume(value[0] / 100);
                  setIsMuted(value[0] === 0);
                }}
                className="w-20"
              />
              
              {hasRealVideos && (
                <Button variant="outline" size="sm" onClick={downloadVideo}>
                  <Download className="h-4 w-4 mr-1" />
                  Scene
                </Button>
              )}
              
              {hasRealVideos && scenes.filter(s => s.videoUrl).length > 1 && (
                <Button variant="outline" size="sm" onClick={downloadAllVideos}>
                  <Download className="h-4 w-4 mr-1" />
                  All
                </Button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border text-center text-sm">
            <div>
              <p className="text-muted-foreground">Total Duration</p>
              <p className="font-bold text-lg">{formatDuration(getTotalDuration())}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Scenes</p>
              <p className="font-bold text-lg">{scenes.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Videos</p>
              <p className="font-bold text-lg text-green-600">{existingAnimation?.videosGenerated || 0}</p>
            </div>
          </div>

          {/* Regenerate option */}
          <div className="pt-2 border-t border-border">
            <Button
              variant="outline"
              onClick={generateLovableAnimation}
              className="w-full"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Regenerate Animated Video
            </Button>
          </div>

          {/* Hidden audio element for narration */}
          <audio ref={audioRef} className="hidden" />
        </CardContent>
      </Card>
    );
  }

  return null;
};
