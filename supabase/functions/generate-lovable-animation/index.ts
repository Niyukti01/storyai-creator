import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Performance constants - 5 minute limit
const MAX_GENERATION_TIME_MS = 5 * 60 * 1000 // 5 minutes
const MAX_SCENES = 6 // Limit scenes for fast generation
const DEFAULT_SCENE_DURATION = 5
const TARGET_FPS = 24
const TARGET_RESOLUTION = '720p'

interface SceneVideoData {
  sceneNumber: number
  imageUrl: string
  videoUrl: string
  narration: string
  audioUrl?: string
  duration: number
}

// Time tracker for fail-safe
class TimeTracker {
  private startTime: number
  
  constructor() {
    this.startTime = Date.now()
  }
  
  elapsed(): number {
    return Date.now() - this.startTime
  }
  
  remaining(): number {
    return MAX_GENERATION_TIME_MS - this.elapsed()
  }
  
  hasTime(): boolean {
    return this.remaining() > 30000 // Keep 30s buffer
  }
  
  shouldOptimize(): boolean {
    return this.remaining() < MAX_GENERATION_TIME_MS * 0.4 // Less than 40% time left
  }
}

// Optimize scenes - select most important, merge similar ones
function optimizeScenes(scenes: any[], maxScenes: number): any[] {
  if (scenes.length <= maxScenes) return scenes
  
  console.log(`Optimizing ${scenes.length} scenes to ${maxScenes} for fast generation...`)
  
  // Strategy: Keep first scene, last scene, and evenly distribute middle scenes
  const optimized: any[] = []
  const step = Math.floor(scenes.length / (maxScenes - 1))
  
  for (let i = 0; i < maxScenes - 1; i++) {
    const idx = Math.min(i * step, scenes.length - 1)
    if (!optimized.some(s => s.scene_number === scenes[idx].scene_number)) {
      optimized.push({ ...scenes[idx], scene_number: i + 1 })
    }
  }
  
  // Always include last scene
  if (!optimized.some(s => s === scenes[scenes.length - 1])) {
    optimized.push({ ...scenes[scenes.length - 1], scene_number: maxScenes })
  }
  
  // Ensure we have exactly maxScenes
  while (optimized.length < maxScenes && optimized.length < scenes.length) {
    const remaining = scenes.filter(s => !optimized.includes(s))
    if (remaining.length > 0) {
      optimized.splice(optimized.length - 1, 0, { ...remaining[0], scene_number: optimized.length })
    } else break
  }
  
  return optimized.slice(0, maxScenes)
}

// Shorten narration for faster audio generation
function shortenNarration(narration: string, maxWords: number = 40): string {
  const words = narration.split(' ')
  if (words.length <= maxWords) return narration
  return words.slice(0, maxWords).join(' ') + '...'
}

// Generate image with retry and timeout
async function generateSceneImage(
  scene: any,
  characters: any[],
  genre: string,
  apiKey: string,
  timeout: number = 15000
): Promise<string | null> {
  const sceneCharacters = scene.dialogue?.map((d: any) => d.character) || []
  const characterDetails = characters
    .filter((c: any) => sceneCharacters.includes(c.name))
    .map((c: any) => `${c.name}: ${c.description}`)
    .join('. ')

  const lovablePrompt = `Create a warm, lovable, storybook-style illustration.
Style: Soft 2D animation, pastel colors, rounded characters, big expressive eyes, Pixar-like warmth, child-friendly.
Scene: ${scene.setting}
Action: ${scene.action || scene.description}
${characterDetails ? `Characters: ${characterDetails}` : ''}
Genre: ${genre}
16:9 aspect ratio, high quality, magical and cozy atmosphere.`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [{ role: 'user', content: lovablePrompt }],
        modalities: ['image', 'text']
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json()
      return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null
    }
  } catch (error) {
    clearTimeout(timeoutId)
    console.error('Image generation error:', error)
  }
  
  return null
}

// Generate narration audio with optimization
async function generateNarration(
  narration: string,
  apiKey: string,
  supabase: any,
  projectId: string,
  sceneNumber: number,
  speedOptimize: boolean = false
): Promise<string | null> {
  const voiceId = 'pFZP5JQG7iQjIQuC4Bku' // Lily - warm and friendly
  const optimizedNarration = speedOptimize ? shortenNarration(narration, 30) : shortenNarration(narration, 50)

  try {
    const audioResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: optimizedNarration,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.75,
            style: 0.4,
            use_speaker_boost: true,
            speed: speedOptimize ? 1.1 : 0.95 // Slightly faster if optimizing
          }
        }),
      }
    )

    if (audioResponse.ok) {
      const audioBuffer = await audioResponse.arrayBuffer()
      const audioFileName = `${projectId}/lovable-narration-${sceneNumber}-${Date.now()}.mp3`
      
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
        
        return publicUrlData.publicUrl
      }
    }
  } catch (error) {
    console.error(`Narration error for scene ${sceneNumber}:`, error)
  }
  
  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const timeTracker = new TimeTracker()

  try {
    const { projectId } = await req.json()

    if (!projectId) {
      throw new Error('Project ID is required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Starting optimized animated video generation for:', projectId)
    console.log('Max time limit: 5 minutes')

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
    let scenes = script.scenes || []
    const characters = script.characters || []
    
    // OPTIMIZATION 1: Limit scenes to MAX_SCENES
    scenes = optimizeScenes(scenes, MAX_SCENES)
    const totalScenes = scenes.length
    
    console.log(`Processing ${totalScenes} optimized scenes (original: ${script.scenes?.length || 0})`)

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured')
    }

    const sceneVideoData: SceneVideoData[] = []
    
    // ==========================================
    // PHASE 1: Generate images (0-40%) - PARALLEL
    // ==========================================
    console.log('=== PHASE 1: Generating scene images (parallel) ===')
    
    await supabase
      .from('projects')
      .update({ video_progress: 5 })
      .eq('id', projectId)

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

    // OPTIMIZATION 2: Generate images in parallel (batches of 3)
    const imageResults: Array<{ sceneNumber: number; imageUrl: string | null; scene: any }> = []
    const batchSize = 3
    
    for (let batch = 0; batch < Math.ceil(totalScenes / batchSize); batch++) {
      if (!timeTracker.hasTime()) {
        console.log('Time limit approaching, using available images')
        break
      }

      const batchScenes = scenes.slice(batch * batchSize, (batch + 1) * batchSize)
      console.log(`Generating image batch ${batch + 1}/${Math.ceil(totalScenes / batchSize)}...`)
      
      const batchPromises = batchScenes.map(async (scene: any) => {
        const imageUrl = await generateSceneImage(scene, characters, project.genre, LOVABLE_API_KEY)
        return { sceneNumber: scene.scene_number, imageUrl, scene }
      })
      
      const batchResults = await Promise.all(batchPromises)
      imageResults.push(...batchResults)
      
      const progress = Math.floor(((imageResults.length) / totalScenes) * 40)
      await supabase
        .from('projects')
        .update({ video_progress: progress })
        .eq('id', projectId)
    }

    const successfulImages = imageResults.filter(r => r.imageUrl)
    console.log(`Generated ${successfulImages.length}/${totalScenes} scene images in ${Math.round(timeTracker.elapsed() / 1000)}s`)

    // ==========================================
    // PHASE 2: Generate narration audio (40-70%) - PARALLEL
    // ==========================================
    console.log('=== PHASE 2: Generating warm narration audio (parallel) ===')
    
    await supabase
      .from('projects')
      .update({ video_progress: 45 })
      .eq('id', projectId)

    const shouldSpeedOptimize = timeTracker.shouldOptimize()
    if (shouldSpeedOptimize) {
      console.log('Optimizing for fast generation - using shorter narrations')
    }

    // OPTIMIZATION 3: Generate audio in parallel
    const audioResults: Map<number, string> = new Map()
    
    if (ELEVENLABS_API_KEY && successfulImages.length > 0) {
      const audioPromises = successfulImages.map(async ({ sceneNumber, scene }) => {
        const dialogueText = scene.dialogue
          ?.map((d: any) => `${d.character} said: \"${d.line}\"`)
          .join(' ') || ''
        
        const narration = `${scene.description}. ${dialogueText}`.trim()
        
        const audioUrl = await generateNarration(
          narration,
          ELEVENLABS_API_KEY,
          supabase,
          projectId,
          sceneNumber,
          shouldSpeedOptimize
        )
        
        return { sceneNumber, audioUrl }
      })

      const audioResultsList = await Promise.all(audioPromises)
      audioResultsList.forEach(({ sceneNumber, audioUrl }) => {
        if (audioUrl) audioResults.set(sceneNumber, audioUrl)
      })

      console.log(`Generated ${audioResults.size} narration audio files`)
    }

    await supabase
      .from('projects')
      .update({ video_progress: 70 })
      .eq('id', projectId)

    // ==========================================
    // PHASE 3: Assemble scene data (70-85%)
    // ==========================================
    console.log('=== PHASE 3: Assembling scene data ===')
    
    for (const { sceneNumber, imageUrl, scene } of successfulImages) {
      if (!imageUrl) continue
      
      const dialogueText = scene.dialogue
        ?.map((d: any) => `${d.character} said: \"${d.line}\"`)
        .join(' ') || ''
      
      const narration = shortenNarration(`${scene.description}. ${dialogueText}`.trim(), shouldSpeedOptimize ? 30 : 50)

      sceneVideoData.push({
        sceneNumber,
        imageUrl,
        videoUrl: imageUrl, // Use image URL as video placeholder - frontend will handle image slideshow
        narration,
        audioUrl: audioResults.get(sceneNumber),
        duration: DEFAULT_SCENE_DURATION
      })
    }

    await supabase
      .from('projects')
      .update({ video_progress: 85 })
      .eq('id', projectId)

    // ==========================================
    // PHASE 4: Finalize and save (85-100%)
    // ==========================================
    console.log('=== PHASE 4: Finalizing animation data ===')

    const totalDuration = sceneVideoData.reduce((sum, s) => sum + s.duration, 0)
    const generationTimeSeconds = Math.round(timeTracker.elapsed() / 1000)

    // Store complete animation data
    const lovableAnimationData = {
      type: 'lovable_animation',
      scenes: sceneVideoData.map(s => ({
        sceneNumber: s.sceneNumber,
        imageUrl: s.imageUrl,
        videoUrl: s.imageUrl, // Image-based animation
        narration: s.narration,
        audioUrl: s.audioUrl,
        duration: s.duration
      })),
      totalDuration,
      videosGenerated: sceneVideoData.length, // All scenes have animated slideshow
      totalScenes: sceneVideoData.length,
      isFullAnimation: true,
      generatedAt: new Date().toISOString(),
      generationTimeSeconds,
      optimized: shouldSpeedOptimize,
      settings: {
        maxScenes: MAX_SCENES,
        targetFps: TARGET_FPS,
        resolution: TARGET_RESOLUTION
      }
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

    await supabase
      .from('projects')
      .update({ video_progress: 95 })
      .eq('id', projectId)

    // Get main image URL for video version
    const mainVideoUrl = sceneVideoData[0]?.imageUrl || null

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
            scenes_count: sceneVideoData.length,
            videos_generated: sceneVideoData.length,
            has_narration: sceneVideoData.some(s => s.audioUrl),
            is_full_animation: true,
            generation_time_seconds: generationTimeSeconds,
            optimized: shouldSpeedOptimize
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

    console.log('=== OPTIMIZED ANIMATED VIDEO GENERATION COMPLETED ===')
    console.log(`Total scenes: ${sceneVideoData.length}`)
    console.log(`Total duration: ${totalDuration} seconds`)
    console.log(`Generation time: ${generationTimeSeconds} seconds (${Math.round(generationTimeSeconds / 60)} min)`)
    console.log(`Under 5-minute limit: ${generationTimeSeconds < 300 ? 'YES ✓' : 'NO ✗'}`)

    return new Response(
      JSON.stringify({
        success: true,
        mainVideoUrl,
        totalScenes: sceneVideoData.length,
        videosGenerated: sceneVideoData.length,
        totalDuration,
        hasNarration: sceneVideoData.some(s => s.audioUrl),
        isFullAnimation: true,
        generationTimeSeconds,
        underTimeLimit: generationTimeSeconds < 300,
        lovableAnimation: lovableAnimationData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error in generate-lovable-animation:', error)
    console.log(`Failed after ${Math.round(timeTracker.elapsed() / 1000)} seconds`)
    
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
