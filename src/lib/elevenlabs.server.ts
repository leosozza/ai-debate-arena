// Server-only ElevenLabs text-to-speech helper.
const ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";
const MODEL = "eleven_multilingual_v2";

export async function elevenTTS(text: string, voiceId: string): Promise<{ audio: string; mime: string }> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY ausente. Configure o secret no Lovable.");

  const res = await fetch(`${ENDPOINT}/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401) throw new Error("ElevenLabs: chave inválida (401).");
    if (res.status === 429) throw new Error("ElevenLabs: limite/créditos atingidos.");
    throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 160)}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return { audio: buf.toString("base64"), mime: "audio/mpeg" };
}
