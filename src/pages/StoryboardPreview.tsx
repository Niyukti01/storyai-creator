import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Film, MessageSquare, Camera, Sparkles } from "lucide-react";
import { MusicSelector } from "@/components/MusicSelector";
import { getMusicById, type MusicTrack } from "@/lib/musicLibrary";

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
}

const StoryboardPreview = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);

  useEffect(() => {
    loadProject();
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

  const generateVideo = async () => {
    if (!project || !id) return;

    setGeneratingVideo(true);
    toast.loading("Generating your animation...", { id: "video-generation" });

    try {
      const { data, error } = await supabase.functions.invoke("generate-video", {
        body: { projectId: id },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Animation generated successfully!", { id: "video-generation" });
        await loadProject(); // Reload to get updated video URL
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center">
        <Film className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!project?.script) {
    return null;
  }

  const script = project.script as Script;

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

        {/* Music Selection */}
        <MusicSelector 
          selectedTrack={selectedMusic}
          onSelectTrack={handleMusicSelect}
        />

        {/* Storyboard Grid */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Film className="h-6 w-6 text-primary" />
            Scene Breakdown
          </h2>
          
          <div className="grid gap-8">
            {script.scenes.map((scene, index) => (
              <Card 
                key={scene.scene_number} 
                className="border-2 hover:border-primary transition-colors shadow-lg overflow-hidden"
              >
                <div className="bg-gradient-to-r from-primary/10 to-secondary/10 px-6 py-4 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        {scene.scene_number}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">Scene {scene.scene_number}</h3>
                        <p className="text-sm text-muted-foreground">{scene.setting}</p>
                      </div>
                    </div>
                    {scene.camera_angle && (
                      <Badge variant="outline" className="gap-2">
                        <Camera className="h-3 w-3" />
                        {scene.camera_angle}
                      </Badge>
                    )}
                  </div>
                </div>

                <CardContent className="p-6 space-y-6">
                  {/* Scene Illustration Placeholder */}
                  <div className="relative aspect-video bg-gradient-to-br from-muted/50 to-muted rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                    <div className="text-center space-y-2">
                      <Film className="h-12 w-12 text-muted-foreground mx-auto" />
                      <p className="text-sm text-muted-foreground max-w-md px-4">
                        {scene.description}
                      </p>
                    </div>
                  </div>

                  {/* Scene Action */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Action</h4>
                    <p className="text-foreground">{scene.action}</p>
                  </div>

                  <Separator />

                  {/* Dialogue */}
                  {scene.dialogue && scene.dialogue.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        Dialogue
                      </h4>
                      <div className="space-y-3">
                        {scene.dialogue.map((line, idx) => (
                          <div 
                            key={idx}
                            className="bg-muted/50 rounded-lg p-4 border border-border"
                          >
                            <div className="flex items-start gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-primary">
                                  {line.character.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-sm">{line.character}</span>
                                  <Badge variant="secondary" className="text-xs">
                                    {line.emotion}
                                  </Badge>
                                </div>
                                <p className="text-foreground italic">"{line.line}"</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>

                {/* Scene Transition Indicator */}
                {index < script.scenes.length - 1 && (
                  <div className="flex items-center justify-center py-4 bg-muted/30">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="h-px w-12 bg-border"></div>
                      <span className="font-medium">Transition</span>
                      <div className="h-px w-12 bg-border"></div>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* Generate Video CTA */}
        <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
          <CardContent className="pt-6 text-center space-y-4">
            <Film className="h-12 w-12 text-primary mx-auto" />
            <div>
              <h3 className="text-xl font-bold mb-2">
                {project.video_url ? "Animation Generated!" : "Ready to Generate Your Animation?"}
              </h3>
              <p className="text-muted-foreground">
                {project.video_url 
                  ? "Your animated short movie is ready to view"
                  : "Review your storyboard and proceed to generate the final animated video"
                }
              </p>
            </div>
            
            {project.video_url ? (
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
            ) : (
              <Button 
                size="lg" 
                className="gap-2"
                onClick={generateVideo}
                disabled={generatingVideo}
              >
                <Sparkles className="h-5 w-5" />
                {generatingVideo ? "Generating..." : "Generate Animation"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StoryboardPreview;
