import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Users, Film, Clock, Download, Video } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { VideoThumbnail } from "@/components/VideoThumbnail";
import { SocialShare } from "@/components/SocialShare";

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
  created_at: string;
  photos: string[] | null;
  video_url: string | null;
  video_status: string | null;
  video_progress: number | null;
}

const Project = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  useEffect(() => {
    loadProject();
  }, [id]);

  useEffect(() => {
    if (project?.photos && project.photos.length > 0) {
      loadPhotoUrls();
    }
  }, [project?.photos]);

  const loadPhotoUrls = async () => {
    if (!project?.photos) return;

    try {
      const urls = await Promise.all(
        project.photos.map(async (photoPath) => {
          const { data } = await supabase.storage
            .from('user-photos')
            .createSignedUrl(photoPath, 3600); // 1 hour expiry
          return data?.signedUrl || '';
        })
      );
      setPhotoUrls(urls.filter(url => url));
    } catch (error) {
      console.error('Failed to load photo URLs:', error);
    }
  };

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
      setProject(data);
    } catch (error: any) {
      toast.error("Failed to load project");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const generateScript = async () => {
    if (!project) return;
    
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-story-script', {
        body: {
          title: project.title,
          description: project.description,
          genre: project.genre,
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      // Update project with generated script
      const { error: updateError } = await supabase
        .from("projects")
        .update({
          script: data.script,
          status: 'scripted'
        })
        .eq("id", id);

      if (updateError) throw updateError;

      toast.success("Script generated successfully!");
      await loadProject(); // Reload to show new script
    } catch (error: any) {
      console.error('Script generation error:', error);
      toast.error(error.message || "Failed to generate script");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Film className="w-12 h-12 mx-auto mb-4 text-primary animate-pulse" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--gradient-hero)' }}>
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80">
        <div className="container mx-auto px-4 py-4">
          <Button
            onClick={() => navigate("/dashboard")}
            variant="ghost"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Project Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">{project.title}</h1>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{project.genre}</Badge>
                <Badge variant="outline">{project.status}</Badge>
              </div>
            </div>
            {!project.script && (
              <Button
                onClick={generateScript}
                disabled={generating}
                className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                size="lg"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                {generating ? "Generating..." : "Generate Script"}
              </Button>
            )}
          </div>
          {project.description && (
            <p className="text-muted-foreground text-lg">{project.description}</p>
          )}
        </div>

        {/* User Photos */}
        {photoUrls.length > 0 && (
          <Card className="shadow-[var(--shadow-medium)] mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Your Photos</CardTitle>
                  <CardDescription>
                    These photos will be used to create your personalized character avatar
                  </CardDescription>
                </div>
                <Button
                  onClick={() => navigate(`/project/${id}/character`)}
                  variant="outline"
                  size="sm"
                >
                  Customize Character
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {photoUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={url}
                      alt={`User photo ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border border-border"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Script State */}
        {!project.script && (
          <Card className="shadow-[var(--shadow-medium)]">
            <CardContent className="pt-16 pb-16 text-center">
              <Sparkles className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">Ready to Generate Your Script</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Click the button above to let AI create a complete script with characters, dialogue, and scenes.
              </p>
              {generating && (
                <div className="flex items-center justify-center gap-2 text-primary">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse delay-75" />
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse delay-150" />
                  <span className="ml-2">AI is crafting your story...</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Script Display */}
        {project.script && (
          <div className="space-y-6">
            {/* Script Overview */}
            <Card className="shadow-[var(--shadow-medium)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Film className="w-6 h-6 text-primary" />
                  Story Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Summary</h4>
                  <p className="text-muted-foreground">{project.script.story_summary}</p>
                </div>
                <div className="flex gap-6">
                  <div>
                    <h4 className="font-semibold mb-1">Theme</h4>
                    <p className="text-muted-foreground">{project.script.theme}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Duration
                    </h4>
                    <p className="text-muted-foreground">{project.script.estimated_duration}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Characters */}
            <Card className="shadow-[var(--shadow-medium)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-6 h-6 text-secondary" />
                  Characters ({project.script.characters.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {project.script.characters.map((character, index) => (
                    <div key={index} className="p-4 rounded-lg bg-muted/50">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-lg">{character.name}</h4>
                        <Badge variant="outline">{character.role}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{character.description}</p>
                      <p className="text-sm italic">"{character.personality}"</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Scenes */}
            <Card className="shadow-[var(--shadow-medium)]">
              <CardHeader>
                <CardTitle>Scenes ({project.script.scenes.length})</CardTitle>
                <CardDescription>Complete scene breakdown with dialogue and actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {project.script.scenes.map((scene, index) => (
                    <div key={index}>
                      {index > 0 && <Separator className="my-6" />}
                      
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge>Scene {scene.scene_number}</Badge>
                            {scene.camera_angle && (
                              <span className="text-xs text-muted-foreground">
                                📹 {scene.camera_angle}
                              </span>
                            )}
                          </div>
                          <h4 className="font-semibold text-lg">{scene.setting}</h4>
                          <p className="text-muted-foreground mt-2">{scene.description}</p>
                        </div>

                        {/* Dialogue */}
                        {scene.dialogue.length > 0 && (
                          <div className="pl-4 border-l-2 border-primary/30 space-y-3">
                            {scene.dialogue.map((line, idx) => (
                              <div key={idx}>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-sm">{line.character}</span>
                                  <span className="text-xs text-muted-foreground italic">
                                    ({line.emotion})
                                  </span>
                                </div>
                                <p className="text-sm">{line.line}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Action */}
                        <div className="bg-muted/30 p-3 rounded-lg">
                          <p className="text-sm">
                            <span className="font-semibold">Action: </span>
                            {scene.action}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Generated Video */}
            {project.video_url && project.video_status === 'completed' && (
              <Card className="shadow-[var(--shadow-medium)] border-2 border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="w-6 h-6 text-primary" />
                    Your Generated Animation
                  </CardTitle>
                  <CardDescription>Your animated movie is ready to view and download</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <VideoThumbnail 
                    src={project.video_url} 
                    className="w-full rounded-lg border border-border"
                  />
                  <div className="flex justify-center gap-3">
                    <Button asChild size="lg">
                      <a href={project.video_url} download>
                        <Download className="w-5 h-5 mr-2" />
                        Download MP4
                      </a>
                    </Button>
                    <SocialShare 
                      videoUrl={project.video_url} 
                      title={project.title}
                      description={project.description || undefined}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Video Generation In Progress */}
            {project.video_status === 'generating' && (
              <Card className="shadow-[var(--shadow-medium)]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="w-6 h-6 text-primary animate-pulse" />
                    Generating Your Animation...
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={project.video_progress || 0} className="h-3" />
                  <p className="text-center text-muted-foreground">
                    {project.video_progress || 0}% complete
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center gap-4">
              <Button
                onClick={() => navigate(`/project/${id}/storyboard`)}
                size="lg"
                className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
              >
                <Film className="w-5 h-5 mr-2" />
                View Storyboard
              </Button>
              <Button
                onClick={generateScript}
                disabled={generating}
                variant="outline"
                size="lg"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                {generating ? "Regenerating..." : "Regenerate Script"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Project;
