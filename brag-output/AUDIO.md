# Local audio

- Narration: Kokoro-82M, voice af_heart, English, speed 0.78. Text is in composition/narration.txt. Duration: 21.269 seconds.
- Music: Happy Beats / Business Moves vol-12 by ende.app, supplied by the brag skill. The preview uses a 24-second excerpt with faded edges at volume 0.12.
- Click: Kenney mouseclick1.ogg, supplied by the brag skill; used only at simulated interface actions.

Regenerate narration from the repository root after creating the isolated environment:

```sh
uv venv brag-output/.venv
uv pip install --python brag-output/.venv/bin/python kokoro-onnx soundfile
HYPERFRAMES_PYTHON="$PWD/brag-output/.venv/bin/python" bunx hyperframes tts brag-output/composition/narration.txt --voice af_heart --speed 0.78 --output brag-output/composition/assets/voiceover-paced.wav --json
```

The speech model and voice data are cached locally by Hyperframes. No real passwords, account records, or recovery-code files are used in this composition.
