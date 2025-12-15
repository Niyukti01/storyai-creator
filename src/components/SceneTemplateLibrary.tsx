import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  LayoutTemplate, 
  MessageSquare, 
  Zap, 
  Star, 
  Heart, 
  Sunset,
  Users,
  Sparkles,
  Drama,
  Plus
} from "lucide-react";

interface Dialogue {
  character: string;
  line: string;
  emotion: string;
}

interface SceneTemplate {
  id: string;
  name: string;
  category: string;
  icon: React.ReactNode;
  description: string;
  setting: string;
  sceneDescription: string;
  camera_angle: string;
  dialogue: Dialogue[];
  action: string;
}

interface SceneTemplateLibraryProps {
  onInsertTemplate: (template: Omit<SceneTemplate, "id" | "name" | "category" | "icon" | "description">) => void;
}

const sceneTemplates: SceneTemplate[] = [
  {
    id: "intro-establishing",
    name: "Establishing Shot",
    category: "Introduction",
    icon: <Sunset className="h-5 w-5" />,
    description: "A wide establishing shot to set the scene and mood",
    setting: "Exterior - [Location] - [Time of Day]",
    sceneDescription: "The camera slowly pans across the landscape, revealing the setting. The atmosphere is [mood], with [weather/lighting conditions] creating a sense of [emotion].",
    camera_angle: "Wide establishing shot, slow pan",
    dialogue: [],
    action: "The scene opens with ambient sounds of the environment. Natural elements move gently as the camera reveals the location.",
  },
  {
    id: "intro-character",
    name: "Character Introduction",
    category: "Introduction",
    icon: <Users className="h-5 w-5" />,
    description: "Introduce a main character with impact",
    setting: "Interior/Exterior - [Character's Domain]",
    sceneDescription: "We first see [CHARACTER] from behind, silhouetted against the light. As they turn, their face is revealed, showing determination and purpose.",
    camera_angle: "Medium shot, slow zoom to close-up",
    dialogue: [
      { character: "[CHARACTER]", line: "[Memorable introduction line]", emotion: "confident" }
    ],
    action: "[CHARACTER] enters the frame with purpose, their presence commanding attention. They pause, taking in their surroundings before speaking.",
  },
  {
    id: "dialogue-conversation",
    name: "Two-Person Conversation",
    category: "Dialogue",
    icon: <MessageSquare className="h-5 w-5" />,
    description: "Classic back-and-forth dialogue between two characters",
    setting: "Interior - [Location] - Day",
    sceneDescription: "Two characters face each other, the tension/comfort between them palpable. The setting reflects their relationship dynamic.",
    camera_angle: "Shot-reverse-shot, medium close-ups",
    dialogue: [
      { character: "[CHARACTER A]", line: "[Opening statement or question]", emotion: "curious" },
      { character: "[CHARACTER B]", line: "[Response that reveals character]", emotion: "thoughtful" },
      { character: "[CHARACTER A]", line: "[Reaction or follow-up]", emotion: "surprised" }
    ],
    action: "The characters maintain eye contact, their body language revealing unspoken emotions. Small gestures punctuate their words.",
  },
  {
    id: "dialogue-revelation",
    name: "Dramatic Revelation",
    category: "Dialogue",
    icon: <Drama className="h-5 w-5" />,
    description: "A scene where important information is revealed",
    setting: "Interior - [Private Space] - [Tense Atmosphere]",
    sceneDescription: "The air is thick with anticipation. [CHARACTER] prepares to share something that will change everything.",
    camera_angle: "Close-up on faces, dramatic lighting",
    dialogue: [
      { character: "[CHARACTER A]", line: "There's something I need to tell you...", emotion: "nervous" },
      { character: "[CHARACTER B]", line: "What is it?", emotion: "concerned" },
      { character: "[CHARACTER A]", line: "[The revelation]", emotion: "emotional" }
    ],
    action: "A heavy silence follows the revelation. [CHARACTER B]'s expression shifts as they process the information. The camera lingers on their reaction.",
  },
  {
    id: "action-chase",
    name: "Chase Sequence",
    category: "Action",
    icon: <Zap className="h-5 w-5" />,
    description: "High-energy pursuit through dynamic environments",
    setting: "Exterior - [Urban/Rural Environment] - Night",
    sceneDescription: "Chaos erupts as [CHARACTER] flees through the environment. Every corner brings new obstacles and dangers.",
    camera_angle: "Dynamic tracking shots, quick cuts",
    dialogue: [
      { character: "[PURSUER]", line: "You can't run forever!", emotion: "aggressive" }
    ],
    action: "[CHARACTER] sprints through the environment, dodging obstacles and making split-second decisions. The pursuers are close behind, the gap narrowing with each passing moment.",
  },
  {
    id: "action-confrontation",
    name: "Physical Confrontation",
    category: "Action",
    icon: <Sparkles className="h-5 w-5" />,
    description: "A tense face-off that escalates to action",
    setting: "Interior/Exterior - [Battleground]",
    sceneDescription: "The two opponents circle each other, each waiting for the perfect moment to strike. The tension is electric.",
    camera_angle: "Wide shot for choreography, close-ups for impact",
    dialogue: [
      { character: "[HERO]", line: "This ends now.", emotion: "determined" },
      { character: "[ANTAGONIST]", line: "I couldn't agree more.", emotion: "menacing" }
    ],
    action: "They clash in a flurry of movement. The fight is brutal and personal, each blow carrying the weight of their conflict. The environment becomes part of the battle.",
  },
  {
    id: "climax-final",
    name: "Final Showdown",
    category: "Climax",
    icon: <Star className="h-5 w-5" />,
    description: "The ultimate confrontation where everything is decided",
    setting: "Interior/Exterior - [Symbolic Location]",
    sceneDescription: "This is the moment everything has been building toward. [HERO] faces [ANTAGONIST] one final time, with everything on the line.",
    camera_angle: "Epic wide shots, intimate close-ups",
    dialogue: [
      { character: "[HERO]", line: "[Declaration of purpose/values]", emotion: "resolute" },
      { character: "[ANTAGONIST]", line: "[Counter-argument or threat]", emotion: "confident" },
      { character: "[HERO]", line: "[Final decisive statement]", emotion: "powerful" }
    ],
    action: "The final battle begins. Every skill learned, every relationship forged, comes into play. The outcome will determine the fate of everyone.",
  },
  {
    id: "climax-emotional",
    name: "Emotional Peak",
    category: "Climax",
    icon: <Heart className="h-5 w-5" />,
    description: "An emotionally charged moment of truth",
    setting: "Interior - [Meaningful Location]",
    sceneDescription: "Years of emotions come to the surface. This is the moment of truth that [CHARACTER] has been avoiding or building toward.",
    camera_angle: "Intimate close-ups, shallow depth of field",
    dialogue: [
      { character: "[CHARACTER A]", line: "[Vulnerable confession or declaration]", emotion: "emotional" },
      { character: "[CHARACTER B]", line: "[Genuine response from the heart]", emotion: "moved" }
    ],
    action: "Tears flow freely. The characters embrace or share a meaningful gesture. Time seems to stop as they finally understand each other.",
  },
];

const categories = ["Introduction", "Dialogue", "Action", "Climax"];

export const SceneTemplateLibrary = ({ onInsertTemplate }: SceneTemplateLibraryProps) => {
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredTemplates = selectedCategory
    ? sceneTemplates.filter((t) => t.category === selectedCategory)
    : sceneTemplates;

  const handleInsert = (template: SceneTemplate) => {
    onInsertTemplate({
      setting: template.setting,
      sceneDescription: template.sceneDescription,
      camera_angle: template.camera_angle,
      dialogue: template.dialogue,
      action: template.action,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <LayoutTemplate className="h-4 w-4" />
          Scene Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-primary" />
            Scene Template Library
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={selectedCategory === null ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedCategory(null)}
            >
              All
            </Badge>
            {categories.map((category) => (
              <Badge
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Badge>
            ))}
          </div>

          <ScrollArea className="h-[50vh]">
            <div className="grid gap-4 pr-4">
              {filteredTemplates.map((template) => (
                <Card
                  key={template.id}
                  className="hover:border-primary/50 transition-colors cursor-pointer group"
                  onClick={() => handleInsert(template)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          {template.icon}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{template.name}</h4>
                            <Badge variant="secondary" className="text-xs">
                              {template.category}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {template.description}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {template.camera_angle.split(",")[0]}
                            </Badge>
                            {template.dialogue.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {template.dialogue.length} dialogue line{template.dialogue.length > 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>

          <p className="text-xs text-muted-foreground text-center">
            Click a template to insert it as a new scene. Placeholders in [brackets] should be customized.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
