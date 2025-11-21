import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { projectId } = await req.json()

    if (!projectId) {
      throw new Error('Project ID is required')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Fetching project data for:', projectId)

    // Fetch project data
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      throw new Error('Project not found')
    }

    if (!project.script) {
      throw new Error('Project does not have a script')
    }

    // Update status to generating
    await supabase
      .from('projects')
      .update({ video_status: 'generating' })
      .eq('id', projectId)

    console.log('Starting video generation process...')

    // Prepare video data
    const script = project.script
    const scenes = script.scenes || []
    
    console.log(`Processing ${scenes.length} scenes...`)

    // Generate images for each scene using Lovable AI
    const sceneImages: string[] = []
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]
      console.log(`Generating image for scene ${scene.scene_number}...`)

      // Create prompt for scene illustration
      const imagePrompt = `Create a ${project.genre} style illustration for: ${scene.description}. Setting: ${scene.setting}. ${scene.action}. High quality, cinematic, detailed.`

      try {
        // Use Lovable AI to generate scene image
        const imageResponse = await fetch('https://ai.gateway.lovable.dev/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-image',
            prompt: imagePrompt,
            n: 1,
            size: '1920x1080',
          }),
        })

        if (!imageResponse.ok) {
          console.error(`Failed to generate image for scene ${i + 1}`)
          continue
        }

        const imageData = await imageResponse.json()
        if (imageData.data && imageData.data[0] && imageData.data[0].url) {
          sceneImages.push(imageData.data[0].url)
          console.log(`Image generated for scene ${i + 1}`)
        }
      } catch (error) {
        console.error(`Error generating image for scene ${i + 1}:`, error)
      }
    }

    console.log(`Generated ${sceneImages.length} scene images`)

    // Generate audio narration for dialogue
    // This would use text-to-speech API (OpenAI, ElevenLabs, etc.)
    // For now, we'll prepare the data structure

    const audioSegments = []
    for (const scene of scenes) {
      if (scene.dialogue && scene.dialogue.length > 0) {
        for (const line of scene.dialogue) {
          audioSegments.push({
            character: line.character,
            text: line.line,
            emotion: line.emotion,
          })
        }
      }
    }

    console.log(`Prepared ${audioSegments.length} audio segments`)

    // Create video composition data
    const videoComposition = {
      title: project.title,
      genre: project.genre,
      duration: script.estimated_duration,
      scenes: scenes.map((scene: any, index: number) => ({
        sceneNumber: scene.scene_number,
        imageUrl: sceneImages[index] || null,
        description: scene.description,
        setting: scene.setting,
        action: scene.action,
        dialogue: scene.dialogue,
        duration: 5, // seconds per scene
      })),
      avatar: project.avatar,
      voiceSample: project.voice_sample_url,
      audioSegments,
      musicTrack: project.music_track || null,
    }

    console.log('Video composition prepared')
    if (project.music_track) {
      console.log('Music track included in composition:', project.music_track)
    }
    const mockVideoUrl = `https://placeholder-video.com/${projectId}-${Date.now()}.mp4`

    console.log('Video generation simulated, storing result...')

    // Update project with video URL
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        video_url: mockVideoUrl,
        video_status: 'completed',
        video_generated_at: new Date().toISOString(),
      })
      .eq('id', projectId)

    if (updateError) {
      throw updateError
    }

    console.log('Video generation completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl: mockVideoUrl,
        composition: videoComposition,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    console.error('Error in generate-video function:', error)
    
    // Try to update status to failed if we have projectId
    try {
      const { projectId } = await req.json()
      if (projectId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)
        
        await supabase
          .from('projects')
          .update({ video_status: 'failed' })
          .eq('id', projectId)
      }
    } catch (updateError) {
      console.error('Failed to update error status:', updateError)
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
