# /manage-voices - Voice Management for localhost:party

Use ElevenLabs MCP tools to manage voices for AI agent personas.

## Available Operations

### List Voices

List all available ElevenLabs voices to find suitable voices for game personas.

```
Use elevenlabs_get_voices to list available voices with their IDs and characteristics.
```

### Test a Voice

Generate test audio to preview how a voice sounds.

```
Use elevenlabs_text_to_speech with:
- voice_id: The voice ID to test
- text: Sample text (e.g., "Welcome to localhost party! Get ready for some fun!")
- output_format: "mp3_44100_128"
```

### Create Voice for Persona

When creating a new AI agent persona, help select an appropriate voice:

1. **Game Host (Chip Sterling)**: Needs enthusiastic, warm, announcer-style voice
   - Recommended: `pqHfZKP75CvOlQylNhV4` (Bill - crisp, friendly narrator)
   - Alternative: `pNInz6obpgDQGcFmaJgB` (Adam - brash and confident)

2. **Commentator (Snarky Sam)**: Needs witty, slightly sarcastic tone
   - Recommended: `IKne3meq5aSn9XLyUdCD` (Charlie - young Australian, energetic)
   - Alternative: `SOYHLrjzK2X1ezoPC6cr` (Harry - animated)

### Voice Configuration

After selecting voices, update `/lib/agents/personas/voice-config.ts` with the mappings:

```typescript
export const AGENT_VOICE_CONFIG = {
  "chip-sterling": {
    voiceId: "pqHfZKP75CvOlQylNhV4",
    name: "Bill",
    description: "Crisp, friendly narrator",
  },
  "snarky-sam": {
    voiceId: "IKne3meq5aSn9XLyUdCD",
    name: "Charlie",
    description: "Young Australian, energetic",
  },
};
```

## Tips

- Test voices with game-relevant phrases before finalizing
- Consider voice characteristics that match persona personality traits
- Keep voice IDs in sync with `/lib/audio/narrator.ts` VOICE_IDS mapping
- ElevenLabs has rate limits - batch test multiple voices in sequence, not parallel
