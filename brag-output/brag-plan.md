# Bacom — Your fallback, kept close

## Planning rubric
1. App: an offline desktop vault for two-factor recovery codes.
2. Strongest claim: one recovery code, ready when your second factor is unavailable.
3. Visual hook: a scattered downloaded text file becomes an orderly, encrypted local vault.
4. Source UI: Add codes import review, account list, Reveal a code, Copy, Mark as used.
5. Minimum satisfying duration: 24 seconds with narration and readable UI.
6. Tone: polished; quiet confidence and precise monochrome product demonstration.
7. Audio: Kokoro af_heart narration, low steady music bed, three quiet motion-matched clicks.
8. Share caption: I built Bacom: an offline vault that keeps recovery codes organized, encrypted, and ready when you need them.
9. Flow: import a downloaded file → review its codes → reveal one → explicitly confirm usage.

## Visual identity
Landscape, 1920×1080, 24 seconds. Preserve the actual dark palette: #0a0a0a background, #1f1f20 surfaces, #373839 separators, #dbdbdb text, #999999 secondary text. System sans typography reflects the app; code values use monospace. Large readable UI reproductions come from src/App.tsx and src/index.css. No invented services, verified-security badges, metrics, cloud sync, or unreleased features. All code values and account details are synthetic; no private files are read.

## Storyboard
### 0–4 seconds — The fallback
Headline: “Second factor missing?” A simple file of synthetic recovery codes sits alongside the question. The file moves toward a vault window as “Keep your way back in.” replaces the question. Soft slide, no noisy effects.
### 4–10 seconds — Import and review
Recreate the Add codes dialog. Website: github.com; account label: Personal demo. recovery-codes.txt appears; three synthetic codes populate the review. A cursor selects Save codes. Label: “Import. Review. Keep.” Entries appear in sequence, then hold together for at least two seconds. Quiet click on save.
### 10–19 seconds — One code, used deliberately
Recreate account selection and the Reveal a code dialog. Master password is shown only as dots; one synthetic code and its Copy control appear after confirmation. Copy changes to Copied. Mark as used is explicitly clicked; remaining count changes 3 → 2 only then. Headline: “One code. When you need it.” A small “Demo codes” note remains visible. Two quiet clicks accompany Copy and Mark as used.
### 19–24 seconds — Brand close
Large bacom. wordmark, “Your fallback, kept close.” and github.com/kevkoa2106/bacom. A small product viewport retains the remaining-code state. Let the final composition hold; no fade to black.

## Voiceover script
Losing your second factor shouldn't mean losing your account. Bacom keeps your recovery codes in one encrypted, offline vault. Import the file. Review the codes. Reveal one when you need it, then mark it used only after it works. Your backup plan, kept close.

Generated with Kokoro af_heart at speed 0.78: 21.269 seconds, assets/voiceover-paced.wav. The remaining 2.731 seconds provide a music-only closing hold.

## Audio and music cue guidance
Music: Happy Beats / Business Moves vol-12 by ende.app, bundled with brag; steady and clean, 109.96 BPM. Bed at 0.12 under voice, short fade in and out. Optional timing anchors: 4.39 for import emergence, 10.93 for code reveal, 19.66 for closing wordmark; readability takes priority. No audio-reactive decoration. SFX are restrained interface clicks matching real simulated actions. Narration uses Kokoro only, explicitly requested for this run. Measure its duration before finalizing; never exceed 25 seconds.

## Delivery
Local editable composition and preview first. Hyperframes requires approval of the finished preview before MP4 rendering. After approval: check, render brag.mp4, choose a settled product frame for brag.jpg and bake it into frame zero, write share-copy.txt. Do not publish or push the video without a separate request.
