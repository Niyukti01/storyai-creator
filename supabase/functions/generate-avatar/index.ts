import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, hairStyle, clothing, expression, accessories } = await req.json();
    
    console.log('Generating avatar for project:', projectId);
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get project with photos
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('photos, title, description')
      .eq('id', projectId)
      .single();

    if (projectError) throw projectError;

    // Build the prompt based on customization options
    const prompt = `Create a 2D cartoon character avatar in a clean, modern animation style. 
    
Character details:
- Hair style: ${hairStyle}
- Clothing: ${clothing}
- Expression: ${expression}
- Accessories: ${accessories}

Style requirements:
- Soft, rounded features
- Vibrant, appealing colors
- Professional animation quality
- Full body view
- White background
- Suitable for animated storytelling

The character should be expressive and suitable for a ${project.title} story.`;

    console.log('Generating image with prompt:', prompt);

    // Call Lovable AI image generation
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        modalities: ['image', 'text']
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your account.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error('No image generated');
    }

    console.log('Avatar generated successfully');

    // Save avatar customization to database
    const avatarData = {
      imageUrl,
      hairStyle,
      clothing,
      expression,
      accessories,
      generatedAt: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('projects')
      .update({ avatar: avatarData })
      .eq('id', projectId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ avatar: avatarData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-avatar:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate avatar';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});