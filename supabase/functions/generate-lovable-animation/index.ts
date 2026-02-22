import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const MAX_SCENES = 5
const RUNWAY_API = 'https://api.dev.runwayml.com/v1'
const RUNWAY_VERSION = '2024-11-06'

interface SceneData {
  sceneNumber: number
  imageUrl: string | null
  videoUrl: string | null
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

// Generate a scene illustration using Lovable AI (Gemini image model)
async function generateSceneImage(
  scene: any,
  characters: any[],
  genre: string,
  apiKey: string,
  retries = 2
): Promise<{ base64: string | null; url: string | null }> {
  const sceneCharacters = scene.dialogue?.map((d: any) => d.character) || []
  const characterDetails = characters
    .filter((c: any) => sceneCharacters.includes(c.name))
    .map((c: any) => `${c.name}: ${c.description}`)
    .join('. ')

  const prompt = `Cinematic 3D animated scene, Pixar-quality rendering with dramatic lighting and depth. Style: soft 3D animation, volumetric lighting, cinematic color grading, depth of field, warm pastel tones, rounded expressive characters with big eyes, rich detailed environment with foreground/midground/background layers. Setting: ${scene.setting}. Action: ${scene.action || scene.description}. ${characterDetails ? `Characters: ${characterDetails}.` : ''} Genre: ${genre}. Wide 16:9 cinematic composition, dramatic camera angle, cozy magical atmosphere.`

  for (let attempt = 0; attempt <= retries; attempt++) {
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

      if (response.status === 503 && attempt < retries) {
        console.log(`Image gen 503 for scene ${scene.scene_number}, retrying in 5s...`)
        await new Promise(r => setTimeout(r, 5000))
        continue
      }

      if (!response.ok) {
        const errText = await response.text()
        console.error(`Image gen failed for scene ${scene.scene_number}: ${response.status} ${errText}`)
        return { base64: null, url: null }
      }

      const data = await response.json()

      // Try multiple response shapes
      const parts = data.choices?.[0]?.message?.content
      if (Array.isArray(parts)) {
        for (const part of parts) {
          if (part.type === 'image_url' && part.image_url?.url) {
            const url = part.image_url.url
            if (url.startsWith('data:')) {
              return { base64: url.split(',')[1], url }
            }
            return { base64: null, url }
          }
          if (part.inlineData?.data) {
            return { base64: part.inlineData.data, url: `data:image/png;base64,${part.inlineData.data}` }
          }
        }
      }

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
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 3000))
        continue
      }
      console.error(`Image generation exception for scene ${scene.scene_number}:`, error)
      return { base64: null, url: null }
    }
  }
  return { base64: null, url: null }
}

// Upload base64 image to storage & return public URL
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
      .upload(fileName, binaryData, { contentType: 'image/png', upsert: true })

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

// Start a Runway image-to-video task, returns task ID
async function startRunwayVideoTask(
  imageUrl: string,
  scene: any,
  runwayApiKey: string
): Promise<string | null> {
  const promptText = `Animate this scene with natural character movement, gentle gestures, blinking, subtle body motion, cinematic camera pan. ${scene.action || scene.description}. Smooth cinematic motion, soft lighting.`

  try {
    const response = await fetch(`${RUNWAY_API}/image_to_video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${runwayApiKey}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': RUNWAY_VERSION,
      },
      body: JSON.stringify({
        model: 'gen4_turbo',
        promptImage: imageUrl,
        promptText,
        duration: 5,
        ratio: '1280:720',
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(`Runway task start failed for scene ${scene.scene_number}: ${response.status} ${errText}`)
      return null
    }

    const data = await response.json()
    console.log(`Runway task started for scene ${scene.scene_number}: ${data.id}`)
    return data.id || null
  } catch (err) {
    console.error(`Runway task exception for scene ${scene.scene_number}:`, err)
    return null
  }
}

// Poll Runway task until SUCCEEDED or FAILED (max ~3 minutes per task)
async function pollRunwayTask(
  taskId: string,
  runwayApiKey: string,
  maxPollSeconds = 180
): Promise<string | null> {
  const start = Date.now()
  const pollInterval = 10000 // 10s

  while ((Date.now() - start) < maxPollSeconds * 1000) {
    try {
      const response = await fetch(`${RUNWAY_API}/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${runwayApiKey}`,
          'X-Runway-Version': RUNWAY_VERSION,
        },
      })

      if (!response.ok) {
        console.error(`Runway poll error: ${response.status}`)
        await new Promise(r => setTimeout(r, pollInterval))
        continue
      }

      const data = await response.json()
      console.log(`Runway task ${taskId} status: ${data.status}`)

      if (data.status === 'SUCCEEDED') {
        // output is array of video URLs
        const videoUrl = Array.isArray(data.output) ? data.output[0] : data.output
        return videoUrl || null
      }

      if (data.status === 'FAILED') {
        console.error(`Runway task ${taskId} failed:`, data.failure || data.failureCode)
        return null
      }

      // PENDING, THROTTLED, RUNNING — keep polling
    } catch (err) {
      console.error(`Runway poll exception:`, err)
    }

    await new Promise(r => setTimeout(r, pollInterval))
  }

  console.error(`Runway task ${taskId} timed out after ${maxPollSeconds}s`)
  return null
}

// Download a video from URL and upload to Supabase storage
async function uploadVideoToStorage(
  videoUrl: string,
  supabase: any,
  projectId: string,
  sceneNumber: number
): Promise<string | null> {
  try {
    const response = await fetch(videoUrl)
    if (!response.ok) {
      console.error(`Failed to download video for scene ${sceneNumber}: ${response.status}`)
      return null
    }
    const videoBuffer = await response.arrayBuffer()
    const fileName = `${projectId}/scene-video-${sceneNumber}-${Date.now()}.mp4`

    const { error } = await supabase.storage
      .from('generated-videos')
      .upload(fileName, videoBuffer, { contentType: 'video/mp4', upsert: true })

    if (error) {
      console.error(`Video upload error for scene ${sceneNumber}:`, error)
      return null
    }

    const { data } = supabase.storage.from('generated-videos').getPublicUrl(fileName)
    return data.publicUrl
  } catch (err) {
    console.error(`Video upload exception for scene ${sceneNumber}:`, err)
    return null
  }
}

// Generate narration audio via ElevenLabs TTS
async function generateNarrationAudio(
  text: string,
  apiKey: string,
  supabase: any,
  projectId: string,
  sceneNumber: number
): Promise<string | null> {
  const voiceId = 'pFZP5JQG7iQjIQuC4Bku' // Lily

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
          voice_settings: { stability: 0.65, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true }
        }),
      }
    )

    if (!response.ok) {
      console.error(`ElevenLabs error for scene ${sceneNumber}: ${response.status}`)
      return null
    }

    const audioBuffer = await response.arrayBuffer()
    const fileName = `${projectId}/narration-${sceneNumber}-${Date.now()}.mp3`

    const { error } = await supabase.storage
      .from('generated-videos')
      .upload(fileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true })

    if (error) {
      console.error(`Audio upload error:`, error)
      return null
    }

    const { data } = supabase.storage.from('generated-videos').getPublicUrl(fileName)
    return data.publicUrl
  } catch (err) {
    console.error(`Narration exception for scene ${sceneNumber}:`, err)
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

    console.log('=== Starting ANIMATED VIDEO generation for project:', projectId)

    const { data: project, error: projectError } = await supabase
      .from('projects').select('*').eq('id', projectId).single()

    if (projectError || !project) throw new Error('Project not found')
    if (!project.script) throw new Error('Project does not have a script')

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
    const RUNWAY_API_KEY = Deno.env.get('RUNWAY_API_KEY')

    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured')
    if (!RUNWAY_API_KEY) throw new Error('RUNWAY_API_KEY is not configured')

    const sceneDataList: SceneData[] = []

    // ============ PHASE 1: Generate scene images (0-30%) ============
    console.log('=== PHASE 1: Generating scene images ===')

    for (let i = 0; i < scenes.length; i++) {
      // Check cancellation
      const { data: check } = await supabase
        .from('projects').select('video_generation_cancelled').eq('id', projectId).single()
      if (check?.video_generation_cancelled) {
        await supabase.from('projects').update({ video_status: 'cancelled', video_progress: 0 }).eq('id', projectId)
        return new Response(JSON.stringify({ success: false, error: 'Cancelled' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const scene = scenes[i]
      const { base64, url } = await generateSceneImage(scene, characters, project.genre, LOVABLE_API_KEY)

      let storedUrl = url
      if (base64) {
        const uploaded = await uploadImageToStorage(base64, supabase, projectId, scene.scene_number)
        if (uploaded) storedUrl = uploaded
      }

      const dialogueText = scene.dialogue?.map((d: any) => `${d.character}: "${d.line}"`).join(' ') || ''
      const narration = shortenNarration(`${scene.description}. ${dialogueText}`.trim(), 50)

      sceneDataList.push({
        sceneNumber: scene.scene_number,
        imageUrl: storedUrl || url,
        videoUrl: null,
        narration,
        audioUrl: null,
        duration: 5,
        setting: scene.setting || ''
      })

      const imgProgress = 3 + Math.floor(((i + 1) / scenes.length) * 27)
      await supabase.from('projects').update({ video_progress: imgProgress }).eq('id', projectId)
      console.log(`Image ${i + 1}/${scenes.length} done. Progress: ${imgProgress}%`)
    }

    const scenesWithImages = sceneDataList.filter(s => s.imageUrl)
    console.log(`${scenesWithImages.length}/${scenes.length} images generated`)

    // ============ PHASE 2: Start Runway video tasks (30-40%) ============
    console.log('=== PHASE 2: Starting Runway video generation tasks ===')
    await supabase.from('projects').update({ video_progress: 32 }).eq('id', projectId)

    const taskMap: { sceneNumber: number; taskId: string | null; imageUrl: string }[] = []

    for (const scene of scenesWithImages) {
      if (!scene.imageUrl) continue
      const taskId = await startRunwayVideoTask(scene.imageUrl, scenes.find((s: any) => s.scene_number === scene.sceneNumber) || {}, RUNWAY_API_KEY)
      taskMap.push({ sceneNumber: scene.sceneNumber, taskId, imageUrl: scene.imageUrl! })

      // Small delay between task starts to avoid rate limits
      await new Promise(r => setTimeout(r, 1500))
    }

    const activeTasks = taskMap.filter(t => t.taskId)
    console.log(`${activeTasks.length} Runway tasks started`)
    await supabase.from('projects').update({ video_progress: 40 }).eq('id', projectId)

    // ============ PHASE 3: Poll Runway tasks until complete (40-75%) ============
    console.log('=== PHASE 3: Polling Runway tasks for completion ===')

    for (let i = 0; i < activeTasks.length; i++) {
      const task = activeTasks[i]
      const videoUrl = await pollRunwayTask(task.taskId!, RUNWAY_API_KEY)

      if (videoUrl) {
        // Download and upload to our storage
        const storedVideoUrl = await uploadVideoToStorage(videoUrl, supabase, projectId, task.sceneNumber)
        const sceneData = sceneDataList.find(s => s.sceneNumber === task.sceneNumber)
        if (sceneData) {
          sceneData.videoUrl = storedVideoUrl || videoUrl
        }
        console.log(`Scene ${task.sceneNumber} video ready: ${storedVideoUrl ? 'stored' : 'direct URL'}`)
      } else {
        console.log(`Scene ${task.sceneNumber} video failed — will use image fallback`)
      }

      const videoProgress = 40 + Math.floor(((i + 1) / activeTasks.length) * 35)
      await supabase.from('projects').update({ video_progress: videoProgress }).eq('id', projectId)
    }

    const scenesWithVideo = sceneDataList.filter(s => s.videoUrl)
    console.log(`${scenesWithVideo.length}/${scenesWithImages.length} video clips generated`)

    // ============ PHASE 4: Narration Audio via ElevenLabs (75-90%) ============
    console.log('=== PHASE 4: Generating narration audio ===')
    await supabase.from('projects').update({ video_progress: 77 }).eq('id', projectId)

    if (ELEVENLABS_API_KEY && scenesWithImages.length > 0) {
      for (let i = 0; i < scenesWithImages.length; i++) {
        const scene = scenesWithImages[i]
        const audioUrl = await generateNarrationAudio(
          scene.narration, ELEVENLABS_API_KEY, supabase, projectId, scene.sceneNumber
        )
        scene.audioUrl = audioUrl

        // If first audio fails, skip rest
        if (i === 0 && !audioUrl) {
          console.log('First audio failed — skipping remaining')
          break
        }

        const audioProgress = 77 + Math.floor(((i + 1) / scenesWithImages.length) * 13)
        await supabase.from('projects').update({ video_progress: audioProgress }).eq('id', projectId)
      }
    } else {
      console.log('Skipping audio: no ElevenLabs key or no images')
    }

    // ============ PHASE 5: Save animation data (90-100%) ============
    console.log('=== PHASE 5: Saving animation data ===')
    await supabase.from('projects').update({ video_progress: 92 }).eq('id', projectId)

    const totalDuration = scenesWithImages.reduce((s, sc) => s + sc.duration, 0)
    const generationTimeSec = Math.round((Date.now() - startTime) / 1000)

    const lovableAnimationData = {
      type: 'lovable_animation',
      scenes: scenesWithImages.map(s => ({
        sceneNumber: s.sceneNumber,
        imageUrl: s.imageUrl,
        videoUrl: s.videoUrl || s.imageUrl, // fallback to image if no video
        narration: s.narration,
        audioUrl: s.audioUrl,
        duration: s.duration,
        setting: s.setting,
        hasVideo: !!s.videoUrl,
      })),
      totalDuration,
      totalScenes: scenesWithImages.length,
      videosGenerated: scenesWithVideo.length,
      isFullAnimation: scenesWithVideo.length > 0,
      generatedAt: new Date().toISOString(),
      generationTimeSeconds: generationTimeSec,
      settings: { maxScenes: MAX_SCENES, resolution: '720p', fps: 24 }
    }

    const existingAvatar = project.avatar || {}
    await supabase.from('projects').update({
      avatar: { ...existingAvatar, lovableAnimation: lovableAnimationData }
    }).eq('id', projectId)

    await supabase.from('projects').update({ video_progress: 96 }).eq('id', projectId)

    // Create video version record
    const mainVideoUrl = scenesWithVideo[0]?.videoUrl || scenesWithImages[0]?.imageUrl || null
    if (mainVideoUrl) {
      const { data: existingVersions } = await supabase
        .from('video_versions')
        .select('version_number')
        .eq('project_id', projectId)
        .order('version_number', { ascending: false })
        .limit(1)

      const nextVersion = existingVersions?.[0]?.version_number ? existingVersions[0].version_number + 1 : 1

      await supabase.from('video_versions').insert({
        project_id: projectId,
        video_url: mainVideoUrl,
        version_number: nextVersion,
        status: 'completed',
        duration_seconds: totalDuration,
        metadata: {
          type: 'lovable_animation',
          scenes_count: scenesWithImages.length,
          video_clips: scenesWithVideo.length,
          has_narration: scenesWithImages.some(s => s.audioUrl),
          generation_time_seconds: generationTimeSec
        }
      })
    }

    await supabase.from('projects').update({
      video_status: 'lovable_completed',
      video_progress: 100,
      video_generated_at: new Date().toISOString(),
    }).eq('id', projectId)

    console.log(`=== COMPLETED in ${generationTimeSec}s. Video clips: ${scenesWithVideo.length}, Audio: ${scenesWithImages.filter(s => s.audioUrl).length} ===`)

    return new Response(
      JSON.stringify({
        success: true,
        totalScenes: scenesWithImages.length,
        videoClips: scenesWithVideo.length,
        totalDuration,
        hasNarration: scenesWithImages.some(s => s.audioUrl),
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
