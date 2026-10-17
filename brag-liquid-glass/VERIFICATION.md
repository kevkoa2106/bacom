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
