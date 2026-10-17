# Showcase verification

18-second,3840×2160 screenshot-led product film. The revised output is bacom-showcase-v2.mp4; the earlier1080p showcase and narrated film are preserved. The user explicitly requested the export and this correction, so local rendering is authorized without another approval step.

## Provenance

Product visuals are real Electron screenshots captured with synthetic data in a fresh repository-local profile, at1440×900 logical resolution and4× pixel density. Full captures are5760×3600. See CAPTURES.md and composition/capture-app.mjs. Music is synthesized from mathematical oscillators and seeded noise; see AUDIO.md and synth-score.py. No image, video, speech, or audio generation model, stock sound, or sample was used for this video.

## Review and fixes

The reported empty import panel was reproduced at2.6seconds with every image already decoded and the panel opacity at0.9694. Fractional opacity flattens its preserve-3d descendants, letting the opaque rear pseudo-element paint over the screenshot. Explicit nonnegative stacking order now puts the far rear face at0, near rear face at1, screenshots at2, light face at3, and sheen at4. This preserves the existing3D transforms and keeps screenshots visible during every entrance and exit. All screenshots are decoded before the completed timeline is registered. A subagent reviewed stacking, seek behavior, initialization, and capture geometry; its negative-index suggestion was changed to nonnegative indices to avoid unnecessary lint warnings.

The screenshot source was recaptured at4× density and the export increased to4K60 with CRF14. The stage stays1920×1080 logical pixels; the renderer uses2× output density. There is no sharpening filter or artificial reconstruction of UI. Copy and usage confirmation remain separate actual app states.

## Automated checks

Final Hyperframes check passed with zero runtime, layout, motion, or contrast errors and warnings.52 text contrast checks and300 motion samples passed, including revealed-code-before-used ordering. Five existing lint warnings recommend subcompositions; the short film retains one editable HTML timeline. Two informational layout entries describe the intentional clipped title entrance at7seconds. No new finding was suppressed.

Encoded entrance frames were inspected at2.35,2.6,2.9,6.85,7.1,11.45,13.25,15.5, and16.2seconds. Exit and settled frames were inspected at6.7,10.55,11.3,14.25,15.3, and17.15seconds. Every entering panel carries its screenshot during fractional opacity. The import UI was also inspected at native output resolution to check label sharpness. Final poster-encoded delivery was checked again at2.6seconds. Contact sheets and detail crops are under .cache/showcase-qc/.

## Export

Rendered locally with native screenshot capture and hardware GPU, preserving CSS3D perspective. Final bacom-showcase-v2.mp4 is H.264/AAC,3840×2160 at60fps, exactly18.000seconds and1080frames,11,501,924bytes. Audio runs18seconds and peaks at−1.2dBFS without clipping. The settled light-theme closing frame at17.15seconds was extracted as bacom-showcase-v2.jpg and baked into framezero at CRF14, preserving timing and copying the audio stream. The full MP4 decodes successfully. No remote publishing or GitHub push.

Reproduce the render from composition/:

```sh
bunx hyperframes render --fps 60 --resolution landscape-4k --quality delivery --crf 14 --experimental-fast-capture=false --output ../bacom-showcase-v2.mp4
```
