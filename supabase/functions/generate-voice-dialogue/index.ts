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

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not configured')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Fetching project data for voice generation:', projectId)

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

    if (!project.voice_sample_url) {
      throw new Error('No voice sample uploaded. Please upload a voice sample first.')
    }

    console.log('Voice sample URL:', project.voice_sample_url)

    // Step 1: Download the voice sample
    const voiceSampleResponse = await fetch(project.voice_sample_url)
    if (!voiceSampleResponse.ok) {
      throw new Error('Failed to download voice sample')
    }
    const voiceSampleBlob = await voiceSampleResponse.blob()
    const voiceSampleArrayBuffer = await voiceSampleBlob.arrayBuffer()

    // Step 2: Add voice to ElevenLabs (create a cloned voice)
    const formData = new FormData()
    formData.append('name', `Project_${projectId}_Voice`)
    formData.append('files', new Blob([voiceSampleArrayBuffer], { type: 'audio/webm' }), 'sample.webm')
    formData.append('description', 'Voice clone for animated movie project')

    console.log('Creating voice clone in ElevenLabs...')
    const addVoiceResponse = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: formData,
    })

    if (!addVoiceResponse.ok) {
      const errorText = await addVoiceResponse.text()
      console.error('ElevenLabs add voice error:', errorText)
      throw new Error(`Failed to create voice clone: ${errorText}`)
    }

    const voiceData = await addVoiceResponse.json()
    const voiceId = voiceData.voice_id
    console.log('Voice clone created with ID:', voiceId)

    // Step 3: Generate dialogue for each character
    const script = project.script
    const scenes = script.scenes || []
    const dialogueAudio: any[] = []

    console.log('Generating dialogue audio...')
    for (const scene of scenes) {
      if (scene.dialogue && scene.dialogue.length > 0) {
        for (const line of scene.dialogue) {
          console.log(`Generating audio for: "${line.line}"`)

          // Generate speech using the cloned voice
          const ttsResponse = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
              method: 'POST',
              headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                text: line.line,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                  stability: 0.5,
                  similarity_boost: 0.75,
                },
              }),
            }
          )

          if (!ttsResponse.ok) {
            console.error(`Failed to generate audio for line: ${line.line}`)
            continue
          }

          const audioArrayBuffer = await ttsResponse.arrayBuffer()
          const base64Audio = btoa(
            String.fromCharCode(...new Uint8Array(audioArrayBuffer))
          )

          dialogueAudio.push({
            scene_number: scene.scene_number,
            character: line.character,
            text: line.line,
            emotion: line.emotion,
            audioBase64: base64Audio,
          })
        }
      }
    }

    console.log(`Generated ${dialogueAudio.length} audio segments`)

    // Store the voice ID and dialogue audio in the project's avatar field
    const avatarData = project.avatar || {}
    avatarData.voiceId = voiceId
    avatarData.dialogueAudio = dialogueAudio

    const { error: updateError } = await supabase
      .from('projects')
      .update({ avatar: avatarData as any })
      .eq('id', projectId)

    if (updateError) {
      throw updateError
    }

    console.log('Voice dialogue generation completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        voiceId,
        audioCount: dialogueAudio.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    console.error('Error in generate-voice-dialogue function:', error)

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
