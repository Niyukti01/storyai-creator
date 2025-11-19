import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, User } from "lucide-react";
import { VoiceRecorder } from "@/components/VoiceRecorder";

interface Avatar {
  imageUrl: string;
  hairStyle: string;
  clothing: string;
  expression: string;
  accessories: string;
}

const CharacterCustomization = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [project, setProject] = useState<any>(null);
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  
  const [hairStyle, setHairStyle] = useState("short and neat");
  const [clothing, setClothing] = useState("casual shirt");
  const [expression, setExpression] = useState("friendly smile");
  const [accessories, setAccessories] = useState("none");

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
      setProject(data);

      if (data.avatar) {
        const avatarData = data.avatar as any;
        setAvatar(avatarData);
        setHairStyle(avatarData.hairStyle || "short and neat");
        setClothing(avatarData.clothing || "casual shirt");
        setExpression(avatarData.expression || "friendly smile");
        setAccessories(avatarData.accessories || "none");
      }
    } catch (error: any) {
      toast.error("Failed to load project");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const generateAvatar = async () => {
    if (!project) return;

    if (!project.photos || project.photos.length === 0) {
      toast.error("Please upload photos first");
      navigate(`/project/${id}`);
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-avatar', {
        body: {
          projectId: id,
          hairStyle,
          clothing,
          expression,
          accessories
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setAvatar(data.avatar);
      toast.success("Avatar generated successfully!");
    } catch (error: any) {
      console.error('Avatar generation error:', error);
      toast.error(error.message || "Failed to generate avatar");
    } finally {
      setGenerating(false);
    }
  };

  const handleVoiceRecording = async (audioBlob: Blob) => {
    if (!id) return;
    
    setUploadingVoice(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileName = `${user.id}/${id}/voice-sample-${Date.now()}.webm`;
      
      const { error: uploadError } = await supabase.storage
        .from('voice-samples')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('voice-samples')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('projects')
        .update({ voice_sample_url: publicUrl })
        .eq('id', id);

      if (updateError) throw updateError;

      await loadProject();
      
      toast.success("Voice sample saved! This will be used for character dialogue.");
    } catch (error: any) {
      console.error('Error uploading voice:', error);
      toast.error(error.message || "Failed to save voice recording");
    } finally {
      setUploadingVoice(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <User className="w-12 h-12 mx-auto mb-4 text-primary animate-pulse" />
          <p className="text-muted-foreground">Loading character customization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--gradient-hero)' }}>
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80">
        <div className="container mx-auto px-4 py-4">
          <Button
            onClick={() => navigate(`/project/${id}`)}
            variant="ghost"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Project
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <User className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-2">Character Customization</h1>
          <p className="text-muted-foreground">
            Create and customize your animated avatar
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Avatar Preview */}
          <Card className="shadow-[var(--shadow-medium)]">
            <CardHeader>
              <CardTitle>Avatar Preview</CardTitle>
              <CardDescription>
                Your personalized 2D cartoon character
              </CardDescription>
            </CardHeader>
            <CardContent>
              {avatar ? (
                <div className="space-y-4">
                  <img
                    src={avatar.imageUrl}
                    alt="Character Avatar"
                    className="w-full rounded-lg border border-border"
                  />
                  <p className="text-sm text-muted-foreground text-center">
                    Generated avatar ready for your story
                  </p>
                </div>
              ) : (
                <div className="aspect-square bg-muted rounded-lg flex flex-col items-center justify-center p-8 text-center">
                  <User className="w-16 h-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">
                    No avatar generated yet
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Customize your character below and click Generate
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customization Options */}
          <Card className="shadow-[var(--shadow-medium)]">
            <CardHeader>
              <CardTitle>Customize Appearance</CardTitle>
              <CardDescription>
                Choose hair, clothing, expression, and accessories
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="hairStyle">Hair Style</Label>
                <Select value={hairStyle} onValueChange={setHairStyle}>
                  <SelectTrigger id="hairStyle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short and neat">Short and Neat</SelectItem>
                    <SelectItem value="long and flowing">Long and Flowing</SelectItem>
                    <SelectItem value="spiky and wild">Spiky and Wild</SelectItem>
                    <SelectItem value="curly and bouncy">Curly and Bouncy</SelectItem>
                    <SelectItem value="bald">Bald</SelectItem>
                    <SelectItem value="ponytail">Ponytail</SelectItem>
                    <SelectItem value="braided">Braided</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="clothing">Clothing</Label>
                <Select value={clothing} onValueChange={setClothing}>
                  <SelectTrigger id="clothing">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual shirt">Casual Shirt</SelectItem>
                    <SelectItem value="formal suit">Formal Suit</SelectItem>
                    <SelectItem value="t-shirt and jeans">T-Shirt and Jeans</SelectItem>
                    <SelectItem value="superhero costume">Superhero Costume</SelectItem>
                    <SelectItem value="medieval outfit">Medieval Outfit</SelectItem>
                    <SelectItem value="futuristic jumpsuit">Futuristic Jumpsuit</SelectItem>
                    <SelectItem value="wizard robes">Wizard Robes</SelectItem>
                    <SelectItem value="sports uniform">Sports Uniform</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expression">Expression</Label>
                <Select value={expression} onValueChange={setExpression}>
                  <SelectTrigger id="expression">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="friendly smile">Friendly Smile</SelectItem>
                    <SelectItem value="serious and determined">Serious and Determined</SelectItem>
                    <SelectItem value="happy and excited">Happy and Excited</SelectItem>
                    <SelectItem value="confident smirk">Confident Smirk</SelectItem>
                    <SelectItem value="surprised">Surprised</SelectItem>
                    <SelectItem value="thoughtful">Thoughtful</SelectItem>
                    <SelectItem value="playful">Playful</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accessories">Accessories</Label>
                <Select value={accessories} onValueChange={setAccessories}>
                  <SelectTrigger id="accessories">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="glasses">Glasses</SelectItem>
                    <SelectItem value="hat">Hat</SelectItem>
                    <SelectItem value="earrings">Earrings</SelectItem>
                    <SelectItem value="necklace">Necklace</SelectItem>
                    <SelectItem value="scarf">Scarf</SelectItem>
                    <SelectItem value="headband">Headband</SelectItem>
                    <SelectItem value="watch">Watch</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={generateAvatar}
                disabled={generating}
                className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                size="lg"
              >
                {generating ? (
                  <>Generating Avatar...</>
                ) : avatar ? (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Regenerate Avatar
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate Avatar
                  </>
                )}
              </Button>

              {generating && (
                <div className="flex items-center justify-center gap-2 text-primary">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse delay-75" />
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse delay-150" />
                  <span className="ml-2 text-sm">AI is creating your character...</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Voice Recording</CardTitle>
              <CardDescription>
                Record a sentence in your voice. This will be used for AI voice cloning to create character dialogue throughout your movie.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <VoiceRecorder 
                onRecordingComplete={handleVoiceRecording}
                isUploading={uploadingVoice}
              />
              {project?.voice_sample_url && (
                <div className="p-4 border rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground mb-2">Current voice sample:</p>
                  <audio src={project.voice_sample_url} controls className="w-full" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default CharacterCustomization;