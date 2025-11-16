import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, description, genre } = await req.json();

    if (!title || !description || !genre) {
      throw new Error('Missing required fields: title, description, or genre');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating story script for:', { title, genre });

    const systemPrompt = `You are a creative screenwriter for animated short movies. Generate complete, engaging scripts in 2D cartoon style. Be creative, add humor, emotion, and visual descriptions.`;

    const userPrompt = `Create a complete animated short movie script (2-3 minutes) for:
Title: ${title}
Genre: ${genre}
Story Idea: ${description}

The script should include:
- 3-5 main characters with visual descriptions (appearance, clothing, personality)
- 5-8 scenes with detailed settings, camera angles, and actions
- Natural dialogue with emotional beats
- Clear story arc (beginning, conflict, resolution)
- 2D cartoon animation style descriptions

Make it engaging, visually rich, and perfect for a short animated film.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'create_story_script',
              description: 'Create a complete animated movie script with characters, scenes, and dialogue',
              parameters: {
                type: 'object',
                properties: {
                  characters: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Character name' },
                        description: { type: 'string', description: 'Visual appearance and clothing' },
                        personality: { type: 'string', description: 'Personality traits' },
                        role: { type: 'string', description: 'Role in the story (protagonist, antagonist, etc.)' }
                      },
                      required: ['name', 'description', 'personality', 'role']
                    }
                  },
                  scenes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        scene_number: { type: 'number' },
                        setting: { type: 'string', description: 'Location and time of day' },
                        description: { type: 'string', description: 'What happens visually' },
                        camera_angle: { type: 'string', description: 'Camera perspective' },
                        dialogue: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              character: { type: 'string' },
                              line: { type: 'string' },
                              emotion: { type: 'string' }
                            },
                            required: ['character', 'line', 'emotion']
                          }
                        },
                        action: { type: 'string', description: 'Character actions and movements' }
                      },
                      required: ['scene_number', 'setting', 'description', 'dialogue', 'action']
                    }
                  },
                  story_summary: { type: 'string', description: 'Brief summary of the complete story' },
                  theme: { type: 'string', description: 'Main theme or message' },
                  estimated_duration: { type: 'string', description: 'Estimated movie duration (e.g., "2-3 minutes")' }
                },
                required: ['characters', 'scenes', 'story_summary', 'theme', 'estimated_duration']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'create_story_script' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits to your Lovable workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error('Failed to generate script from AI');
    }

    const data = await response.json();
    console.log('AI Response received');

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'create_story_script') {
      throw new Error('Invalid response format from AI');
    }

    const script = JSON.parse(toolCall.function.arguments);

    console.log('Script generated successfully with', script.scenes?.length, 'scenes');

    return new Response(
      JSON.stringify({ script }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in generate-story-script:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate story script';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
