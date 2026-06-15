// Server-only ElevenLabs text-to-speech helper.
const ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";
const MODEL = "eleven_multilingual_v2";

export async function elevenTTS(text: string, voiceId: string): Promise<{ audio: string; mime: string }> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY ausente. Configure o secret no Lovable.");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: MODEL,
        // stability mais baixa = mais expressivo/natural; speaker_boost melhora
        // a fidelidade da voz; similarity alta mantém o timbre.
        voice_settings: { stability: 0.45, similarity_boost: 0.85, style: 0.0, use_speaker_boost: true },
      }),
      signal: ctrl.signal,
    });
  } catch (e) {
    if (ctrl.signal.aborted) throw new Error("ElevenLabs não respondeu em 30s (timeout).");
    throw e;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text();
    if (body.includes("quota_exceeded") || body.includes("credits")) {
      throw new Error("ElevenLabs: créditos esgotados nesta conexão.");
    }
    if (res.status === 401) throw new Error("ElevenLabs: chave inválida ou conexão expirada (401).");
    if (res.status === 429) throw new Error("ElevenLabs: limite/créditos atingidos.");
    throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 160)}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return { audio: buf.toString("base64"), mime: "audio/mpeg" };
}
