# Composition brief — Bacom

Create a 24-second, 1920×1080 landscape product film from brag-plan.md. Preset polished: precise, tactile transitions with room to read, monochrome source identity, no decorative filler. The story is a real recovery-code workflow, not a slideshow of claims.

Source truth: ../../src/App.tsx, ../../src/index.css, ../../README.md, ../../SECURITY.md relative to composition/. Recreate enlarged, readable pieces of actual UI rather than shrinking a whole desktop screenshot. Labels: Add codes, Reveal a code, Copy, Copied, Mark as used. Codes must never be marked used merely by copying. Use synthetic demo data only. Do not show not-yet-implemented features.

Follow the four scenes and voiceover in brag-plan.md. Keep product text readable at in-feed size. Use the source system sans identity; a local font file is preferable if a named font is used. Retain exact source palette. Build an editable GSAP paused timeline with finite duration, deterministic seeking, and local runtime/audio assets.

Music: assets/music/bed-faded.mp3 derived from brag's vol-12, trimmed to 24 seconds with faded edges. Optional cues: 4.39, 10.93, 19.66 seconds. Tone is restrained; use only motion-matched SFX. Voice: assets/voiceover-paced.wav, Kokoro af_heart at speed 0.78, measured 21.269 seconds; own track at volume 1. Music at 0.12 while voice is active. Keep all audio local and declare each clip with a unique id and its own track index when overlapping.

Run Hyperframes check with zero errors and inspect snapshots. Launch the local preview for approval; do not render until approved. No remote publishing or external distribution.
