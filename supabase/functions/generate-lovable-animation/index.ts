import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_SCENES = 6

interface SceneData {
  sceneNumber: number
  imageBase64: string | null
  imageUrl: string | null
  narration: string
  audioUrl: string | null
  duration: number
  setting: string
}

function shortenNarration(text: string, maxWords = 45): string {
  const words = text.split(' ')
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ') + '...'
}

function optimizeScenes(scenes: any[], max: number): any[] {
  if (scenes.length <= max) return scenes
  const step = scenes.length / max
  return Array.from({ length: max }, (_, i) => scenes[Math.min(Math.floor(i * step), scenes.length - 1)])
    .map((s, i) => ({ ...s, scene_number: i + 1 }))
}

async function generateSceneImage(
  scene: any,
  characters: any[],
  genre: string,
  apiKey: string
): Promise<{ base64: string | null; url: string | null }> {
  const sceneCharacters = scene.dialogue?.map((d: any) => d.character) || []
  const characterDetails = characters
    .filter((c: any) => sceneCharacters.includes(c.name))
    .map((c: any) => `${c.name}: ${c.description}`)
    .join('. ')

  const prompt = `Warm storybook illustration. Style: soft 2D animation, pastel colors, rounded characters, big expressive eyes, Pixar-like warmth, child-friendly, magical atmosphere. Setting: ${scene.setting}. Action: ${scene.action || scene.description}. ${characterDetails ? `Characters: ${characterDetails}.` : ''} Genre: ${genre}. Wide 16:9 composition, cozy and lovable.`

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-image-preview',
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text']
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(`Image gen failed for scene ${scene.scene_number}: ${response.status} ${errText}`)
      return { base64: null, url: null }
    }

    const data = await response.json()
    console.log(`Image response for scene ${scene.scene_number}:`, JSON.stringify(data).slice(0, 300))

    // Try multiple response shapes
    const parts = data.choices?.[0]?.message?.content
    if (Array.isArray(parts)) {
      for (const part of parts) {
        if (part.type === 'image_url' && part.image_url?.url) {
          const url = part.image_url.url
          if (url.startsWith('data:')) {
            const b64 = url.split(',')[1]
            return { base64: b64, url }
          }
          return { base64: null, url }
        }
        if (part.inlineData?.data) {
          return { base64: part.inlineData.data, url: `data:image/png;base64,${part.inlineData.data}` }
        }
      }
    }

    // Fallback shapes
    const imgUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url
      || data.choices?.[0]?.message?.image_url?.url
    if (imgUrl) {
      if (imgUrl.startsWith('data:')) {
        return { base64: imgUrl.split(',')[1], url: imgUrl }
      }
      return { base64: null, url: imgUrl }
    }

    console.error(`No image found in response for scene ${scene.scene_number}`)
    return { base64: null, url: null }
  } catch (error) {
    console.error(`Image generation exception for scene ${scene.scene_number}:`, error)
    return { base64: null, url: null }
  }
}

async function uploadImageToStorage(
  base64Data: string,
  supabase: any,
  projectId: string,
  sceneNumber: number
): Promise<string | null> {
  try {
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
    const fileName = `${projectId}/scene-${sceneNumber}-${Date.now()}.png`
    
    const { error } = await supabase.storage
      .from('generated-videos')
      .upload(fileName, binaryData, {
        contentType: 'image/png',
        upsert: true
      })

    if (error) {
      console.error(`Image upload error for scene ${sceneNumber}:`, error)
      return null
    }

    const { data } = supabase.storage.from('generated-videos').getPublicUrl(fileName)
    return data.publicUrl
  } catch (err) {
    console.error(`Image upload exception for scene ${sceneNumber}:`, err)
    return null
  }
}

async function generateNarrationAudio(
  text: string,
  apiKey: string,
  supabase: any,
  projectId: string,
  sceneNumber: number
): Promise<string | null> {
  const voiceId = 'pFZP5JQG7iQjIQuC4Bku' // Lily - warm and friendly

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: shortenNarration(text, 45),
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.65,
            similarity_boost: 0.75,
            style: 0.35,
            use_speaker_boost: true,
          }
        }),
      }
    )

    if (!response.ok) {
      const errText = await response.text()
      console.error(`ElevenLabs error for scene ${sceneNumber}: ${response.status} ${errText}`)
      return null
    }

    const audioBuffer = await response.arrayBuffer()
    const fileName = `${projectId}/narration-${sceneNumber}-${Date.now()}.mp3`

    const { error } = await supabase.storage
      .from('generated-videos')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true
      })

    if (error) {
      console.error(`Audio upload error:`, error)
      return null
    }

    const { data } = supabase.storage.from('generated-videos').getPublicUrl(fileName)
    return data.publicUrl
  } catch (err) {
    console.error(`Narration generation exception for scene ${sceneNumber}:`, err)
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    const { projectId } = await req.json()
    if (!projectId) throw new Error('Project ID is required')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    console.log('=== Starting animated video generation for project:', projectId)

    // Fetch project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projectError || !project) throw new Error('Project not found')
    if (!project.script) throw new Error('Project does not have a script')

    // Update status
    await supabase.from('projects').update({
      video_status: 'generating_lovable',
      video_progress: 2,
      video_generation_started_at: new Date().toISOString(),
      video_generation_cancelled: false
    }).eq('id', projectId)

    const script = project.script
    let scenes = script.scenes || []
    const characters = script.characters || []

    scenes = optimizeScenes(scenes, MAX_SCENES)
    console.log(`Processing ${scenes.length} scenes`)

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')

    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured')

    const sceneDataList: SceneData[] = []

    // ============ PHASE 1: Images (0-55%) ============
    console.log('=== PHASE 1: Generating scene images ===')
    
    const BATCH_SIZE = 2
    for (let b = 0; b < Math.ceil(scenes.length / BATCH_SIZE); b++) {
      // Check cancellation
      const { data: check } = await supabase
        .from('projects').select('video_generation_cancelled').eq('id', projectId).single()
      if (check?.video_generation_cancelled) {
        await supabase.from('projects').update({ video_status: 'cancelled', video_progress: 0 }).eq('id', projectId)
        return new Response(JSON.stringify({ success: false, error: 'Cancelled' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const batchScenes = scenes.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE)
      
      const batchResults = await Promise.all(
        batchScenes.map(async (scene: any) => {
          const { base64, url } = await generateSceneImage(scene, characters, project.genre, LOVABLE_API_KEY)

          // Upload to storage if we have base64
          let storedUrl = url
          if (base64 && !url?.startsWith('http')) {
            storedUrl = await uploadImageToStorage(base64, supabase, projectId, scene.scene_number)
          }

          const dialogueText = scene.dialogue
            ?.map((d: any) => `${d.character}: "${d.line}"`)
            .join(' ') || ''
          const narration = shortenNarration(
            `${scene.description}. ${dialogueText}`.trim(), 50
          )

          return {
            sceneNumber: scene.scene_number,
            imageBase64: base64,
            imageUrl: storedUrl || url,
            narration,
            audioUrl: null,
            duration: 8,
            setting: scene.setting || ''
          } as SceneData
        })
      )

      sceneDataList.push(...batchResults)

      const imgProgress = 5 + Math.floor(((b + 1) / Math.ceil(scenes.length / BATCH_SIZE)) * 50)
      await supabase.from('projects').update({ video_progress: imgProgress }).eq('id', projectId)
      console.log(`Image batch ${b + 1} done. Progress: ${imgProgress}%`)
    }

    const successfulScenes = sceneDataList.filter(s => s.imageUrl)
    console.log(`${successfulScenes.length}/${scenes.length} images generated`)

    // ============ PHASE 2: Narration Audio (55-85%) ============
    console.log('=== PHASE 2: Generating narration audio ===')
    await supabase.from('projects').update({ video_progress: 57 }).eq('id', projectId)

    if (ELEVENLABS_API_KEY && successfulScenes.length > 0) {
      // Sequential to avoid rate limits
      for (let i = 0; i < successfulScenes.length; i++) {
        const scene = successfulScenes[i]
        const audioUrl = await generateNarrationAudio(
          scene.narration,
          ELEVENLABS_API_KEY,
          supabase,
          projectId,
          scene.sceneNumber
        )
        scene.audioUrl = audioUrl

        const audioProgress = 57 + Math.floor(((i + 1) / successfulScenes.length) * 25)
        await supabase.from('projects').update({ video_progress: audioProgress }).eq('id', projectId)
        console.log(`Audio for scene ${scene.sceneNumber}: ${audioUrl ? 'OK' : 'FAILED'}`)
      }
    } else {
      console.log('Skipping audio: no ElevenLabs key or no successful images')
    }

    // ============ PHASE 3: Save animation data (85-100%) ============
    console.log('=== PHASE 3: Saving animation data ===')
    await supabase.from('projects').update({ video_progress: 87 }).eq('id', projectId)

    const totalDuration = successfulScenes.reduce((s, sc) => s + sc.duration, 0)
    const generationTimeSec = Math.round((Date.now() - startTime) / 1000)

    const lovableAnimationData = {
      type: 'lovable_animation',
      scenes: successfulScenes.map(s => ({
        sceneNumber: s.sceneNumber,
        imageUrl: s.imageUrl,
        videoUrl: s.imageUrl, // client will build MP4 from images
        narration: s.narration,
        audioUrl: s.audioUrl,
        duration: s.duration,
        setting: s.setting
      })),
      totalDuration,
      totalScenes: successfulScenes.length,
      videosGenerated: successfulScenes.length,
      isFullAnimation: true,
      generatedAt: new Date().toISOString(),
      generationTimeSeconds: generationTimeSec,
      optimized: false,
      settings: { maxScenes: MAX_SCENES, resolution: '720p', fps: 24 }
    }

    const existingAvatar = project.avatar || {}
    await supabase.from('projects').update({
      avatar: { ...existingAvatar, lovableAnimation: lovableAnimationData }
    }).eq('id', projectId)

    await supabase.from('projects').update({ video_progress: 93 }).eq('id', projectId)

    // Create video version record
    const mainImageUrl = successfulScenes[0]?.imageUrl || null
    if (mainImageUrl) {
      const { data: existingVersions } = await supabase
        .from('video_versions')
        .select('version_number')
        .eq('project_id', projectId)
        .order('version_number', { ascending: false })
        .limit(1)

      const nextVersion = existingVersions?.[0]?.version_number ? existingVersions[0].version_number + 1 : 1

      await supabase.from('video_versions').insert({
        project_id: projectId,
        video_url: mainImageUrl,
        version_number: nextVersion,
        status: 'completed',
        duration_seconds: totalDuration,
        metadata: {
          type: 'lovable_animation',
          scenes_count: successfulScenes.length,
          has_narration: successfulScenes.some(s => s.audioUrl),
          generation_time_seconds: generationTimeSec
        }
      })
    }

    // Final status
    await supabase.from('projects').update({
      video_status: 'lovable_completed',
      video_progress: 100,
      video_generated_at: new Date().toISOString(),
    }).eq('id', projectId)

    console.log(`=== COMPLETED in ${generationTimeSec}s. Scenes: ${successfulScenes.length}, Audio: ${successfulScenes.filter(s => s.audioUrl).length} ===`)

    return new Response(
      JSON.stringify({
        success: true,
        totalScenes: successfulScenes.length,
        totalDuration,
        hasNarration: successfulScenes.some(s => s.audioUrl),
        generationTimeSeconds: generationTimeSec,
        lovableAnimation: lovableAnimationData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('=== FATAL ERROR in generate-lovable-animation:', error.message)

    try {
      const body = await req.clone().json()
      const pid = body?.projectId
      if (pid) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )
        await supabase.from('projects').update({
          video_status: 'failed',
          video_progress: 0
        }).eq('id', pid)
      }
    } catch (_) { /* ignore */ }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
