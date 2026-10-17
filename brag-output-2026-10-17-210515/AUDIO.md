# Original score: Kept Close

`composition/assets/original-score.wav` is a newly composed 18-second electronic cue made entirely in code. It uses no audio generation model, recorded sound, stock music, sample, or preexisting media.

## Musical arrangement

133⅓ BPM, exactly 40 beats. The harmonic progression moves through F♯m9, Dmaj9, Aadd9, Esus/E, then returns to F♯ minor for the ending. A recurring eight-step plucked motif follows the chord tones; deliberate velocity and pan patterns keep the melody coherent. Syncopated rounded bass supports a restrained electronic groove. The last 2.7 seconds resolve into a sustained F♯m9 chord and three-note phrase as the drums drop away.

Transition accents and synthesized air sweeps land at 2.25, 6.75, 11.25, and 15.30 seconds. `music-cues.json` documents these edit points. The 140 ms final release avoids a truncated audio tail.

## Synthesis

- Kick: integrated exponential sine-frequency sweep, decaying low fundamental, short filtered-noise attack, gentle saturation.
- Snare: two decaying membrane oscillators plus seeded band-shaped noise.
- Hats: filtered seeded noise and an inharmonic oscillator cluster, with separate open/closed envelopes.
- Bass: sine fundamental and restrained second/third harmonics through soft saturation.
- Pluck: harmonic oscillators with different decay rates for the fundamental and upper partials.
- Pad: detuned stereo harmonic oscillators with attack/release envelopes.
- Effects: mathematical tonal sweeps and filtered noise; tempo-synced stereo cross-delay and diffuse reflections derive only from the newly synthesized voices.

The synthesizer applies subtle kick-driven ducking, removes subsonic drift, softens the top end, and normalizes the result to −1.4 dBFS. Randomness uses a fixed seed for a reproducible render.

## Reproduce

From the repository root:

```sh
brag-output/.venv/bin/python brag-output-2026-10-17-210515/synth-score.py
```

The script requires Python and NumPy; it writes the WAV and cue manifest. The existing project virtual environment already has NumPy. It does not download assets or invoke any external generation service.

## File measurements

| Property | Value |
|---|---|
| Duration | 18.000 seconds |
| Sample rate | 44,100 Hz |
| Channels | Stereo |
| Encoding | 16-bit PCM WAV |
| Frames | 793,800 |
| Sample peak | −1.400 dBFS |
| RMS | −16.327 dBFS |
| Integrated loudness (FFmpeg EBU R128) | −16.5 LUFS |
| True peak (FFmpeg EBU R128) | −1.4 dBTP |
| Loudness range (FFmpeg EBU R128) | 1.4 LU |
| Size | 3,175,244 bytes |
