---
name: voice-ai
description: >-
  Guidelines and architecture patterns for implementing realtime voice AI, speech-to-text (STT),
  text-to-speech (TTS), audio streaming, WebSockets, voice activity detection (VAD), and
  conversational voice UX. Use when building voice features, handling live audio streams, or adding
  interactive voice assistants.
---

# Voice AI & Realtime Audio UX Skill

## Core Principles

1. **State Machine UI**: Always expose clear visual indicators for the current voice interaction state.
2. **Low Latency**: Use streaming audio over WebSockets or WebRTC for sub-second responses.
3. **Barge-in / Interruption Handling**: Immediately halt playback when the user starts speaking.

## Voice Interaction States

Maintain state explicitly in React/state management:

- **`IDLE`**: Voice assistant inactive, microphone muted, tap-to-talk button visible.
- **`LISTENING`**: Microphone active, VAD capturing speech, audio waveform pulsing.
- **`THINKING`**: User finished speaking, LLM processing prompt, spinner/shimmer effect.
- **`SPEAKING`**: Audio playing back to user, voice waveform active.
- **`INTERRUPTED`**: User spoke while assistant was speaking; stop playback immediately & switch to `LISTENING`.
- **`ERROR`**: Connection lost, permission denied, or API failure; show retry prompt & clear error toast.

## Architecture Checklist

- [ ] Implement VAD (Voice Activity Detection) to detect speech end automatically.
- [ ] Handle browser microphone permissions gracefully with fallbacks for denied access.
- [ ] Stream audio chunks via WebSockets or SSE instead of waiting for complete files.
- [ ] Provide accessible visual alternatives (live captions/transcripts) alongside voice audio.
