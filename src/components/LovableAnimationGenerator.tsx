import { useState, useEffect, useRef } from "react";
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
  Maximize2,
  Film
} from "lucide-react";

interface LovableScene {
  sceneNumber: number;
  imageUrl: string;
  narration: string;
  audioUrl?: string;
}

interface LovableAnimationData {
  type: string;
  scenes: LovableScene[];
  videoUrl?: string;
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
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<number | null>(null);

  const scenes = existingAnimation?.scenes || [];
  const currentScene = scenes[currentSceneIndex];
  const isLovableGenerating = videoStatus === 'generating_lovable';
  const isCompleted = videoStatus === 'lovable_completed' && scenes.length > 0;

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

  // Auto-advance scenes during playback
  useEffect(() => {
    if (isPlaying && scenes.length > 0) {
      intervalRef.current = window.setInterval(() => {
        setCurrentSceneIndex(prev => {
          if (prev >= scenes.length - 1) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 5000); // 5 seconds per scene

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [isPlaying, scenes.length]);

  // Play audio for current scene
  useEffect(() => {
    if (audioRef.current && currentScene?.audioUrl && isPlaying) {
      audioRef.current.src = currentScene.audioUrl;
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.play().catch(() => {});
    }
  }, [currentSceneIndex, isPlaying, currentScene?.audioUrl, volume, isMuted]);

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

      toast.success("Lovable animation generation started!");
    } catch (error: any) {
      console.error('Lovable animation error:', error);
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
  };

  const goToNextScene = () => {
    setCurrentSceneIndex(prev => Math.min(scenes.length - 1, prev + 1));
  };

  const formatTime = (index: number, total: number) => {
    const currentTime = index * 5;
    const totalTime = total * 5;
    const formatSec = (s: number) => {
      const mins = Math.floor(s / 60);
      const secs = s % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    return `${formatSec(currentTime)} / ${formatSec(totalTime)}`;
  };

  const downloadVideo = () => {
    if (existingAnimation?.videoUrl) {
      const link = document.createElement('a');
      link.href = existingAnimation.videoUrl;
      link.download = 'lovable-animation.mp4';
      link.click();
    }
  };

  // Show generate button if no animation exists
  if (!isCompleted && !isLovableGenerating && !generating) {
    return (
      <Card className="shadow-[var(--shadow-medium)] border-2 border-pink-200/50 bg-gradient-to-br from-pink-50/50 to-purple-50/50 dark:from-pink-950/20 dark:to-purple-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-6 h-6 text-pink-500" />
            Lovable Animated Story Video
          </CardTitle>
          <CardDescription>
            Create a warm, cute, and emotionally engaging animated video from your story
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <span>Soft pastel colors</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Expressive characters</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>Warm narration</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Storybook magic</span>
            </div>
          </div>
          
          <Button
            onClick={generateLovableAnimation}
            disabled={!hasScript}
            size="lg"
            className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
          >
            <Heart className="w-5 h-5 mr-2" />
            Generate Lovable Animated Video
          </Button>
          
          {!hasScript && (
            <p className="text-sm text-center text-muted-foreground">
              Generate a story script first to create your lovable animation
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Show progress during generation
  if (isLovableGenerating || generating) {
    const progress = videoProgress || localProgress;
    return (
      <Card className="shadow-[var(--shadow-medium)] border-2 border-pink-200/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-6 h-6 text-pink-500 animate-pulse" />
            Creating Your Lovable Animation...
          </CardTitle>
          <CardDescription>
            Crafting warm, magical scenes with love and care
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Progress value={progress} className="h-4" />
          <div className="text-center space-y-2">
            <p className="text-2xl font-bold text-pink-500">{progress}%</p>
            <p className="text-muted-foreground text-sm">
              {progress < 60 && "✨ Painting lovable scene illustrations..."}
              {progress >= 60 && progress < 85 && "🎙️ Recording warm narration..."}
              {progress >= 85 && "🎬 Bringing your story to life..."}
            </p>
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

  // Show completed animation player
  if (isCompleted && scenes.length > 0) {
    return (
      <Card className="shadow-[var(--shadow-medium)] border-2 border-pink-200/50 overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Heart className="w-6 h-6 text-pink-500" />
              Your Lovable Animated Story
            </CardTitle>
            <Badge variant="secondary" className="bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300">
              Scene {currentSceneIndex + 1} of {scenes.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Animation Viewer */}
          <div 
            ref={containerRef}
            className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-950 dark:to-purple-950"
          >
            {currentScene && (
              <>
                {/* Scene Image */}
                <img
                  src={currentScene.imageUrl}
                  alt={`Scene ${currentScene.sceneNumber}`}
                  className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
                />
                
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                
                {/* Narration Subtitle */}
                <div className="absolute bottom-16 left-4 right-4">
                  <div className="mx-auto max-w-2xl">
                    <div className="bg-black/70 rounded-xl px-5 py-4 backdrop-blur-sm">
                      <p className="text-white text-center text-sm md:text-base leading-relaxed">
                        {currentScene.narration}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Scene indicator */}
                <div className="absolute top-4 right-4">
                  <Badge className="bg-pink-500/80 text-white backdrop-blur-sm">
                    {formatTime(currentSceneIndex, scenes.length)}
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
              </>
            )}
          </div>

          {/* Progress Slider */}
          <div className="space-y-2">
            <Slider
              value={[currentSceneIndex]}
              max={Math.max(0, scenes.length - 1)}
              step={1}
              onValueChange={(value) => setCurrentSceneIndex(value[0])}
              className="cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              {scenes.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSceneIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    idx === currentSceneIndex ? 'bg-pink-500' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setCurrentSceneIndex(0)}>
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
              {existingAnimation?.videoUrl && (
                <Button variant="outline" size="sm" onClick={downloadVideo}>
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              )}
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
              Regenerate Lovable Animation
            </Button>
          </div>

          {/* Hidden audio element */}
          <audio ref={audioRef} className="hidden" />
        </CardContent>
      </Card>
    );
  }

  return null;
};
