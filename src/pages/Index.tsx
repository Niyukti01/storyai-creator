import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Film, Wand2, Mic, Users } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkSession();
  }, [navigate]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--gradient-hero)' }}>
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-[var(--shadow-medium)] animate-pulse">
              <Sparkles className="w-10 h-10 text-primary-foreground" />
            </div>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            MyStoryAI
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Transform your ideas into personalized animated movies with AI-powered storytelling
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              size="lg" 
              onClick={() => navigate("/auth")}
              className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-lg px-8 py-6 shadow-[var(--shadow-medium)]"
            >
              Get Started Free
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate("/auth")}
              className="text-lg px-8 py-6"
            >
              Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          Bring Your Stories to Life
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <Card className="shadow-[var(--shadow-medium)] transition-all duration-300 hover:shadow-[var(--shadow-soft)] hover:-translate-y-1" style={{ background: 'var(--gradient-card)' }}>
            <CardContent className="pt-6 text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Film className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">AI Story Generator</h3>
              <p className="text-sm text-muted-foreground">
                Turn your ideas into complete scripts with characters, dialogue, and scenes
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-medium)] transition-all duration-300 hover:shadow-[var(--shadow-soft)] hover:-translate-y-1" style={{ background: 'var(--gradient-card)' }}>
            <CardContent className="pt-6 text-center">
              <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-4">
                <Users className="w-7 h-7 text-secondary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Personal Avatar</h3>
              <p className="text-sm text-muted-foreground">
                Upload your photos and become the star of your own animated movie
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-medium)] transition-all duration-300 hover:shadow-[var(--shadow-soft)] hover:-translate-y-1" style={{ background: 'var(--gradient-card)' }}>
            <CardContent className="pt-6 text-center">
              <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Mic className="w-7 h-7 text-accent" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Voice Cloning</h3>
              <p className="text-sm text-muted-foreground">
                Record your voice and hear yourself speak in the animated movie
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-medium)] transition-all duration-300 hover:shadow-[var(--shadow-soft)] hover:-translate-y-1" style={{ background: 'var(--gradient-card)' }}>
            <CardContent className="pt-6 text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Wand2 className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">2D Animation</h3>
              <p className="text-sm text-muted-foreground">
                Beautiful cartoon-style animations with customizable characters and scenes
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <Card className="max-w-3xl mx-auto shadow-[var(--shadow-medium)]" style={{ background: 'var(--gradient-card)' }}>
          <CardContent className="pt-12 pb-12">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Create Your Story?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join thousands of creators bringing their imagination to life with AI-powered animation
            </p>
            <Button 
              size="lg"
              onClick={() => navigate("/auth")}
              className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-lg px-8 py-6"
            >
              Start Creating Now
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 backdrop-blur-sm bg-background/80 mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          <p>© 2025 MyStoryAI. Create your animated story today.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
