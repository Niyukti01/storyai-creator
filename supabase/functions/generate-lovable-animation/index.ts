import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Starting lovable animation generation for:', projectId)

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
      .update({ 
        video_status: 'generating_lovable',
        video_progress: 0,
        video_generation_started_at: new Date().toISOString(),
        video_generation_cancelled: false
      })
      .eq('id', projectId)

    const script = project.script
    const scenes = script.scenes || []
    const characters = script.characters || []
    
    console.log(`Processing ${scenes.length} scenes with lovable animation style...`)

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured')
    }

    // Generate lovable-style images for each scene
    const sceneData: Array<{
      sceneNumber: number
      imageUrl: string
      narration: string
      audioUrl?: string
    }> = []

    const totalScenes = scenes.length

    for (let i = 0; i < totalScenes; i++) {
      // Check for cancellation
      const { data: currentProject } = await supabase
        .from('projects')
        .select('video_generation_cancelled')
        .eq('id', projectId)
        .single()

      if (currentProject?.video_generation_cancelled) {
        console.log('Lovable animation generation cancelled')
        await supabase
          .from('projects')
          .update({ 
            video_status: 'cancelled',
            video_progress: 0
          })
          .eq('id', projectId)
        
        return new Response(
          JSON.stringify({ success: false, error: 'Generation cancelled by user' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const scene = scenes[i]
      console.log(`Generating lovable scene ${scene.scene_number} (${i + 1}/${totalScenes})...`)

      // Update progress (60% for images)
      const progress = Math.floor(((i + 1) / totalScenes) * 60)
      await supabase
        .from('projects')
        .update({ video_progress: progress })
        .eq('id', projectId)

      // Get character details for this scene
      const sceneCharacters = scene.dialogue?.map((d: any) => d.character) || []
      const characterDetails = characters
        .filter((c: any) => sceneCharacters.includes(c.name))
        .map((c: any) => `${c.name}: ${c.description}`)
        .join('. ')

      // Create lovable-style image prompt
      const lovablePrompt = `Create a warm, lovable, storybook-style illustration. 
Style: Soft 2D animation, pastel colors, rounded characters with big expressive eyes, gentle facial expressions, Pixar-like warmth, fairytale charm, child-friendly, emotionally comforting.

Scene: ${scene.setting}
Description: ${scene.description}
Action: ${scene.action}
${characterDetails ? `Characters: ${characterDetails}` : ''}
Genre: ${project.genre}

The image should feel magical, cozy, and heartwarming. Use soft lighting, warm color palette, and rounded shapes. 16:9 aspect ratio, high quality illustration.`

      try {
        const imageResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                content: lovablePrompt
              }
            ],
            modalities: ['image', 'text']
          }),
        })

        if (!imageResponse.ok) {
          const errorText = await imageResponse.text()
          console.error(`Failed to generate lovable image for scene ${i + 1}:`, errorText)
          continue
        }

        const imageData = await imageResponse.json()
        const imageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url

        if (imageUrl) {
          // Build narration from scene dialogue
          const dialogueText = scene.dialogue
            ?.map((d: any) => `${d.character} said: "${d.line}"`)
            .join(' ') || ''
          
          const narration = `${scene.description}. ${dialogueText}`.trim()

          sceneData.push({
            sceneNumber: scene.scene_number,
            imageUrl,
            narration
          })
          console.log(`Lovable image generated for scene ${i + 1}`)
        }
      } catch (error) {
        console.error(`Error generating lovable image for scene ${i + 1}:`, error)
      }
    }

    console.log(`Generated ${sceneData.length} lovable scene images`)

    // Update progress - starting audio generation
    await supabase
      .from('projects')
      .update({ video_progress: 65 })
      .eq('id', projectId)

    // Generate warm narration audio using ElevenLabs if available
    if (ELEVENLABS_API_KEY && sceneData.length > 0) {
      console.log('Generating warm narration audio...')
      
      for (let i = 0; i < sceneData.length; i++) {
        const scene = sceneData[i]
        
        // Update progress (20% for audio, from 65-85)
        const progress = 65 + Math.floor(((i + 1) / sceneData.length) * 20)
        await supabase
          .from('projects')
          .update({ video_progress: progress })
          .eq('id', projectId)

        try {
          // Use a warm, friendly voice for narration
          const voiceId = 'pFZP5JQG7iQjIQuC4Bku' // Lily - warm and friendly
          
          const audioResponse = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
            {
              method: 'POST',
              headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                text: scene.narration,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                  stability: 0.6,
                  similarity_boost: 0.75,
                  style: 0.4,
                  use_speaker_boost: true,
                  speed: 0.9
                }
              }),
            }
          )

          if (audioResponse.ok) {
            const audioBuffer = await audioResponse.arrayBuffer()
            const audioFileName = `${projectId}/lovable-narration-${scene.sceneNumber}-${Date.now()}.mp3`
            
            const { error: uploadError } = await supabase.storage
              .from('generated-videos')
              .upload(audioFileName, audioBuffer, {
                contentType: 'audio/mpeg',
                upsert: true
              })

            if (!uploadError) {
              const { data: publicUrlData } = supabase.storage
                .from('generated-videos')
                .getPublicUrl(audioFileName)
              
              scene.audioUrl = publicUrlData.publicUrl
              console.log(`Narration generated for scene ${scene.sceneNumber}`)
            }
          }
        } catch (error) {
          console.error(`Error generating narration for scene ${scene.sceneNumber}:`, error)
        }
      }
    }

    // Update progress - starting video generation
    await supabase
      .from('projects')
      .update({ video_progress: 88 })
      .eq('id', projectId)

    // Generate animated video from first scene
    let videoUrl = null
    
    if (sceneData.length > 0) {
      console.log('Generating lovable animated video...')
      
      const firstScene = sceneData[0]
      const scene = scenes[0]
      
      const videoPrompt = `Gently animate this warm, lovable storybook scene. Add subtle magical movements: 
- Soft floating particles or sparkles
- Gentle swaying of elements
- Smooth, dreamy camera pan
- Cozy, heartwarming atmosphere
- Child-friendly, comforting movements
Scene: ${scene?.action || 'Gentle magical movement'}`

      try {
        const videoResponse = await fetch('https://ai.gateway.lovable.dev/v1/videos/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'veo-2.0-generate-001',
            prompt: videoPrompt,
            starting_frame: firstScene.imageUrl,
            duration: 5,
            resolution: '720p'
          }),
        })

        if (videoResponse.ok) {
          const videoData = await videoResponse.json()
          console.log('Lovable video response:', JSON.stringify(videoData).substring(0, 300))
          
          if (videoData.data?.[0]?.url) {
            const generatedVideoUrl = videoData.data[0].url
            
            const videoFetchResponse = await fetch(generatedVideoUrl)
            if (videoFetchResponse.ok) {
              const videoBlob = await videoFetchResponse.blob()
              const videoFileName = `${projectId}/lovable-animation-${Date.now()}.mp4`
              
              const { error: uploadError } = await supabase.storage
                .from('generated-videos')
                .upload(videoFileName, videoBlob, {
                  contentType: 'video/mp4',
                  upsert: true
                })

              if (!uploadError) {
                const { data: publicUrlData } = supabase.storage
                  .from('generated-videos')
                  .getPublicUrl(videoFileName)
                
                videoUrl = publicUrlData.publicUrl
                console.log('Lovable video uploaded:', videoUrl)
              }
            }
          }
        } else {
          const errorText = await videoResponse.text()
          console.error('Lovable video generation failed:', errorText)
        }
      } catch (error) {
        console.error('Error generating lovable video:', error)
      }
    }

    // Update progress
    await supabase
      .from('projects')
      .update({ video_progress: 95 })
      .eq('id', projectId)

    // Store scene data for slideshow player
    const lovableAnimationData = {
      type: 'lovable_animation',
      scenes: sceneData.map(s => ({
        sceneNumber: s.sceneNumber,
        imageUrl: s.imageUrl,
        narration: s.narration,
        audioUrl: s.audioUrl
      })),
      videoUrl,
      generatedAt: new Date().toISOString()
    }

    // Save to project avatar (extend existing data)
    const existingAvatar = project.avatar || {}
    await supabase
      .from('projects')
      .update({
        avatar: {
          ...existingAvatar,
          lovableAnimation: lovableAnimationData
        }
      })
      .eq('id', projectId)

    // Get version count
    const { data: existingVersions } = await supabase
      .from('video_versions')
      .select('version_number')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false })
      .limit(1)

    const nextVersionNumber = (existingVersions && existingVersions.length > 0) 
      ? existingVersions[0].version_number + 1 
      : 1

    // Save video version if we have a video
    if (videoUrl) {
      await supabase
        .from('video_versions')
        .insert({
          project_id: projectId,
          video_url: videoUrl,
          version_number: nextVersionNumber,
          status: 'completed',
          metadata: {
            type: 'lovable_animation',
            scenes_count: sceneData.length,
            has_narration: sceneData.some(s => s.audioUrl)
          }
        })
    }

    // Final update
    await supabase
      .from('projects')
      .update({
        video_url: videoUrl || project.video_url,
        video_status: 'lovable_completed',
        video_progress: 100,
        video_generated_at: new Date().toISOString(),
      })
      .eq('id', projectId)

    console.log('Lovable animation generation completed!')

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl,
        sceneCount: sceneData.length,
        hasNarration: sceneData.some(s => s.audioUrl),
        lovableAnimation: lovableAnimationData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    console.error('Error in generate-lovable-animation:', error)
    
    try {
      const body = await req.clone().json()
      const projectId = body.projectId
      if (projectId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)
        
        await supabase
          .from('projects')
          .update({ 
            video_status: 'failed',
            video_progress: 0
          })
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
