import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Film, MessageSquare, Users, Loader2, Save } from "lucide-react";

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

const GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Horror",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Thriller",
  "Animation",
  "Documentary"
];

const ScriptGenerator = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [genre, setGenre] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<Script | null>(null);

  const generateScript = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !prompt.trim() || !genre) {
      toast.error("Please fill in all fields");
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-story-script', {
        body: {
          title: title.trim(),
          description: prompt.trim(),
          genre: genre,
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setGeneratedScript(data.script);
      toast.success("Script generated successfully!");
    } catch (error: any) {
      console.error('Script generation error:', error);
      toast.error(error.message || "Failed to generate script");
    } finally {
      setGenerating(false);
    }
  };

  const saveAsProject = async () => {
    if (!generatedScript) return;
    
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: projects, error } = await supabase
        .from("projects")
        .insert([{
          title,
          description: prompt,
          genre,
          status: 'scripted',
          script: generatedScript as any,
          user_id: session.user.id
        }])
        .select();

      if (error) throw error;
      if (!projects || projects.length === 0) throw new Error("Failed to create project");

      toast.success("Script saved as project!");
      navigate(`/project/${projects[0].id}`);
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error("Failed to save project");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setGeneratedScript(null);
    setTitle("");
    setPrompt("");
    setGenre("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
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

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            AI Script Generator
          </h1>
          <p className="text-muted-foreground text-lg">
            Describe your movie idea and let AI craft a complete screenplay
          </p>
        </div>

        {!generatedScript ? (
          <Card className="shadow-lg border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                Create Your Story
              </CardTitle>
              <CardDescription>
                Provide details about your movie and we'll generate a full script with characters, scenes, and dialogue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={generateScript} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Movie Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., The Last Guardian"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={generating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="genre">Genre *</Label>
                  <Select value={genre} onValueChange={setGenre} disabled={generating}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a genre" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENRES.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prompt">Story Prompt *</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Describe your movie idea in detail. Include plot points, themes, character concepts, and any specific elements you want in your story..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={generating}
                    rows={8}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tip: The more detail you provide, the better the generated script will be
                  </p>
                </div>

                <Button 
                  type="submit" 
                  disabled={generating} 
                  size="lg" 
                  className="w-full gap-2"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Generating Script...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      Generate Script
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Action Buttons */}
            <div className="flex items-center justify-between bg-card rounded-lg border-2 p-4">
              <div className="flex items-center gap-3">
                <Film className="h-6 w-6 text-primary" />
                <div>
                  <h2 className="font-semibold">{title}</h2>
                  <p className="text-sm text-muted-foreground">Script generated successfully</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={resetForm} variant="outline">
                  Generate New Script
                </Button>
                <Button onClick={saveAsProject} disabled={saving} className="gap-2">
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save as Project
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Story Overview */}
            <Card className="border-2 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Film className="h-6 w-6 text-primary" />
                  Story Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Summary</h4>
                  <p className="text-muted-foreground">{generatedScript.story_summary}</p>
                </div>
                <Separator />
                <div className="flex flex-wrap gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Genre</h4>
                    <Badge variant="secondary">{genre}</Badge>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Theme</h4>
                    <Badge variant="outline">{generatedScript.theme}</Badge>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Duration</h4>
                    <Badge variant="outline">{generatedScript.estimated_duration}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Characters */}
            <Card className="border-2 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-6 w-6 text-primary" />
                  Characters ({generatedScript.characters.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {generatedScript.characters.map((character, index) => (
                    <div key={index} className="bg-muted/50 rounded-lg p-4 border border-border">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-primary">
                            {character.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold">{character.name}</h4>
                          <Badge variant="secondary" className="text-xs mt-1">
                            {character.role}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{character.description}</p>
                      <p className="text-xs text-muted-foreground italic">
                        <strong>Personality:</strong> {character.personality}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Scenes */}
            <Card className="border-2 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-6 w-6 text-primary" />
                  Scenes ({generatedScript.scenes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {generatedScript.scenes.map((scene) => (
                    <div key={scene.scene_number} className="border border-border rounded-lg overflow-hidden">
                      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 px-4 py-3 border-b">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                              {scene.scene_number}
                            </div>
                            <div>
                              <h4 className="font-semibold">Scene {scene.scene_number}</h4>
                              <p className="text-xs text-muted-foreground">{scene.setting}</p>
                            </div>
                          </div>
                          {scene.camera_angle && (
                            <Badge variant="outline" className="text-xs">
                              {scene.camera_angle}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="p-4 space-y-4">
                        <p className="text-sm text-muted-foreground">{scene.description}</p>
                        
                        <div className="bg-muted/30 p-3 rounded">
                          <p className="text-sm">
                            <span className="font-semibold">Action: </span>
                            {scene.action}
                          </p>
                        </div>

                        {scene.dialogue && scene.dialogue.length > 0 && (
                          <div className="space-y-2">
                            {scene.dialogue.map((line, idx) => (
                              <div key={idx} className="bg-background rounded p-3 border border-border">
                                <div className="flex items-start gap-2 mb-1">
                                  <span className="font-semibold text-sm">{line.character}</span>
                                  <Badge variant="secondary" className="text-xs">
                                    {line.emotion}
                                  </Badge>
                                </div>
                                <p className="text-sm italic text-foreground">"{line.line}"</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default ScriptGenerator;
