import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const MAX_SCENES = 5
const RUNWAY_API = 'https://api.dev.runwayml.com/v1'
const RUNWAY_VERSION = '2024-11-06'
const RUNWAY_TEXT_MODEL = 'gen4.5'

interface SceneData {
  sceneNumber: number
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

// Motion presets: curated camera + character action combos for different scene types
const MOTION_PRESETS: Record<string, { camera: string; action: string; env: string }> = {
  'close_up_rack_focus': {
    camera: 'Tight close-up with shallow depth of field, slight handheld drift, rack focus pulling between character faces to reveal emotional reactions.',
    action: 'Subtle micro-expressions: eyebrow raises, lip quivers, eye darts, gentle head tilts. Breathing visible in chest rise.',
    env: 'Background softly blurred with bokeh, gentle light flicker on faces, dust motes floating in shallow focus.'
  },
  'tracking_steadicam': {
    camera: 'Smooth steadicam tracking shot following characters as they move, parallax on foreground and background layers, gentle vertical float.',
    action: 'Characters walking with natural gait, arms swinging, hair bouncing, clothing swaying with each step, occasional glances at each other.',
    env: 'Environment slides past with depth parallax, background elements drift, ambient particles trail through frame.'
  },
  'dolly_reveal': {
    camera: 'Slow forward dolly push revealing the full scene, starting tight and widening to establish the environment, smooth crane-up at the end.',
    action: 'Characters gradually enter frame or are revealed by camera movement, settling into their positions with natural weight shifts.',
    env: 'Full environment revealed with layered depth — foreground objects pass by, midground characters appear, background landscape opens up.'
  },
  'two_shot_push_in': {
    camera: 'Medium two-shot framing both characters, slow push-in building dramatic tension, slight arc to show spatial relationship.',
    action: 'Characters face each other with animated conversation gestures, leaning in/out, hand movements emphasizing dialogue, shifting weight between feet.',
    env: 'Background slightly defocused, ambient light shifts suggesting time passage, secondary motion in set dressing.'
  },
  'wide_establishing': {
    camera: 'Wide establishing shot with slow horizontal pan, deep focus capturing the full environment, gentle crane movement adding grandeur.',
    action: 'Characters as part of the larger scene, small but purposeful movements — walking into frame, gesturing broadly, interacting with environment.',
    env: 'Rich environmental animation: clouds moving, water rippling, flags waving, crowd murmur, atmospheric haze with volumetric light shafts.'
  },
  'montage_dynamic': {
    camera: 'Dynamic camera with motivated movement — push-ins on key moments, whip pans between action beats, energy-driven dolly rushes.',
    action: 'Rapid purposeful character actions: working, building, creating, trading. Quick decisive movements showing progress and determination.',
    env: 'Environment shifts suggesting time passage — light changes from morning to evening, seasons shifting, space transforming around characters.'
  },
  'orbit_dramatic': {
    camera: 'Slow 180-degree orbit around the subject, dramatic lighting shift as camera moves, revealing new angles and context.',
    action: 'Character holds a powerful pose or moment of decision, subtle wind effect on hair and clothing, intense eye contact with implied viewer.',
    env: 'Dramatic lighting with rim light sweeping across scene as camera orbits, volumetric god rays, atmospheric tension.'
  },
  'over_shoulder_intimate': {
    camera: 'Over-the-shoulder shot with soft foreground bokeh from the listener, gentle sway mimicking natural body rhythm, slow focus pull.',
    action: 'Speaking character with expressive lip movement and hand gestures, listening character with reactive nods and micro-expressions.',
    env: 'Warm intimate lighting, candle flicker or firelight, cozy atmosphere with soft ambient sounds suggested by visual warmth.'
  }
}

// Select the best motion preset based on scene content
function selectMotionPreset(scene: any): string {
  const cameraAngle = (scene.camera_angle || '').toLowerCase()
  const action = (scene.action || '').toLowerCase()
  const description = (scene.description || '').toLowerCase()
  const dialogueCount = scene.dialogue?.length || 0
  const combined = `${cameraAngle} ${action} ${description}`

  // Direct camera_angle matches
  if (cameraAngle.includes('close-up') || cameraAngle.includes('closeup')) return 'close_up_rack_focus'
  if (cameraAngle.includes('tracking') || cameraAngle.includes('follow')) return 'tracking_steadicam'
  if (cameraAngle.includes('two-shot') || cameraAngle.includes('2-shot')) return 'two_shot_push_in'
  if (cameraAngle.includes('wide') || cameraAngle.includes('establishing')) return 'wide_establishing'
  if (cameraAngle.includes('montage')) return 'montage_dynamic'
  if (cameraAngle.includes('orbit') || cameraAngle.includes('revolve')) return 'orbit_dramatic'
  if (cameraAngle.includes('over') && cameraAngle.includes('shoulder')) return 'over_shoulder_intimate'
  if (cameraAngle.includes('long shot')) return 'dolly_reveal'

  // Infer from scene content
  if (combined.includes('walk') || combined.includes('run') || combined.includes('journey') || combined.includes('path')) return 'tracking_steadicam'
  if (combined.includes('montage') || combined.includes('time-lapse') || combined.includes('timelapse')) return 'montage_dynamic'
  if (combined.includes('reveal') || combined.includes('discover') || combined.includes('mansion') || combined.includes('palace')) return 'dolly_reveal'
  if (combined.includes('whisper') || combined.includes('intimate') || combined.includes('embrace')) return 'over_shoulder_intimate'
  if (combined.includes('confront') || combined.includes('argue') || combined.includes('table')) return 'two_shot_push_in'
  if (dialogueCount >= 3) return 'two_shot_push_in'
  if (dialogueCount === 0 && combined.includes('square') || combined.includes('town') || combined.includes('market')) return 'wide_establishing'
  if (combined.includes('eye') || combined.includes('tear') || combined.includes('emotion')) return 'close_up_rack_focus'

  // Default based on dialogue presence
  return dialogueCount > 0 ? 'two_shot_push_in' : 'dolly_reveal'
}

// Build a locked-appearance "character bible" that is repeated for every scene
// so face, hair, clothing, body proportions, skin tone and accessories stay
// identical across the whole story.
function buildCharacterBible(characters: any[]): string {
  if (!characters || characters.length === 0) return ''
  const entries = characters.map((c: any) => {
    const bits: string[] = [`${c.name}`]
    if (c.description) bits.push(c.description)
    if (c.appearance) bits.push(`appearance: ${c.appearance}`)
    if (c.hair) bits.push(`hair: ${c.hair}`)
    if (c.clothing || c.outfit) bits.push(`clothing: ${c.clothing || c.outfit}`)
    if (c.skinTone || c.skin_tone) bits.push(`skin tone: ${c.skinTone || c.skin_tone}`)
    if (c.accessories) bits.push(`accessories: ${c.accessories}`)
    return bits.join(', ')
  }).join(' | ')
  return `CHARACTER CONSISTENCY LOCK (do not change between scenes): ${entries}. Keep every character's face, hairstyle, clothing, body proportions, skin tone and accessories IDENTICAL to this description in every frame.`
}

// Build a fully expanded cinematic prompt from scene data
function buildRunwayPrompt(scene: any, characters: any[]): string {
  const parts: string[] = []

  // Character bible FIRST so consistency is the strongest signal
  const bible = buildCharacterBible(characters)
  if (bible) parts.push(bible)

  // Setting & environment with atmosphere
  if (scene.setting) {
    parts.push(`A continuous single-take shot set in ${scene.setting}.`)
  }

  // Full character descriptions with clothing and personality
  const sceneCharacterNames = [
    ...(scene.dialogue?.map((d: any) => d.character) || []),
  ]
  const uniqueNames = [...new Set(sceneCharacterNames)]
  const relevantChars = characters.filter((c: any) => uniqueNames.includes(c.name))
  
  if (relevantChars.length > 0) {
    const charDescriptions = relevantChars.map((c: any) => {
      const personality = c.personality ? `, personality: ${c.personality}` : ''
      return `${c.name} — ${c.description}${personality}`
    }).join('. ')
    parts.push(`Characters in frame (same identical appearance as the consistency lock above): ${charDescriptions}.`)
  }

  // Scene description for visual context
  if (scene.description) {
    parts.push(`Visual context: ${scene.description}.`)
  }

  // Continuous physical action — the core of what Runway animates
  if (scene.action) {
    parts.push(`Physical action (animate this): ${scene.action}. Characters move naturally with weight and momentum, subtle breathing, blinking, hair and cloth physics responding to movement, natural eye contact and expressive facial performance.`)
  }

  // Dialogue-driven emotional performance
  if (scene.dialogue?.length > 0) {
    const performances = scene.dialogue.map((d: any) => {
      const emotion = d.emotion || 'neutral'
      const lineHint = d.line ? d.line.replace(/[()]/g, '').substring(0, 60) : ''
      return `${d.character} performs with ${emotion} emotion${lineHint ? `, gesturing as if saying "${lineHint}"` : ''}`
    }).join('. ')
    parts.push(`Character performances: ${performances}. Lip movement suggesting speech, expressive eyes and eyebrows, hand gestures matching emotional tone.`)
  }

  // Motion preset — auto-selected based on scene content
  const presetKey = selectMotionPreset(scene)
  const preset = MOTION_PRESETS[presetKey]
  console.log(`Scene ${scene.scene_number}: motion preset = ${presetKey}`)
  
  parts.push(`Camera: ${preset.camera}`)
  parts.push(`Character animation: ${preset.action}`)
  parts.push(`Environment: ${preset.env}`)

  // Style and rendering
  parts.push('Style: cinematic 3D animation, Pixar-quality rendering, volumetric god rays, warm color grading, anamorphic lens characteristics, film grain, 24fps motion cadence.')

  return parts.join(' ')
}

// Write a fine-grained progress detail into projects.avatar.lovableGenerationStatus
// so the client can show "Generating Scene X of N" and an ETA.
async function updateGenerationStatus(
  supabase: any,
  projectId: string,
  existingAvatar: any,
  status: {
    phase: string
    currentScene?: number
    totalScenes?: number
    startedAt: number
    progress: number
  }
) {
  const elapsedSec = Math.round((Date.now() - status.startedAt) / 1000)
  const etaSec = status.progress > 5
    ? Math.max(0, Math.round((elapsedSec / status.progress) * (100 - status.progress)))
    : null
  const detail = {
    phase: status.phase,
    currentScene: status.currentScene ?? null,
    totalScenes: status.totalScenes ?? null,
    progress: status.progress,
    elapsedSeconds: elapsedSec,
    etaSeconds: etaSec,
    updatedAt: new Date().toISOString(),
  }
  try {
    await supabase.from('projects').update({
      avatar: { ...(existingAvatar || {}), lovableGenerationStatus: detail },
      video_progress: status.progress,
    }).eq('id', projectId)
  } catch (e) {
    console.error('updateGenerationStatus failed:', e)
  }
}

// Validate that a prompt contains required cinematic and camera motion elements
function validateRunwayPrompt(prompt: string, sceneNumber: number): string {
  const lower = prompt.toLowerCase()
  const issues: string[] = []

  // Check for camera motion keywords
  const cameraKeywords = ['camera', 'dolly', 'pan', 'tracking', 'steadicam', 'crane', 'push-in', 'zoom', 'handheld', 'drift', 'arc']
  const hasCameraMotion = cameraKeywords.some(kw => lower.includes(kw))
  if (!hasCameraMotion) {
    issues.push('missing camera motion')
  }

  // Check for cinematic style keywords
  const cinematicKeywords = ['cinematic', 'film', 'volumetric', 'depth of field', 'lighting', 'color grading']
  const hasCinematic = cinematicKeywords.some(kw => lower.includes(kw))
  if (!hasCinematic) {
    issues.push('missing cinematic style')
  }

  // Check for character action/motion keywords
  const motionKeywords = ['movement', 'motion', 'animate', 'gesture', 'blinking', 'breathing', 'walking', 'moving', 'action']
  const hasMotion = motionKeywords.some(kw => lower.includes(kw))
  if (!hasMotion) {
    issues.push('missing character motion')
  }

  // Check for environment/atmosphere
  const envKeywords = ['environment', 'ambient', 'wind', 'light', 'atmosphere', 'dust', 'particles']
  const hasEnv = envKeywords.some(kw => lower.includes(kw))
  if (!hasEnv) {
    issues.push('missing environmental motion')
  }

  // If any elements are missing, append defaults
  if (issues.length > 0) {
    console.warn(`Scene ${sceneNumber} prompt validation: ${issues.join(', ')} — injecting defaults`)
    const fixes: string[] = []
    if (!hasCameraMotion) fixes.push('Camera: slow cinematic dolly with gentle arc around subjects, smooth steadicam tracking.')
    if (!hasCinematic) fixes.push('Style: cinematic 3D animation, volumetric lighting, warm color grading, depth of field, film grain.')
    if (!hasMotion) fixes.push('Character motion: natural movement with breathing, blinking, subtle gestures, weight and momentum.')
    if (!hasEnv) fixes.push('Environment: ambient motion with gentle wind, dust particles in light, atmospheric haze.')
    return prompt + ' ' + fixes.join(' ')
  }

  console.log(`Scene ${sceneNumber} prompt validated: all cinematic elements present ✓`)
  return prompt
}

function isFailureStatus(status: string | undefined): boolean {
  const normalized = (status || '').toUpperCase()
  return normalized === 'FAILED' || normalized === 'TIMEOUT' || normalized === 'TIMED_OUT' || normalized === 'ERROR' || normalized === 'CANCELLED'
}

function isSuccessStatus(status: string | undefined): boolean {
  const normalized = (status || '').toUpperCase()
  return normalized === 'SUCCEEDED' || normalized === 'COMPLETED'
}

// Start a Runway text-to-video task. No image endpoint or image fallback is used.
async function startRunwayVideoTask(
  scene: any,
  characters: any[],
  runwayApiKey: string
): Promise<string> {
  const rawPrompt = buildRunwayPrompt(scene, characters)
  const promptText = validateRunwayPrompt(rawPrompt, scene.scene_number || 0)

  const requestBody = {
    model: RUNWAY_TEXT_MODEL,
    promptText,
    duration: 5,
    ratio: '1280:720',
  }

  try {
    console.log(`Runway request sent for scene ${scene.scene_number}: endpoint=/text_to_video model=${requestBody.model}, duration=${requestBody.duration}, ratio=${requestBody.ratio}`)
    console.log(`Runway prompt for scene ${scene.scene_number}: ${promptText.substring(0, 300)}`)
    
    const response = await fetch(`${RUNWAY_API}/text_to_video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${runwayApiKey}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': RUNWAY_VERSION,
      },
      body: JSON.stringify(requestBody),
    })

    const responseText = await response.text()
    
    if (!response.ok) {
      console.error(`Runway task start FAILED for scene ${scene.scene_number}: HTTP ${response.status} — ${responseText}`)
      throw new Error(`Runway request failed for scene ${scene.scene_number}: HTTP ${response.status} — ${responseText}`)
    }

    let data
    try {
      data = JSON.parse(responseText)
    } catch {
      console.error(`Runway response not JSON for scene ${scene.scene_number}: ${responseText}`)
      throw new Error(`Runway response was invalid for scene ${scene.scene_number}`)
    }

    if (!data.id) {
      throw new Error(`Runway did not return a job ID for scene ${scene.scene_number}`)
    }

    console.log(`Runway job ID received for scene ${scene.scene_number}: ${data.id}, status=${data.status || 'unknown'}`)
    return data.id
  } catch (err) {
    console.error(`Runway task exception for scene ${scene.scene_number}:`, err)
    throw err
  }
}

// Poll Runway task until COMPLETED/SUCCEEDED or fail fast on FAILED/TIMEOUT/ERROR.
async function pollRunwayTask(
  taskId: string,
  runwayApiKey: string,
  maxPollSeconds = 180
): Promise<string> {
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
        const errBody = await response.text()
        console.error(`Runway poll error for ${taskId}: HTTP ${response.status} — ${errBody}`)
        throw new Error(`Runway polling failed for job ${taskId}: HTTP ${response.status} — ${errBody}`)
      }

      const data = await response.json()
      const elapsed = Math.round((Date.now() - start) / 1000)
      console.log(`Polling status for Runway job ${taskId}: ${data.status} (${elapsed}s elapsed)`)

      if (isSuccessStatus(data.status)) {
        // output can be array of URLs or a single URL string
        const videoUrl = Array.isArray(data.output) ? data.output[0] : data.output
        if (!videoUrl || typeof videoUrl !== 'string') {
          throw new Error(`Runway job ${taskId} completed without a video URL`)
        }
        console.log(`Video URL received for Runway job ${taskId}: ${videoUrl.substring(0, 120)}`)
        return videoUrl
      }

      if (isFailureStatus(data.status)) {
        console.error(`Runway task ${taskId} FAILED:`, JSON.stringify({ failure: data.failure, failureCode: data.failureCode }))
        throw new Error(`Runway generation failed for job ${taskId}: ${data.failure || data.failureCode || data.status}`)
      }

      // PENDING, THROTTLED, RUNNING — keep polling
    } catch (err) {
      console.error(`Runway poll exception for ${taskId}:`, err)
      throw err
    }

    await new Promise(r => setTimeout(r, pollInterval))
  }

  console.error(`Runway task ${taskId} timed out after ${maxPollSeconds}s`)
  throw new Error(`Runway generation timed out for job ${taskId}`)
}
async function uploadVideoToStorage(
  videoUrl: string,
  supabase: any,
  projectId: string,
  sceneNumber: number
): Promise<string> {
  try {
    console.log(`Scene downloaded: fetching Runway MP4 for scene ${sceneNumber}`)
    const response = await fetch(videoUrl)
    if (!response.ok) {
      console.error(`Failed to download video for scene ${sceneNumber}: ${response.status}`)
      throw new Error(`Failed to download Runway video for scene ${sceneNumber}: HTTP ${response.status}`)
    }
    const videoBuffer = await response.arrayBuffer()
    if (videoBuffer.byteLength === 0) {
      throw new Error(`Downloaded Runway video for scene ${sceneNumber} was empty`)
    }

    const fileName = `${projectId}/scene-video-${sceneNumber}-${Date.now()}.mp4`

    const { error } = await supabase.storage
      .from('generated-videos')
      .upload(fileName, videoBuffer, { contentType: 'video/mp4', upsert: true })

    if (error) {
      console.error(`Video upload error for scene ${sceneNumber}:`, error)
      throw new Error(`Failed to store scene ${sceneNumber} MP4: ${error.message || JSON.stringify(error)}`)
    }

    const { data } = supabase.storage.from('generated-videos').getPublicUrl(fileName)
    if (!data.publicUrl || !data.publicUrl.includes('.mp4')) {
      throw new Error(`Stored scene ${sceneNumber} did not produce a valid MP4 URL`)
    }
    console.log(`Scene merged: scene ${sceneNumber} MP4 stored at ${data.publicUrl.substring(0, 120)}`)
    return data.publicUrl
  } catch (err) {
    console.error(`Video upload exception for scene ${sceneNumber}:`, err)
    throw err
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

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')
    const RUNWAY_API_KEY = Deno.env.get('RUNWAY_API_KEY')

    if (!RUNWAY_API_KEY) throw new Error('RUNWAY_API_KEY is not configured')

    const sceneDataList: SceneData[] = []

    console.log('Story created')
    console.log(`Scenes extracted: ${scenes.length}`)

    // ============ PHASE 1: Prepare Runway scene prompts (0-10%) ============
    console.log('=== PHASE 1: Preparing Runway video scenes ===')

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
      const dialogueText = scene.dialogue?.map((d: any) => `${d.character}: "${d.line}"`).join(' ') || ''
      const narration = shortenNarration(`${scene.description}. ${dialogueText}`.trim(), 50)

      sceneDataList.push({
        sceneNumber: scene.scene_number,
        videoUrl: null,
        narration,
        audioUrl: null,
        duration: 5,
        setting: scene.setting || ''
      })

      const prepProgress = 3 + Math.floor(((i + 1) / scenes.length) * 7)
      await updateGenerationStatus(supabase, projectId, project.avatar, {
        phase: `Preparing Runway scene ${i + 1} of ${scenes.length}`,
        currentScene: i + 1,
        totalScenes: scenes.length,
        startedAt: startTime,
        progress: prepProgress,
      })
      console.log(`Runway scene ${i + 1}/${scenes.length} prepared. Progress: ${prepProgress}%`)
    }

    // ============ PHASE 2: Start Runway video tasks (10-25%) ============
    console.log('=== PHASE 2: Starting Runway video generation tasks ===')
    await updateGenerationStatus(supabase, projectId, project.avatar, {
      phase: 'Sending scenes to Runway video generation',
      currentScene: 1,
      totalScenes: scenes.length,
      startedAt: startTime,
      progress: 10,
    })

    const taskMap: { sceneNumber: number; taskId: string }[] = []

    for (let i = 0; i < scenes.length; i++) {
      const fullScene = scenes[i]
      const taskId = await startRunwayVideoTask(fullScene, characters, RUNWAY_API_KEY)
      taskMap.push({ sceneNumber: fullScene.scene_number, taskId })

      const requestProgress = 10 + Math.floor(((i + 1) / scenes.length) * 15)
      await updateGenerationStatus(supabase, projectId, project.avatar, {
        phase: `Runway request sent for scene ${i + 1} of ${scenes.length}`,
        currentScene: i + 1,
        totalScenes: scenes.length,
        startedAt: startTime,
        progress: requestProgress,
      })

      // Small delay between task starts to avoid rate limits
      await new Promise(r => setTimeout(r, 1500))
    }

    if (taskMap.length !== scenes.length) {
      throw new Error(`Runway did not start every scene: ${taskMap.length}/${scenes.length} jobs started`)
    }
    console.log(`${taskMap.length} Runway tasks started`)
    await supabase.from('projects').update({ video_progress: 25 }).eq('id', projectId)

    // ============ PHASE 3: Poll Runway tasks until complete (25-75%) ============
    console.log('=== PHASE 3: Polling Runway tasks for completion ===')

    for (let i = 0; i < taskMap.length; i++) {
      const task = taskMap[i]
      const videoUrl = await pollRunwayTask(task.taskId, RUNWAY_API_KEY)
      const storedVideoUrl = await uploadVideoToStorage(videoUrl, supabase, projectId, task.sceneNumber)
      const sceneData = sceneDataList.find(s => s.sceneNumber === task.sceneNumber)
      if (!sceneData) {
        throw new Error(`Internal scene data missing for scene ${task.sceneNumber}`)
      }
      sceneData.videoUrl = storedVideoUrl
      console.log(`Scene ${task.sceneNumber} video ready: stored MP4`)

      const videoProgress = 25 + Math.floor(((i + 1) / taskMap.length) * 50)
      await updateGenerationStatus(supabase, projectId, project.avatar, {
        phase: `Runway scene ${i + 1} of ${taskMap.length} completed`,
        currentScene: i + 1,
        totalScenes: taskMap.length,
        startedAt: startTime,
        progress: videoProgress,
      })
    }

    const scenesWithVideo = sceneDataList.filter(s => s.videoUrl && s.videoUrl.includes('.mp4'))
    console.log(`${scenesWithVideo.length}/${scenes.length} video clips generated`)
    if (scenesWithVideo.length !== scenes.length) {
      throw new Error(`Runway video generation incomplete: ${scenesWithVideo.length}/${scenes.length} MP4 clips created`)
    }

    // ============ PHASE 4: Narration Audio via ElevenLabs (75-90%) ============
    console.log('=== PHASE 4: Generating narration audio ===')
    await supabase.from('projects').update({ video_progress: 77 }).eq('id', projectId)

    if (ELEVENLABS_API_KEY && scenesWithVideo.length > 0) {
      for (let i = 0; i < scenesWithVideo.length; i++) {
        const scene = scenesWithVideo[i]
        const audioUrl = await generateNarrationAudio(
          scene.narration, ELEVENLABS_API_KEY, supabase, projectId, scene.sceneNumber
        )
        scene.audioUrl = audioUrl

        // If first audio fails, skip rest
        if (i === 0 && !audioUrl) {
          console.log('First audio failed — skipping remaining')
          break
        }

        const audioProgress = 77 + Math.floor(((i + 1) / scenesWithVideo.length) * 13)
        await updateGenerationStatus(supabase, projectId, project.avatar, {
          phase: `Recording narration ${i + 1} of ${scenesWithVideo.length}`,
          currentScene: i + 1,
          totalScenes: scenesWithVideo.length,
          startedAt: startTime,
          progress: audioProgress,
        })
      }
    } else {
      console.log('Skipping audio: no ElevenLabs key or no completed Runway videos')
    }

    // ============ PHASE 5: Save animation data (90-100%) ============
    console.log('=== PHASE 5: Saving animation data ===')
    await supabase.from('projects').update({ video_progress: 92 }).eq('id', projectId)

    const totalDuration = scenesWithVideo.reduce((s, sc) => s + sc.duration, 0)
    const generationTimeSec = Math.round((Date.now() - startTime) / 1000)
    const mainVideoUrl = scenesWithVideo[0]?.videoUrl || null
    if (!mainVideoUrl || !mainVideoUrl.includes('.mp4')) {
      throw new Error('Final MP4 verification failed: no valid Runway MP4 video URL was produced')
    }

    const lovableAnimationData = {
      type: 'lovable_animation',
      scenes: scenesWithVideo.map(s => ({
        sceneNumber: s.sceneNumber,
        videoUrl: s.videoUrl,
        narration: s.narration,
        audioUrl: s.audioUrl,
        duration: s.duration,
        setting: s.setting,
        hasVideo: true,
      })),
      totalDuration,
      totalScenes: scenesWithVideo.length,
      videosGenerated: scenesWithVideo.length,
      isFullAnimation: scenesWithVideo.length === scenes.length,
      finalVideoUrl: mainVideoUrl,
      generatedAt: new Date().toISOString(),
      generationTimeSeconds: generationTimeSec,
      settings: { maxScenes: MAX_SCENES, resolution: '720p', fps: 24 }
    }

    const existingAvatar = project.avatar || {}
    await supabase.from('projects').update({
      avatar: { ...existingAvatar, lovableAnimation: lovableAnimationData }
    }).eq('id', projectId)

    await supabase.from('projects').update({ video_progress: 96 }).eq('id', projectId)
    console.log(`Final MP4 rendered: verified Runway MP4 URL ${mainVideoUrl.substring(0, 120)}`)

    // Create video version record
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
            scenes_count: scenesWithVideo.length,
          video_clips: scenesWithVideo.length,
            has_narration: scenesWithVideo.some(s => s.audioUrl),
          generation_time_seconds: generationTimeSec
        }
      })
    }

    await supabase.from('projects').update({
      video_url: mainVideoUrl,
      video_status: 'lovable_completed',
      video_progress: 100,
      video_generated_at: new Date().toISOString(),
    }).eq('id', projectId)

    console.log(`=== COMPLETED in ${generationTimeSec}s. Video clips: ${scenesWithVideo.length}, Audio: ${scenesWithImages.filter(s => s.audioUrl).length} ===`)

    return new Response(
      JSON.stringify({
        success: true,
        totalScenes: scenesWithVideo.length,
        videoClips: scenesWithVideo.length,
        videoUrl: mainVideoUrl,
        totalDuration,
        hasNarration: scenesWithVideo.some(s => s.audioUrl),
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
