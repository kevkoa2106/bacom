# Showcase verification

18-second,1920×1080 screenshot-led product film. New output preserves the previous narrated film. The user explicitly requested a finished MP4, so local rendering is authorized without another approval step.

## Provenance

Product visuals are real Electron screenshots captured with synthetic data in a fresh repository-local profile, at1440×900 logical resolution and2× pixel density. See CAPTURES.md and composition/capture-app.mjs. Music is synthesized from mathematical oscillators and seeded noise; see AUDIO.md and synth-score.py. No image, video, speech, or audio generation model, stock sound, or sample was used for this video.

## Review and fixes

The composition subagent's code was reviewed against the actual screenshot geometry and product flow. Audio received a stable id; the root uses framework canvas sizing. Initial CSS opacity prevents delayed entrances from flashing early. Screenshot planes now match the imported-dialog aspect ratios. The light-theme face has the correct depth above the dark screenshot. A real account-detail capture makes the post-confirmation count legible. Copy and usage confirmation remain separate states. Captures were upgraded to2× density for enlarged UI details.

## Automated checks

Final Hyperframes check passed with zero runtime, layout, motion, or contrast errors and warnings.52 text contrast checks passed. Motion assertions passed across300 samples, including revealed-code-before-used ordering. Five source snapshots were inspected in one first pass and the corrected import and final light-theme frames in one confirmation pass. Five remaining lint warnings recommend subcompositions; this short film intentionally retains one editable HTML timeline. No finding was suppressed.

## Export

Rendering locally at60fps in delivery quality with native screenshot capture, preserving CSS3D perspective. Pending final encoded-file verification, poster extraction from the settled closing frame, and frame-zero baking. No remote publishing or GitHub push.
