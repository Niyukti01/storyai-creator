import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, Film, MessageSquare, Camera, Sparkles, XCircle } from "lucide-react";
import { MusicSelector } from "@/components/MusicSelector";
import { CharacterGenerator } from "@/components/CharacterGenerator";
import { SceneEditor } from "@/components/SceneEditor";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { TimelineEditor } from "@/components/TimelineEditor";
import { getMusicById, type MusicTrack } from "@/lib/musicLibrary";

interface CharacterIllustration {
  name: string;
  description: string;
  imageUrl?: string;
}

interface Character {
  name: string;
  description: string;
  personality: string;
  role: string;
}

interface Dialogue {
  character: string;
  line: string;
  emotion: string;
}

interface Scene {
  scene_number: number;
  setting: string;
  description: string;
  camera_angle?: string;
  dialogue: Dialogue[];
  action: string;
}

interface Script {
  characters: Character[];
  scenes: Scene[];
  story_summary: string;
  theme: string;
  estimated_duration: string;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  genre: string;
  status: string;
  script: any; // Using any to handle Json type from Supabase
  avatar: any;
  video_url: string | null;
  video_status: string | null;
  voice_sample_url: string | null;
  music_track: any; // JSON data for selected music track
  video_progress: number | null;
  video_generation_started_at: string | null;
  video_generation_cancelled: boolean | null;
}

const StoryboardPreview = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);
  const [characters, setCharacters] = useState<CharacterIllustration[]>([]);
  const [editedScript, setEditedScript] = useState<Script | null>(null);
  const [generatingVoice, setGeneratingVoice] = useState(false);
  const [activeSceneNumber, setActiveSceneNumber] = useState<number | null>(null);
  const sceneRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  useEffect(() => {
    loadProject();

    // Subscribe to realtime updates for progress tracking
    const channel = supabase
      .channel('project-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${id}`
        },
        (payload) => {
          console.log('Project updated:', payload);
          setProject(payload.new as Project);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const loadProject = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      
      if (!data.script) {
        toast.error("No script found for this project");
        navigate(`/project/${id}`);
        return;
      }
      
      setProject(data);
      
      // Load selected music if available
      if (data.music_track && typeof data.music_track === 'object' && 'id' in data.music_track) {
        const track = getMusicById(data.music_track.id as string);
        if (track) {
          setSelectedMusic(track);
        }
      }

      // Load character illustrations
      if (data.avatar && typeof data.avatar === 'object' && 'characters' in data.avatar) {
        setCharacters((data.avatar as any).characters || []);
      }

      // Initialize edited script
      if (data.script) {
        setEditedScript(data.script as any);
      }
    } catch (error: any) {
      toast.error("Failed to load project");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleMusicSelect = async (track: MusicTrack) => {
    if (!id) return;

    setSelectedMusic(track);

    try {
      const { error } = await supabase
        .from("projects")
        .update({ music_track: track as any })
        .eq("id", id);

      if (error) throw error;

      toast.success(`Selected "${track.name}" as background music`);
    } catch (error: any) {
      console.error("Error saving music selection:", error);
      toast.error("Failed to save music selection");
    }
  };

  const handleCharactersUpdate = (updatedCharacters: CharacterIllustration[]) => {
    setCharacters(updatedCharacters);
  };

  const handleVoiceSampleUpdate = (url: string) => {
    setProject(prev => prev ? { ...prev, voice_sample_url: url } : null);
  };

  const generateVoiceDialogue = async () => {
    if (!id) return;

    setGeneratingVoice(true);
    toast.loading("Generating voice dialogue...", { id: "voice-generation" });

    try {
      const { data, error } = await supabase.functions.invoke("generate-voice-dialogue", {
        body: { projectId: id },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Generated ${data.audioCount} voice dialogue segments!`, { 
          id: "voice-generation" 
        });
        await loadProject();
      } else {
        throw new Error(data?.error || "Voice generation failed");
      }
    } catch (error: any) {
      console.error("Error generating voice dialogue:", error);
      toast.error(error.message || "Failed to generate voice dialogue", { 
        id: "voice-generation" 
      });
    } finally {
      setGeneratingVoice(false);
    }
  };

  const handleSceneUpdate = async (updatedScene: Scene) => {
    if (!editedScript || !id) return;

    const updatedScenes = editedScript.scenes.map((scene) =>
      scene.scene_number === updatedScene.scene_number ? updatedScene : scene
    );

    const newScript = { ...editedScript, scenes: updatedScenes };
    setEditedScript(newScript);

    try {
      const { error } = await supabase
        .from("projects")
        .update({ script: newScript as any })
        .eq("id", id);

      if (error) throw error;
      toast.success("Scene updated successfully");
    } catch (error: any) {
      console.error("Error updating scene:", error);
      toast.error("Failed to update scene");
    }
  };

  const handleSceneDelete = async (sceneNumber: number) => {
    if (!editedScript || !id) return;

    const updatedScenes = editedScript.scenes
      .filter((scene) => scene.scene_number !== sceneNumber)
      .map((scene, index) => ({ ...scene, scene_number: index + 1 }));

    const newScript = { ...editedScript, scenes: updatedScenes };
    setEditedScript(newScript);

    try {
      const { error } = await supabase
        .from("projects")
        .update({ script: newScript as any })
        .eq("id", id);

      if (error) throw error;
      toast.success("Scene deleted successfully");
    } catch (error: any) {
      console.error("Error deleting scene:", error);
      toast.error("Failed to delete scene");
    }
  };

  const handleSceneReorder = async (sceneNumber: number, direction: "up" | "down") => {
    if (!editedScript || !id) return;

    const currentIndex = editedScript.scenes.findIndex(
      (s) => s.scene_number === sceneNumber
    );
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= editedScript.scenes.length) return;

    const updatedScenes = [...editedScript.scenes];
    [updatedScenes[currentIndex], updatedScenes[targetIndex]] = [
      updatedScenes[targetIndex],
      updatedScenes[currentIndex],
    ];

    // Renumber scenes
    const renumberedScenes = updatedScenes.map((scene, index) => ({
      ...scene,
      scene_number: index + 1,
    }));

    const newScript = { ...editedScript, scenes: renumberedScenes };
    setEditedScript(newScript);

    try {
      const { error } = await supabase
        .from("projects")
        .update({ script: newScript as any })
        .eq("id", id);

      if (error) throw error;
      toast.success("Scene reordered successfully");
    } catch (error: any) {
      console.error("Error reordering scene:", error);
      toast.error("Failed to reorder scene");
    }
  };

  const handleTimelineReorder = async (fromIndex: number, toIndex: number) => {
    if (!editedScript || !id) return;

    const updatedScenes = [...editedScript.scenes];
    const [movedScene] = updatedScenes.splice(fromIndex, 1);
    updatedScenes.splice(toIndex, 0, movedScene);

    // Renumber scenes
    const renumberedScenes = updatedScenes.map((scene, index) => ({
      ...scene,
      scene_number: index + 1,
    }));

    const newScript = { ...editedScript, scenes: renumberedScenes };
    setEditedScript(newScript);

    try {
      const { error } = await supabase
        .from("projects")
        .update({ script: newScript as any })
        .eq("id", id);

      if (error) throw error;
      toast.success("Scene reordered successfully");
    } catch (error: any) {
      console.error("Error reordering scene:", error);
      toast.error("Failed to reorder scene");
    }
  };

  const scrollToScene = (sceneNumber: number) => {
    const sceneElement = sceneRefs.current[sceneNumber];
    if (sceneElement) {
      sceneElement.scrollIntoView({ behavior: "smooth", block: "center" });
      setActiveSceneNumber(sceneNumber);
      
      // Reset active scene after animation
      setTimeout(() => setActiveSceneNumber(null), 2000);
    }
  };

  const generateVideo = async () => {
    if (!project || !id) return;

    setGeneratingVideo(true);
    toast.loading("Starting animation generation...", { id: "video-generation" });

    try {
      const { data, error } = await supabase.functions.invoke("generate-video", {
        body: { projectId: id },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Animation generated successfully!", { id: "video-generation" });
        await loadProject();
      } else if (data?.error === 'Generation cancelled by user') {
        toast.info("Generation cancelled", { id: "video-generation" });
      } else {
        throw new Error("Video generation failed");
      }
    } catch (error: any) {
      console.error("Error generating video:", error);
      toast.error(error.message || "Failed to generate animation", { 
        id: "video-generation" 
      });
    } finally {
      setGeneratingVideo(false);
    }
  };

  const cancelVideoGeneration = async () => {
    if (!id) return;

    try {
      const { error } = await supabase
        .from("projects")
        .update({ video_generation_cancelled: true })
        .eq("id", id);

      if (error) throw error;

      toast.info("Cancelling generation...");
    } catch (error: any) {
      console.error("Error cancelling generation:", error);
      toast.error("Failed to cancel generation");
    }
  };

  const getEstimatedTimeRemaining = () => {
    if (!project?.video_generation_started_at || !project?.video_progress) return null;

    const startTime = new Date(project.video_generation_started_at).getTime();
    const currentTime = new Date().getTime();
    const elapsedMs = currentTime - startTime;
    const progress = project.video_progress;

    if (progress === 0 || progress === 100) return null;

    const totalEstimatedMs = (elapsedMs / progress) * 100;
    const remainingMs = totalEstimatedMs - elapsedMs;
    const remainingSecs = Math.ceil(remainingMs / 1000);

    if (remainingSecs < 60) return `${remainingSecs}s`;
    const remainingMins = Math.ceil(remainingSecs / 60);
    return `${remainingMins}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center">
        <Film className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!project?.script || !editedScript) {
    return null;
  }

  const script = editedScript;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="container max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/project/${id}`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Storyboard Preview
              </h1>
              <p className="text-muted-foreground mt-1">{project.title}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="gap-2">
              <Film className="h-3 w-3" />
              {script.scenes.length} Scenes
            </Badge>
            <Badge variant="outline" className="gap-2">
              <Sparkles className="h-3 w-3" />
              {script.estimated_duration}
            </Badge>
          </div>
        </div>

        {/* Story Overview */}
        <Card className="border-2 shadow-lg">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Story Summary</h3>
                <p className="text-foreground">{script.story_summary}</p>
              </div>
              <Separator />
              <div className="flex gap-6">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Theme</h3>
                  <Badge variant="secondary">{script.theme}</Badge>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Genre</h3>
                  <Badge variant="outline">{project.genre}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Character Illustrations */}
        <CharacterGenerator
          projectId={id!}
          script={script}
          genre={project.genre}
          existingCharacters={characters}
          onCharactersUpdate={handleCharactersUpdate}
        />

        {/* Music Selection */}
        <MusicSelector 
          selectedTrack={selectedMusic}
          onSelectTrack={handleMusicSelect}
        />

        {/* Voice Cloning */}
        <VoiceRecorder
          projectId={id!}
          existingVoiceSampleUrl={project.voice_sample_url}
          onVoiceSampleUpdate={handleVoiceSampleUpdate}
        />

        {project.voice_sample_url && (
          <Card className="border-2 border-primary/20">
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Voice sample uploaded! Generate dialogue using your cloned voice.
              </p>
              <Button 
                onClick={generateVoiceDialogue}
                disabled={generatingVoice}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {generatingVoice ? "Generating Voice Dialogue..." : "Generate Voice Dialogue"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Timeline Editor */}
        <TimelineEditor
          scenes={script.scenes}
          activeSceneNumber={activeSceneNumber || undefined}
          onSceneClick={scrollToScene}
          onSceneReorder={handleTimelineReorder}
        />

        {/* Storyboard Grid */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Film className="h-6 w-6 text-primary" />
            Scene Breakdown
          </h2>
          
          <div className="grid gap-6">
            {script.scenes.map((scene, index) => (
              <div
                key={scene.scene_number}
                ref={(el) => (sceneRefs.current[scene.scene_number] = el)}
              >
                <SceneEditor
                  scene={scene}
                  onSave={handleSceneUpdate}
                  onDelete={
                    script.scenes.length > 1
                      ? () => handleSceneDelete(scene.scene_number)
                      : undefined
                  }
                  onMoveUp={
                    index > 0
                      ? () => handleSceneReorder(scene.scene_number, "up")
                      : undefined
                  }
                  onMoveDown={
                    index < script.scenes.length - 1
                      ? () => handleSceneReorder(scene.scene_number, "down")
                      : undefined
                  }
                  isFirst={index === 0}
                  isLast={index === script.scenes.length - 1}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Generate Video CTA */}
        <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
          <CardContent className="pt-6 text-center space-y-4">
            <Film className="h-12 w-12 text-primary mx-auto" />
            <div>
              <h3 className="text-xl font-bold mb-2">
                {project.video_status === 'generating' 
                  ? "Generating Your Animation..."
                  : project.video_url 
                  ? "Animation Generated!" 
                  : "Ready to Generate Your Animation?"}
              </h3>
              <p className="text-muted-foreground">
                {project.video_status === 'generating'
                  ? "Please wait while we create your animated movie"
                  : project.video_url 
                  ? "Your animated short movie is ready to view"
                  : "Review your storyboard and proceed to generate the final animated video"
                }
              </p>
            </div>

            {/* Progress Tracking */}
            {project.video_status === 'generating' && (
              <div className="space-y-3 max-w-md mx-auto">
                <Progress value={project.video_progress || 0} className="h-3" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {project.video_progress || 0}% complete
                  </span>
                  {getEstimatedTimeRemaining() && (
                    <span className="text-muted-foreground">
                      ~{getEstimatedTimeRemaining()} remaining
                    </span>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={cancelVideoGeneration}
                  className="gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Cancel Generation
                </Button>
              </div>
            )}
            
            {project.video_url && project.video_status !== 'generating' ? (
              <div className="space-y-3">
                <video 
                  controls 
                  className="w-full max-w-2xl mx-auto rounded-lg border-2 border-border shadow-lg"
                  poster="/placeholder.svg"
                >
                  <source src={project.video_url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                <div className="flex gap-2 justify-center">
                  <Button 
                    variant="outline" 
                    size="lg"
                    onClick={generateVideo}
                    disabled={generatingVideo}
                  >
                    {generatingVideo ? "Regenerating..." : "Regenerate Video"}
                  </Button>
                  <Button size="lg" asChild>
                    <a href={project.video_url} download>
                      Download MP4
                    </a>
                  </Button>
                </div>
              </div>
            ) : project.video_status !== 'generating' ? (
              <Button 
                size="lg" 
                className="gap-2"
                onClick={generateVideo}
                disabled={generatingVideo || project.video_status === 'generating'}
              >
                <Sparkles className="h-5 w-5" />
                {generatingVideo ? "Starting..." : "Generate Animation"}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StoryboardPreview;
