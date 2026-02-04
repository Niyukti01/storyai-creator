import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SceneVideoData {
  sceneNumber: number
  imageUrl: string
  videoUrl: string
  narration: string
  audioUrl?: string
  duration: number
}

// Helper to generate video from image for a scene
async function generateSceneVideo(
  imageUrl: string, 
  sceneDescription: string,
  apiKey: string
): Promise<{ videoUrl: string; duration: number } | null> {
  const videoPrompt = `Gently animate this warm, lovable storybook scene with smooth, magical movements:
- Soft floating particles and sparkles
- Gentle swaying of elements like trees, grass, fabric
- Subtle character breathing and eye blinks
- Smooth, dreamy slow camera movement
- Cozy, heartwarming atmosphere
- Child-friendly, comforting gentle movements
Scene action: ${sceneDescription}
Style: Soft 2D animation, Pixar-like warmth, storybook magic`

  try {
    console.log('Requesting video generation for scene...')
    
    const videoResponse = await fetch('https://ai.gateway.lovable.dev/v1/videos/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'veo-2.0-generate-001',
        prompt: videoPrompt,
        starting_frame: imageUrl,
        duration: 5,
        resolution: '720p'
      }),
    })

    if (!videoResponse.ok) {
      const errorText = await videoResponse.text()
      console.error('Video generation failed:', errorText)
      return null
    }

    const videoData = await videoResponse.json()
    console.log('Video generation response received')
    
    if (videoData.data?.[0]?.url) {
      return {
        videoUrl: videoData.data[0].url,
        duration: 5
      }
    }
    
    return null
  } catch (error) {
    console.error('Error generating scene video:', error)
    return null
  }
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

    console.log('Starting REAL animated video generation for:', projectId)

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
    
    console.log(`Processing ${scenes.length} scenes for REAL animated video...`)

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured')
    }

    // Store all scene data with videos
    const sceneVideoData: SceneVideoData[] = []
    const totalScenes = scenes.length
    
    // Phase 1: Generate images for all scenes (0-30%)
    console.log('=== PHASE 1: Generating scene images ===')
    const sceneImages: Array<{ sceneNumber: number; imageUrl: string; scene: any }> = []
    
    for (let i = 0; i < totalScenes; i++) {
      // Check for cancellation
      const { data: currentProject } = await supabase
        .from('projects')
        .select('video_generation_cancelled')
        .eq('id', projectId)
        .single()

      if (currentProject?.video_generation_cancelled) {
        console.log('Animation generation cancelled by user')
        await supabase
          .from('projects')
          .update({ video_status: 'cancelled', video_progress: 0 })
          .eq('id', projectId)
        
        return new Response(
          JSON.stringify({ success: false, error: 'Generation cancelled by user' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const scene = scenes[i]
      console.log(`Generating image for scene ${scene.scene_number} (${i + 1}/${totalScenes})...`)

      const progress = Math.floor(((i + 1) / totalScenes) * 30)
      await supabase
        .from('projects')
        .update({ video_progress: progress })
        .eq('id', projectId)

      // Get character details
      const sceneCharacters = scene.dialogue?.map((d: any) => d.character) || []
      const characterDetails = characters
        .filter((c: any) => sceneCharacters.includes(c.name))
        .map((c: any) => `${c.name}: ${c.description}`)
        .join('. ')

      // Create lovable-style image prompt
      const lovablePrompt = `Create a warm, lovable, storybook-style illustration for animation.
Style: Soft 2D animation style, pastel colors, rounded characters with big expressive eyes, gentle facial expressions, Pixar-like warmth, fairytale charm, child-friendly, emotionally comforting.

Scene: ${scene.setting}
Description: ${scene.description}
Action: ${scene.action}
${characterDetails ? `Characters: ${characterDetails}` : ''}
Genre: ${project.genre}

The image should feel magical, cozy, and heartwarming. Use soft lighting, warm color palette, and rounded shapes. 16:9 aspect ratio, high quality illustration suitable for animation.`

      try {
        const imageResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-image-preview',
            messages: [{ role: 'user', content: lovablePrompt }],
            modalities: ['image', 'text']
          }),
        })

        if (imageResponse.ok) {
          const imageData = await imageResponse.json()
          const imageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url

          if (imageUrl) {
            sceneImages.push({
              sceneNumber: scene.scene_number,
              imageUrl,
              scene
            })
            console.log(`Image generated for scene ${scene.scene_number}`)
          }
        }
      } catch (error) {
        console.error(`Error generating image for scene ${i + 1}:`, error)
      }
    }

    console.log(`Generated ${sceneImages.length} scene images`)

    // Phase 2: Generate videos for each scene image (30-70%)
    console.log('=== PHASE 2: Generating animated videos for each scene ===')
    
    for (let i = 0; i < sceneImages.length; i++) {
      const { sceneNumber, imageUrl, scene } = sceneImages[i]
      
      const progress = 30 + Math.floor(((i + 1) / sceneImages.length) * 40)
      await supabase
        .from('projects')
        .update({ video_progress: progress })
        .eq('id', projectId)

      console.log(`Generating video for scene ${sceneNumber} (${i + 1}/${sceneImages.length})...`)

      const videoResult = await generateSceneVideo(
        imageUrl,
        scene.action || scene.description,
        LOVABLE_API_KEY
      )

      // Build narration from scene
      const dialogueText = scene.dialogue
        ?.map((d: any) => `${d.character} said: "${d.line}"`)
        .join(' ') || ''
      
      const narration = `${scene.description}. ${dialogueText}`.trim()

      if (videoResult) {
        sceneVideoData.push({
          sceneNumber,
          imageUrl,
          videoUrl: videoResult.videoUrl,
          narration,
          duration: videoResult.duration
        })
        console.log(`Video generated for scene ${sceneNumber}`)
      } else {
        // Fallback: use image as video placeholder
        sceneVideoData.push({
          sceneNumber,
          imageUrl,
          videoUrl: '', // Will use image slideshow for this scene
          narration,
          duration: 5
        })
        console.log(`Using image fallback for scene ${sceneNumber}`)
      }
    }

    console.log(`Generated ${sceneVideoData.filter(s => s.videoUrl).length} scene videos`)

    // Phase 3: Generate narration audio for each scene (70-85%)
    console.log('=== PHASE 3: Generating warm narration audio ===')
    
    if (ELEVENLABS_API_KEY && sceneVideoData.length > 0) {
      for (let i = 0; i < sceneVideoData.length; i++) {
        const sceneData = sceneVideoData[i]
        
        const progress = 70 + Math.floor(((i + 1) / sceneVideoData.length) * 15)
        await supabase
          .from('projects')
          .update({ video_progress: progress })
          .eq('id', projectId)

        console.log(`Generating narration for scene ${sceneData.sceneNumber}...`)

        try {
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
                text: sceneData.narration,
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
            const audioFileName = `${projectId}/lovable-narration-${sceneData.sceneNumber}-${Date.now()}.mp3`
            
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
              
              sceneData.audioUrl = publicUrlData.publicUrl
              console.log(`Narration generated for scene ${sceneData.sceneNumber}`)
            }
          }
        } catch (error) {
          console.error(`Error generating narration for scene ${sceneData.sceneNumber}:`, error)
        }
      }
    }

    // Phase 4: Upload scene videos and create final video data (85-95%)
    console.log('=== PHASE 4: Uploading scene videos ===')
    
    await supabase
      .from('projects')
      .update({ video_progress: 88 })
      .eq('id', projectId)

    const uploadedSceneVideos: SceneVideoData[] = []
    
    for (const sceneData of sceneVideoData) {
      if (sceneData.videoUrl && sceneData.videoUrl.startsWith('http')) {
        try {
          console.log(`Uploading video for scene ${sceneData.sceneNumber}...`)
          
          const videoFetchResponse = await fetch(sceneData.videoUrl)
          if (videoFetchResponse.ok) {
            const videoBlob = await videoFetchResponse.blob()
            const videoFileName = `${projectId}/scene-${sceneData.sceneNumber}-${Date.now()}.mp4`
            
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
              
              uploadedSceneVideos.push({
                ...sceneData,
                videoUrl: publicUrlData.publicUrl
              })
              console.log(`Scene ${sceneData.sceneNumber} video uploaded`)
            } else {
              uploadedSceneVideos.push(sceneData)
            }
          } else {
            uploadedSceneVideos.push(sceneData)
          }
        } catch (error) {
          console.error(`Error uploading scene ${sceneData.sceneNumber} video:`, error)
          uploadedSceneVideos.push(sceneData)
        }
      } else {
        uploadedSceneVideos.push(sceneData)
      }
    }

    await supabase
      .from('projects')
      .update({ video_progress: 95 })
      .eq('id', projectId)

    // Calculate total video duration
    const totalDuration = uploadedSceneVideos.reduce((sum, s) => sum + s.duration, 0)
    const videosGenerated = uploadedSceneVideos.filter(s => s.videoUrl).length

    // Store complete animation data
    const lovableAnimationData = {
      type: 'lovable_animation',
      scenes: uploadedSceneVideos.map(s => ({
        sceneNumber: s.sceneNumber,
        imageUrl: s.imageUrl,
        videoUrl: s.videoUrl,
        narration: s.narration,
        audioUrl: s.audioUrl,
        duration: s.duration
      })),
      totalDuration,
      videosGenerated,
      totalScenes: uploadedSceneVideos.length,
      isFullAnimation: videosGenerated === uploadedSceneVideos.length,
      generatedAt: new Date().toISOString()
    }

    // Save to project avatar
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

    // Get main video URL (first scene with video)
    const mainVideoUrl = uploadedSceneVideos.find(s => s.videoUrl)?.videoUrl || null

    // Create video version record
    const { data: existingVersions } = await supabase
      .from('video_versions')
      .select('version_number')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false })
      .limit(1)

    const nextVersionNumber = (existingVersions && existingVersions.length > 0) 
      ? existingVersions[0].version_number + 1 
      : 1

    if (mainVideoUrl) {
      await supabase
        .from('video_versions')
        .insert({
          project_id: projectId,
          video_url: mainVideoUrl,
          version_number: nextVersionNumber,
          status: 'completed',
          duration_seconds: totalDuration,
          metadata: {
            type: 'lovable_animation',
            scenes_count: uploadedSceneVideos.length,
            videos_generated: videosGenerated,
            has_narration: uploadedSceneVideos.some(s => s.audioUrl),
            is_full_animation: videosGenerated === uploadedSceneVideos.length
          }
        })
    }

    // Final update
    await supabase
      .from('projects')
      .update({
        video_url: mainVideoUrl || project.video_url,
        video_status: 'lovable_completed',
        video_progress: 100,
        video_generated_at: new Date().toISOString(),
      })
      .eq('id', projectId)

    console.log('=== REAL ANIMATED VIDEO GENERATION COMPLETED ===')
    console.log(`Total scenes: ${uploadedSceneVideos.length}`)
    console.log(`Videos generated: ${videosGenerated}`)
    console.log(`Total duration: ${totalDuration} seconds`)

    return new Response(
      JSON.stringify({
        success: true,
        mainVideoUrl,
        totalScenes: uploadedSceneVideos.length,
        videosGenerated,
        totalDuration,
        hasNarration: uploadedSceneVideos.some(s => s.audioUrl),
        isFullAnimation: videosGenerated === uploadedSceneVideos.length,
        lovableAnimation: lovableAnimationData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
          .update({ video_status: 'failed', video_progress: 0 })
          .eq('id', projectId)
      }
    } catch (updateError) {
      console.error('Failed to update error status:', updateError)
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
