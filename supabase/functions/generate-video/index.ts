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

    // Update status to generating and initialize progress
    await supabase
      .from('projects')
      .update({ 
        video_status: 'generating',
        video_progress: 0,
        video_generation_started_at: new Date().toISOString(),
        video_generation_cancelled: false
      })
      .eq('id', projectId)

    console.log('Starting video generation process...')

    // Prepare video data
    const script = project.script
    const scenes = script.scenes || []
    
    console.log(`Processing ${scenes.length} scenes...`)

    // Generate images for each scene using Lovable AI
    const sceneImages: string[] = []
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured')
    }

    const totalScenes = scenes.length
    for (let i = 0; i < totalScenes; i++) {
      // Check if generation was cancelled
      const { data: currentProject } = await supabase
        .from('projects')
        .select('video_generation_cancelled')
        .eq('id', projectId)
        .single()

      if (currentProject?.video_generation_cancelled) {
        console.log('Video generation cancelled by user')
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
      console.log(`Generating image for scene ${scene.scene_number} (${i + 1}/${totalScenes})...`)

      // Update progress (image generation is 70% of the work)
      const progress = Math.floor(((i + 1) / totalScenes) * 70)
      await supabase
        .from('projects')
        .update({ video_progress: progress })
        .eq('id', projectId)

      // Create prompt for scene illustration
      const imagePrompt = `Create a ${project.genre} style illustration for: ${scene.description}. Setting: ${scene.setting}. ${scene.action}. High quality, cinematic, detailed, 16:9 aspect ratio.`

      try {
        // Use Lovable AI to generate scene image
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
                content: imagePrompt
              }
            ],
            modalities: ['image', 'text']
          }),
        })

        if (!imageResponse.ok) {
          const errorText = await imageResponse.text()
          console.error(`Failed to generate image for scene ${i + 1}:`, errorText)
          continue
        }

        const imageData = await imageResponse.json()
        console.log(`Image response for scene ${i + 1}:`, JSON.stringify(imageData).substring(0, 200))
        
        // Extract image from the response
        const imageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url
        if (imageUrl) {
          sceneImages.push(imageUrl)
          console.log(`Image generated for scene ${i + 1}`)
        } else {
          console.error(`No image URL in response for scene ${i + 1}`)
        }
      } catch (error) {
        console.error(`Error generating image for scene ${i + 1}:`, error)
      }
    }

    console.log(`Generated ${sceneImages.length} scene images`)

    // Update progress - starting video generation
    await supabase
      .from('projects')
      .update({ video_progress: 75 })
      .eq('id', projectId)

    // Now generate a video from the first scene image using Lovable AI
    let videoUrl = null
    
    if (sceneImages.length > 0) {
      console.log('Generating video from scene images...')
      
      // Use the first scene image to generate an animated video
      const firstSceneImage = sceneImages[0]
      const videoPrompt = `Animate this scene with gentle movement, cinematic panning, subtle character animations. ${scenes[0]?.action || 'Smooth camera movement.'}`
      
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
            starting_frame: firstSceneImage,
            duration: 5,
            resolution: '720p'
          }),
        })

        if (videoResponse.ok) {
          const videoData = await videoResponse.json()
          console.log('Video generation response:', JSON.stringify(videoData).substring(0, 500))
          
          if (videoData.data?.[0]?.url) {
            const generatedVideoUrl = videoData.data[0].url
            
            // Download the video and upload to Supabase storage
            const videoFetchResponse = await fetch(generatedVideoUrl)
            if (videoFetchResponse.ok) {
              const videoBlob = await videoFetchResponse.blob()
              const videoFileName = `${projectId}/${Date.now()}.mp4`
              
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('generated-videos')
                .upload(videoFileName, videoBlob, {
                  contentType: 'video/mp4',
                  upsert: true
                })

              if (uploadError) {
                console.error('Error uploading video:', uploadError)
              } else {
                // Get public URL
                const { data: publicUrlData } = supabase.storage
                  .from('generated-videos')
                  .getPublicUrl(videoFileName)
                
                videoUrl = publicUrlData.publicUrl
                console.log('Video uploaded successfully:', videoUrl)
              }
            }
          }
        } else {
          const errorText = await videoResponse.text()
          console.error('Video generation failed:', errorText)
        }
      } catch (error) {
        console.error('Error generating video:', error)
      }
    }

    // Update progress
    await supabase
      .from('projects')
      .update({ video_progress: 95 })
      .eq('id', projectId)

    // If video generation failed, create a slideshow from images
    if (!videoUrl && sceneImages.length > 0) {
      console.log('Video generation unavailable, using first scene image as preview')
      
      // Upload first image as a fallback preview
      const firstImage = sceneImages[0]
      if (firstImage.startsWith('data:image')) {
        try {
          const base64Data = firstImage.split(',')[1]
          const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
          const imageFileName = `${projectId}/preview-${Date.now()}.png`
          
          const { error: uploadError } = await supabase.storage
            .from('generated-videos')
            .upload(imageFileName, imageBytes, {
              contentType: 'image/png',
              upsert: true
            })

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from('generated-videos')
              .getPublicUrl(imageFileName)
            
            // Store images in project avatar for slideshow
            await supabase
              .from('projects')
              .update({
                avatar: {
                  ...project.avatar,
                  sceneImages: sceneImages.slice(0, 5) // Store first 5 scene images
                }
              })
              .eq('id', projectId)
            
            console.log('Preview image uploaded:', publicUrlData.publicUrl)
          }
        } catch (error) {
          console.error('Error uploading preview image:', error)
        }
      }
    }

    // Get current version count
    const { data: existingVersions } = await supabase
      .from('video_versions')
      .select('version_number')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false })
      .limit(1)

    const nextVersionNumber = (existingVersions && existingVersions.length > 0) 
      ? existingVersions[0].version_number + 1 
      : 1

    // Save video version to history if we have a video URL
    if (videoUrl) {
      const { error: versionError } = await supabase
        .from('video_versions')
        .insert({
          project_id: projectId,
          video_url: videoUrl,
          version_number: nextVersionNumber,
          status: 'completed',
          metadata: {
            scenes_count: scenes.length,
            images_generated: sceneImages.length,
            music_track: project.music_track?.id || null
          }
        })

      if (versionError) {
        console.error('Error saving video version:', versionError)
      } else {
        console.log(`Saved video as version ${nextVersionNumber}`)
      }
    }

    // Final update
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        video_url: videoUrl,
        video_status: videoUrl ? 'completed' : 'images_only',
        video_progress: 100,
        video_generated_at: new Date().toISOString(),
      })
      .eq('id', projectId)

    if (updateError) {
      throw updateError
    }

    console.log('Video generation completed:', videoUrl ? 'with video' : 'images only')

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl: videoUrl,
        sceneImages: sceneImages.length,
        status: videoUrl ? 'completed' : 'images_only'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    console.error('Error in generate-video function:', error)
    
    // Try to update status to failed
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
