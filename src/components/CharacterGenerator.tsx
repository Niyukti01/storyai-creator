import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Character {
  name: string;
  description: string;
  imageUrl?: string;
}

interface CharacterGeneratorProps {
  projectId: string;
  script: any;
  genre: string;
  existingCharacters?: Character[];
  onCharactersUpdate: (characters: Character[]) => void;
}

export function CharacterGenerator({
  projectId,
  script,
  genre,
  existingCharacters = [],
  onCharactersUpdate,
}: CharacterGeneratorProps) {
  const [characters, setCharacters] = useState<Character[]>(existingCharacters);
  const [generatingCharacter, setGeneratingCharacter] = useState<string | null>(null);

  useEffect(() => {
    // Extract characters from script
    if (script && script.scenes) {
      const characterSet = new Set<string>();
      const characterDescriptions = new Map<string, string>();

      script.scenes.forEach((scene: any) => {
        if (scene.dialogue) {
          scene.dialogue.forEach((line: any) => {
            if (line.character) {
              characterSet.add(line.character);
              // Try to extract description from scene or dialogue context
              if (!characterDescriptions.has(line.character)) {
                characterDescriptions.set(
                  line.character,
                  `A character in a ${genre} story`
                );
              }
            }
          });
        }
      });

      const extractedCharacters = Array.from(characterSet).map((name) => {
        const existing = existingCharacters.find((c) => c.name === name);
        return (
          existing || {
            name,
            description: characterDescriptions.get(name) || `A character in a ${genre} story`,
          }
        );
      });

      setCharacters(extractedCharacters);
    }
  }, [script, genre, existingCharacters]);

  const generateCharacterImage = async (character: Character) => {
    try {
      setGeneratingCharacter(character.name);
      toast.loading(`Generating illustration for ${character.name}...`);

      const { data, error } = await supabase.functions.invoke("generate-character", {
        body: {
          characterName: character.name,
          characterDescription: character.description,
          genre,
          style: "animated movie character design",
        },
      });

      toast.dismiss();

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      const updatedCharacters = characters.map((c) =>
        c.name === character.name ? { ...c, imageUrl: data.imageUrl } : c
      );

      setCharacters(updatedCharacters);
      onCharactersUpdate(updatedCharacters);

      // Save to database
      await supabase
        .from("projects")
        .update({ avatar: { characters: updatedCharacters } as any })
        .eq("id", projectId);

      toast.success(`Illustration generated for ${character.name}!`);
    } catch (error: any) {
      console.error("Error generating character:", error);
      toast.error(error.message || "Failed to generate character illustration");
    } finally {
      setGeneratingCharacter(null);
    }
  };

  const generateAllCharacters = async () => {
    for (const character of characters) {
      if (!character.imageUrl) {
        await generateCharacterImage(character);
        // Add delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  };

  if (characters.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <User className="h-5 w-5" />
          Character Illustrations
        </h3>
        <Button
          onClick={generateAllCharacters}
          disabled={generatingCharacter !== null}
          variant="outline"
          size="sm"
        >
          {generatingCharacter ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate All
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {characters.map((character) => (
          <Card key={character.name} className="p-4 space-y-3">
            <div className="aspect-square bg-muted rounded-md overflow-hidden flex items-center justify-center">
              {character.imageUrl ? (
                <img
                  src={character.imageUrl}
                  alt={character.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="h-16 w-16 text-muted-foreground" />
              )}
            </div>
            
            <div>
              <h4 className="font-medium">{character.name}</h4>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {character.description}
              </p>
            </div>

            <Button
              onClick={() => generateCharacterImage(character)}
              disabled={generatingCharacter !== null}
              className="w-full"
              variant={character.imageUrl ? "outline" : "default"}
              size="sm"
            >
              {generatingCharacter === character.name ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {character.imageUrl ? "Regenerate" : "Generate"}
                </>
              )}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
