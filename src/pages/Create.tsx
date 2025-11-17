import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Upload, X } from "lucide-react";

const Create = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("");
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    // Check if user is logged in
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      }
    };
    checkAuth();
  }, [navigate]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (photos.length + files.length > 5) {
      toast.error("You can only upload up to 5 photos");
      return;
    }

    const validFiles = files.filter(file => {
      const isValid = file.type.startsWith('image/');
      if (!isValid) toast.error(`${file.name} is not a valid image`);
      return isValid;
    });

    setPhotos(prev => [...prev, ...validFiles]);
    
    // Create preview URLs
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreviewUrls(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async (userId: string, projectId: string): Promise<string[]> => {
    const uploadedPaths: string[] = [];

    for (const photo of photos) {
      const fileExt = photo.name.split('.').pop();
      const fileName = `${userId}/${projectId}/${crypto.randomUUID()}.${fileExt}`;

      const { error } = await supabase.storage
        .from('user-photos')
        .upload(fileName, photo);

      if (error) throw error;
      uploadedPaths.push(fileName);
    }

    return uploadedPaths;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create the project first
      const { data, error } = await supabase
        .from("projects")
        .insert([
          {
            user_id: user.id,
            title,
            description,
            genre,
            status: "draft",
            photos: [], // Initialize empty, will update after upload
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Upload photos if any
      if (photos.length > 0) {
        const photoPaths = await uploadPhotos(user.id, data.id);
        
        // Update project with photo paths
        const { error: updateError } = await supabase
          .from("projects")
          .update({ photos: photoPaths })
          .eq("id", data.id);

        if (updateError) throw updateError;
      }

      toast.success("Project created successfully!");
      navigate(`/project/${data.id}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

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

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-2">Create Your Story</h1>
          <p className="text-muted-foreground">
            Tell us your idea and let AI bring it to life
          </p>
        </div>

        <Card className="shadow-[var(--shadow-medium)]">
          <CardHeader>
            <CardTitle>Story Details</CardTitle>
            <CardDescription>
              Start by giving your story a title and describing what you want to create
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Story Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., My Adventure in Space"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="transition-shadow focus:shadow-[var(--shadow-soft)]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="genre">Genre</Label>
                <Select value={genre} onValueChange={setGenre} required>
                  <SelectTrigger className="transition-shadow focus:shadow-[var(--shadow-soft)]">
                    <SelectValue placeholder="Select a genre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="romance">Romance</SelectItem>
                    <SelectItem value="drama">Drama</SelectItem>
                    <SelectItem value="fantasy">Fantasy</SelectItem>
                    <SelectItem value="comedy">Comedy</SelectItem>
                    <SelectItem value="action">Action</SelectItem>
                    <SelectItem value="adventure">Adventure</SelectItem>
                    <SelectItem value="scifi">Sci-Fi</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Your Story Idea</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your story idea in detail. What happens? Who are the characters? What's the setting?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={6}
                  className="transition-shadow focus:shadow-[var(--shadow-soft)] resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Tip: The more details you provide, the better AI can bring your story to life
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="photos">Your Photos (1-5 photos)</Label>
                <p className="text-sm text-muted-foreground">
                  Upload photos of yourself to create a personalized character avatar
                </p>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Input
                      id="photos"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoChange}
                      disabled={photos.length >= 5}
                      className="cursor-pointer"
                    />
                    <div className="text-sm text-muted-foreground whitespace-nowrap">
                      {photos.length}/5
                    </div>
                  </div>

                  {photoPreviewUrls.length > 0 && (
                    <div className="grid grid-cols-5 gap-2">
                      {photoPreviewUrls.map((url, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={url}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-20 object-cover rounded-md border border-border"
                          />
                          <button
                            type="button"
                            onClick={() => removePhoto(index)}
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
                  className="flex-1"
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                  disabled={loading}
                >
                  {loading ? "Creating..." : "Create Story"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Create;
