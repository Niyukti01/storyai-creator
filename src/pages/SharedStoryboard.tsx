import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Film, MessageSquare, Camera, Sparkles, Clock, User, Home } from "lucide-react";

interface Dialogue {
  character: string;
  line: string;
  emotion: string;
}

interface SceneNote {
  id: string;
  text: string;
  type: "production" | "reminder" | "comment";
  createdAt: string;
}

interface Scene {
  scene_number: number;
  setting: string;
  description: string;
  camera_angle?: string;
  dialogue: Dialogue[];
  action: string;
  notes?: SceneNote[];
}

interface Character {
  name: string;
  description: string;
  personality: string;
  role: string;
}

interface Script {
  characters: Character[];
  scenes: Scene[];
  story_summary: string;
  theme: string;
  estimated_duration: string;
}

interface SharedProject {
  id: string;
  title: string;
  description: string | null;
  genre: string;
  script: Script;
}

const SharedStoryboard = () => {
  const { token } = useParams();
  const [project, setProject] = useState<SharedProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSharedProject();
  }, [token]);

  const loadSharedProject = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("projects")
        .select("id, title, description, genre, script")
        .eq("share_token", token)
        .eq("share_enabled", true)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        setError("This storyboard is not available or sharing has been disabled.");
        return;
      }

      if (!data.script) {
        setError("This storyboard has no script content.");
        return;
      }

      setProject({
        ...data,
        script: data.script as unknown as Script,
      });
    } catch (err: any) {
      console.error("Error loading shared project:", err);
      setError("Failed to load the storyboard.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Loading storyboard...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Film className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold">Storyboard Not Found</h2>
            <p className="text-muted-foreground">
              {error || "This storyboard doesn't exist or is no longer shared."}
            </p>
            <Button asChild variant="outline">
              <Link to="/">
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const script = project.script;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Film className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{project.title}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary">{project.genre}</Badge>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {script.estimated_duration}
                  </span>
                </div>
              </div>
            </div>
            <Badge variant="outline" className="gap-1">
              <User className="h-3 w-3" />
              Shared View
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Story Summary */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold mb-2">Story Summary</h2>
                <p className="text-muted-foreground">{script.story_summary}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Theme:</strong> {script.theme}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Characters */}
        {script.characters && script.characters.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Characters</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {script.characters.map((character, index) => (
                <Card key={index}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">{character.name}</h3>
                        <p className="text-xs text-muted-foreground">{character.role}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{character.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <Separator className="my-8" />

        {/* Scenes */}
        <h2 className="text-lg font-semibold mb-4">
          Scenes ({script.scenes.length})
        </h2>
        <div className="space-y-6">
          {script.scenes.map((scene) => (
            <Card key={scene.scene_number} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Scene Header */}
                <div className="bg-muted/50 px-4 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">Scene {scene.scene_number}</Badge>
                    <span className="font-medium">{scene.setting}</span>
                  </div>
                  {scene.camera_angle && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Camera className="h-4 w-4" />
                      {scene.camera_angle}
                    </div>
                  )}
                </div>

                <div className="p-4 space-y-4">
                  {/* Description */}
                  <p className="text-muted-foreground">{scene.description}</p>

                  {/* Dialogue */}
                  {scene.dialogue && scene.dialogue.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <MessageSquare className="h-4 w-4" />
                        Dialogue
                      </div>
                      <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                        {scene.dialogue.map((d, dIndex) => (
                          <div key={dIndex} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-primary">
                                {d.character}
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {d.emotion}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground italic">"{d.line}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action */}
                  {scene.action && (
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-sm">
                        <strong>Action:</strong> {scene.action}
                      </p>
                    </div>
                  )}

                  {/* Notes */}
                  {scene.notes && scene.notes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Production Notes</p>
                      <div className="space-y-1">
                        {scene.notes.map((note) => (
                          <div
                            key={note.id}
                            className="text-sm text-muted-foreground bg-muted/30 rounded px-2 py-1"
                          >
                            <Badge variant="outline" className="text-xs mr-2">
                              {note.type}
                            </Badge>
                            {note.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">
            This is a shared view of a storyboard.{" "}
            <Link to="/" className="text-primary hover:underline">
              Create your own
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default SharedStoryboard;
