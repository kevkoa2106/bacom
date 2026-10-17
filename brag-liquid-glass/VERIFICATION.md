# Liquid Glass edition verification

The new film uses the finished showcase-v2 as its footage and preserves the earlier movies. It does not modify the app. Sources, hashes, and attribution are in SOURCES.md; choreography is in brag-plan.md.

## Material and motion

Live SVG backdrop displacement bends the actual footage through rounded glass lenses and diagonal transition ribbons. Colorless tint, narrow polished rims, and low environmental light keep the material clear. Stronger center deformation is limited to the moving opening lens and short optical wipes. The revealed code remains clear of glass overlays.

The transparent WebGL2 layer ray-marches interlocking, twisting ribbons. Analytical studio reflections, Fresnel falloff, thin-film phase, and caustic contours supply depth without models or texture assets. The source video beneath the sculpture remains the real capture; the sculpture's reflected environment is procedural. All motion comes from the paused GSAP timeline and absolute time, with no wall-clock animation or random state.

The two droplets converge on Copy, fade their internal seam, and separate on usage confirmation. Large refractive sweeps align with the existing editorial transitions. During reading holds, the sculpture occupies lower negative space; it contracts and shifts for the settings feature list. The ending retains the original light-theme vault and adds a small edition signature.

## Review fixes

- Corrected a reversed-edge GLSL smoothstep, whose result was undefined across GPUs.
- Used sin-squared beat envelopes so position, scale, and presence meet the holds without a velocity kink.
- Removed an initialization animation-frame wait that could deadlock against the renderer's paused clock. A frozen-clock browser test now initializes in 31 ms with active decoded maps.
- Verified filter sharing, independence from GSAP transforms, true CSS-size rebuilding, and cleanup/fallback behavior in browser tests.
- Moved and reduced the hold sculpture to clear the original footer and settings labels.
- Removed a lower glass accent that crossed the original right footer.
- Removed a lens whose rim crossed the recovery-code digits in the encoded close-up.
- Retained a scoped data-layout-allow-overflow marker on the intentionally full-bleed optical artwork. It contains no text. No Impeccable ignore was added.

## Final preflight

The pinned Hyperframes 0.8.167 full check passes with zero lint, runtime, layout, motion, or contrast errors and warnings. The motion specification passes 300 samples. The added HTML signature passes its contrast check. Text inside the source MP4 is footage, so its legibility is checked visually rather than claimed as a new DOM contrast audit.

Source snapshots, a complete encoded 1080p draft, and transition/hold contact sheets were reviewed. The draft exposed the initialization delay and footer conflicts above; those were fixed before the final 4K export. No image, video, or audio generation model was used. The music remains the original synthesized score, without samples.

## Delivered MP4

bacom-liquid-glass.mp4 is H.264/AAC at 3840×2160 and 60 fps, exactly 18.000 seconds and 1,080 frames, 21,103,499 bytes. It was rendered with the pinned CLI, PNG source-frame extraction, native screenshot capture, and hardware GPU. Final initialization took 1.4 seconds with no timeline readiness timeout. The master rendered in 66.1 seconds.

Actual encoded frames were inspected at 0.7, 2.3, 5, 6.7, 8.15, 9.97, 11.35, 14.2, and 17.2 seconds. The code shot was checked as an enlarged crop, and checked again after poster encoding: the digits, Copy button, explanatory text, and usage confirmation are unobstructed. Contact sheets and crops are in .cache/showcase-qc/.

The settled closing frame at 17.2 seconds was extracted as bacom-liquid-glass.jpg and baked into frame zero at CRF 14. All remaining timing is preserved and the audio stream is copied. The final file decodes fully; audio lasts 18 seconds and peaks at −1.2 dBFS without clipping. The original score plays once. The file uses fast-start metadata for playback while downloading. Earlier renders and the original showcase-v2 remain available. Nothing was published or pushed remotely.

Reproduce the master from composition/ with `bun run render`; the poster step uses the existing brag workflow's single-frame overlay. The source video and rendered MP4s are ignored by Git, with provenance recorded in SOURCES.md.
