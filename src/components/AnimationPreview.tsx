import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  Maximize2,
  Film,
  RefreshCw
} from "lucide-react";

interface Dialogue {
  character: string;
  line: string;
  emotion: string;
  audioUrl?: string;
}

interface Scene {
  scene_number: number;
  setting: string;
  description: string;
  camera_angle?: string;
  dialogue: Dialogue[];
  action: string;
}

interface CharacterIllustration {
  name: string;
  description: string;
  imageUrl?: string;
}

interface AnimationPreviewProps {
  scenes: Scene[];
  characters: CharacterIllustration[];
  voiceDialogue?: { [key: string]: string }; // character-sceneNum-dialogueNum: audioUrl
  musicUrl?: string;
  projectTitle: string;
}

interface PlaybackSegment {
  type: "scene-intro" | "dialogue" | "scene-transition";
  sceneNumber: number;
  content: {
    setting?: string;
    description?: string;
    character?: string;
    line?: string;
    emotion?: string;
    audioUrl?: string;
  };
  duration: number;
  startTime: number;
}

const SCENE_INTRO_DURATION = 3;
const DIALOGUE_BASE_DURATION = 3;
const TRANSITION_DURATION = 1;
const WORDS_PER_SECOND = 2.5;

export const AnimationPreview = ({
  scenes,
  characters,
  voiceDialogue,
  musicUrl,
  projectTitle,
}: AnimationPreviewProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [segments, setSegments] = useState<PlaybackSegment[]>([]);
  const [currentSegment, setCurrentSegment] = useState<PlaybackSegment | null>(null);
  const [transitionOpacity, setTransitionOpacity] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Build playback segments from scenes
  useEffect(() => {
    const built: PlaybackSegment[] = [];
    let currentStartTime = 0;

    scenes.forEach((scene, sceneIndex) => {
      // Scene intro
      built.push({
        type: "scene-intro",
        sceneNumber: scene.scene_number,
        content: {
          setting: scene.setting,
          description: scene.description,
        },
        duration: SCENE_INTRO_DURATION,
        startTime: currentStartTime,
      });
      currentStartTime += SCENE_INTRO_DURATION;

      // Dialogues
      scene.dialogue.forEach((dialogue, dialogueIndex) => {
        const wordCount = dialogue.line.split(" ").length;
        const duration = Math.max(wordCount / WORDS_PER_SECOND, DIALOGUE_BASE_DURATION);
        
        const audioKey = `${dialogue.character}-${scene.scene_number}-${dialogueIndex}`;
        
        built.push({
          type: "dialogue",
          sceneNumber: scene.scene_number,
          content: {
            character: dialogue.character,
            line: dialogue.line,
            emotion: dialogue.emotion,
            audioUrl: voiceDialogue?.[audioKey],
          },
          duration,
          startTime: currentStartTime,
        });
        currentStartTime += duration;
      });

      // Scene transition (except for last scene)
      if (sceneIndex < scenes.length - 1) {
        built.push({
          type: "scene-transition",
          sceneNumber: scene.scene_number,
          content: {},
          duration: TRANSITION_DURATION,
          startTime: currentStartTime,
        });
        currentStartTime += TRANSITION_DURATION;
      }
    });

    setSegments(built);
  }, [scenes, voiceDialogue]);

  // Find current segment based on time
  useEffect(() => {
    const segment = segments.find(
      (seg) => currentTime >= seg.startTime && currentTime < seg.startTime + seg.duration
    );
    
    if (segment) {
      setCurrentSegment(segment);
      
      // Handle transition opacity
      if (segment.type === "scene-transition") {
        const progress = (currentTime - segment.startTime) / segment.duration;
        setTransitionOpacity(progress < 0.5 ? 1 - progress * 2 : (progress - 0.5) * 2);
      } else {
        setTransitionOpacity(1);
      }
    }
  }, [currentTime, segments]);

  // Animation loop
  const animate = useCallback((timestamp: number) => {
    if (!lastTimeRef.current) {
      lastTimeRef.current = timestamp;
    }

    const delta = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;

    setCurrentTime((prev) => {
      const totalDuration = segments.length > 0 
        ? segments[segments.length - 1].startTime + segments[segments.length - 1].duration 
        : 0;
      
      const newTime = prev + delta;
      
      if (newTime >= totalDuration) {
        setIsPlaying(false);
        return totalDuration;
      }
      
      return newTime;
    });

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(animate);
    }
  }, [isPlaying, segments]);

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = 0;
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, animate]);

  // Handle music playback
  useEffect(() => {
    if (musicRef.current && musicUrl) {
      musicRef.current.volume = isMuted ? 0 : volume * 0.3; // Background music at 30% of main volume
      
      if (isPlaying) {
        musicRef.current.play().catch(() => {});
      } else {
        musicRef.current.pause();
      }
    }
  }, [isPlaying, volume, isMuted, musicUrl]);

  const totalDuration = segments.length > 0 
    ? segments[segments.length - 1].startTime + segments[segments.length - 1].duration 
    : 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const togglePlay = () => {
    if (currentTime >= totalDuration) {
      setCurrentTime(0);
    }
    setIsPlaying(!isPlaying);
  };

  const skipToScene = (direction: "prev" | "next") => {
    const currentSceneNum = currentSegment?.sceneNumber || 1;
    const targetScene = direction === "prev" 
      ? Math.max(1, currentSceneNum - 1)
      : Math.min(scenes.length, currentSceneNum + 1);
    
    const targetSegment = segments.find(
      (seg) => seg.sceneNumber === targetScene && seg.type === "scene-intro"
    );
    
    if (targetSegment) {
      setCurrentTime(targetSegment.startTime);
    }
  };

  const handleSeek = (value: number[]) => {
    setCurrentTime(value[0]);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  const restart = () => {
    setCurrentTime(0);
    setIsPlaying(false);
  };

  // Get character illustration for current scene
  const getCurrentCharacterImage = () => {
    if (!currentSegment || currentSegment.type !== "dialogue") return null;
    
    const character = characters.find(
      (c) => c.name.toLowerCase() === currentSegment.content.character?.toLowerCase()
    );
    
    return character?.imageUrl;
  };

  const getSceneBackground = () => {
    if (!currentSegment) return "from-slate-800 to-slate-900";
    
    // Different gradients based on scene setting keywords
    const setting = currentSegment.content.setting?.toLowerCase() || "";
    
    if (setting.includes("forest") || setting.includes("nature")) {
      return "from-green-900 to-emerald-950";
    }
    if (setting.includes("ocean") || setting.includes("sea") || setting.includes("beach")) {
      return "from-blue-900 to-cyan-950";
    }
    if (setting.includes("night") || setting.includes("dark")) {
      return "from-slate-900 to-zinc-950";
    }
    if (setting.includes("sunset") || setting.includes("evening")) {
      return "from-orange-900 to-rose-950";
    }
    if (setting.includes("city") || setting.includes("urban")) {
      return "from-zinc-800 to-slate-900";
    }
    
    return "from-slate-800 to-slate-900";
  };

  return (
    <Card className="border-2 shadow-lg overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            Animation Preview
          </CardTitle>
          <Badge variant="secondary">
            {currentSegment ? `Scene ${currentSegment.sceneNumber}` : "Ready"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Video Preview Area */}
        <div
          ref={containerRef}
          className={`relative aspect-video rounded-lg overflow-hidden bg-gradient-to-br ${getSceneBackground()} transition-all duration-500`}
          style={{ opacity: transitionOpacity }}
        >
          {/* Scene Content */}
          {currentSegment?.type === "scene-intro" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 animate-fade-in">
              <Badge variant="outline" className="mb-4 text-white border-white/30">
                Scene {currentSegment.sceneNumber}
              </Badge>
              <h3 className="text-2xl md:text-3xl font-bold text-white text-center mb-2">
                {currentSegment.content.setting}
              </h3>
              <p className="text-white/70 text-center max-w-xl text-sm md:text-base">
                {currentSegment.content.description}
              </p>
            </div>
          )}

          {currentSegment?.type === "dialogue" && (
            <div className="absolute inset-0 flex flex-col animate-fade-in">
              {/* Character Illustration */}
              <div className="flex-1 flex items-center justify-center p-4">
                {getCurrentCharacterImage() ? (
                  <img
                    src={getCurrentCharacterImage()!}
                    alt={currentSegment.content.character}
                    className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
                  />
                ) : (
                  <div className="w-32 h-32 md:w-48 md:h-48 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-4xl md:text-6xl text-white/50">
                      {currentSegment.content.character?.charAt(0)}
                    </span>
                  </div>
                )}
              </div>

              {/* Dialogue Subtitle */}
              <div className="absolute bottom-16 left-0 right-0 px-4">
                <div className="mx-auto max-w-2xl">
                  <div className="bg-black/70 rounded-lg px-4 py-3 text-center backdrop-blur-sm">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <span className="font-semibold text-white text-sm">
                        {currentSegment.content.character}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {currentSegment.content.emotion}
                      </Badge>
                    </div>
                    <p className="text-white text-lg md:text-xl">
                      "{currentSegment.content.line}"
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentSegment?.type === "scene-transition" && (
            <div className="absolute inset-0 bg-black flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}

          {!currentSegment && !isPlaying && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50">
              <Film className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">{projectTitle}</p>
              <p className="text-sm">Press play to preview your animation</p>
            </div>
          )}

          {/* Progress Overlay */}
          <div className="absolute top-4 right-4">
            <Badge variant="outline" className="text-white border-white/30 bg-black/30 backdrop-blur-sm">
              {formatTime(currentTime)} / {formatTime(totalDuration)}
            </Badge>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Slider
            value={[currentTime]}
            max={totalDuration || 1}
            step={0.1}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />
          
          {/* Scene Markers */}
          <div className="relative h-2">
            {segments
              .filter((seg) => seg.type === "scene-intro")
              .map((seg) => (
                <div
                  key={seg.sceneNumber}
                  className="absolute top-0 w-1 h-2 bg-primary/50 rounded"
                  style={{
                    left: `${(seg.startTime / totalDuration) * 100}%`,
                  }}
                  title={`Scene ${seg.sceneNumber}`}
                />
              ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={restart}
              title="Restart"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => skipToScene("prev")}
              disabled={!currentSegment || currentSegment.sceneNumber <= 1}
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              variant="default"
              size="icon"
              onClick={togglePlay}
              className="h-10 w-10"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => skipToScene("next")}
              disabled={!currentSegment || currentSegment.sceneNumber >= scenes.length}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-4">
            {/* Volume Control */}
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
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.1}
                onValueChange={([v]) => {
                  setVolume(v);
                  setIsMuted(v === 0);
                }}
                className="w-20"
              />
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Hidden Audio Elements */}
        {musicUrl && (
          <audio ref={musicRef} src={musicUrl} loop />
        )}
        <audio ref={audioRef} />

        {/* Info */}
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          This is a rough preview. Final rendering will include smooth animations, 
          lip-sync, and full quality audio.
        </div>
      </CardContent>
    </Card>
  );
};
