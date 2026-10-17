#!/usr/bin/env python3
"""An original 18-second Bacom cue, synthesized without samples or models.

Run with the existing project virtualenv:
  brag-output/.venv/bin/python brag-output-2026-10-17-210515/synth-score.py
Only numpy and Python's standard library are required.
"""
from pathlib import Path
import json
import math
import wave
import numpy as np

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "composition" / "assets"
SR, DURATION, BEAT = 44100, 18.0, 0.45
N = int(SR * DURATION)
RNG = np.random.default_rng(210617)
dry = np.zeros((N, 2), np.float64)
melody = np.zeros_like(dry)
ambient = np.zeros_like(dry)
drums = np.zeros_like(dry)
kick_times = []


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def clock(seconds):
    return np.arange(round(seconds * SR)) / SR


def envelope(t, attack=.004, decay=.3, release=.04):
    return (1 - np.exp(-t / attack)) * np.exp(-t / decay) * np.minimum(1, np.maximum(0, (t[-1] - t) / release))


def place(bus, signal, when, gain=1, pan=0):
    start = round(when * SR)
    if start < 0:
        signal = signal[-start:]
        start = 0
    count = min(len(signal), N - start)
    if count <= 0:
        return
    if signal.ndim == 1:
        signal = signal[:, None] * np.array([math.sqrt((1-pan)/2), math.sqrt((1+pan)/2)])[None, :]
    bus[start:start+count] += gain * signal[:count]


def band_noise(seconds, low, high):
    size = round(seconds * SR)
    noise = RNG.normal(0, 1, size)
    frequency = np.fft.rfftfreq(size, 1/SR)
    spec = np.fft.rfft(noise)
    mask = (1 - np.exp(-(frequency / max(low, 1))**4)) * np.exp(-(frequency/high)**6)
    shaped = np.fft.irfft(spec * mask, size)
    return shaped / max(np.std(shaped), 1e-8)


def kick():
    t = clock(.48)
    # Integrated exponential pitch sweep prevents a discontinuous oscillator.
    phase = 2*np.pi*(46*t + 98*.022*(1-np.exp(-t/.022)))
    body = np.sin(phase) * np.exp(-t/.105)
    click = band_noise(.48, 1900, 6000) * np.exp(-t/.0035) * .15
    return np.tanh(1.35*(body+click)) * (1-np.exp(-t/.0005))


def snare():
    t = clock(.24)
    skin = (.52*np.sin(2*np.pi*181*t) + .15*np.sin(2*np.pi*329*t)) * np.exp(-t/.036)
    wire = band_noise(.24, 1100, 8100) * np.exp(-t/.052) * .35
    return (skin+wire) * (1-np.exp(-t/.001))


def hat(opened=False):
    length = .20 if opened else .065
    t = clock(length)
    noise = band_noise(length, 6800, 14500)
    # Short inharmonic oscillator cluster adds metallic character.
    metal = sum(np.sin(2*np.pi*f*t) for f in [7411, 8523, 10913]) / 6
    return (noise*.75+metal) * envelope(t, .0007, .048 if opened else .013, .015)


def bass(midi, seconds):
    t = clock(seconds)
    f = hz(midi)
    phase = 2*np.pi*f*t + .12*(1-np.exp(-t/.02))
    tone = np.sin(phase) + .23*np.sin(phase*2) + .09*np.sin(phase*3)
    return np.tanh(tone*1.15) * envelope(t, .006, .35, .035)


def pluck(midi, seconds=.7):
    t = clock(seconds)
    f = hz(midi)
    # Warm fundamental with rapidly decaying upper partials, not random bleeps.
    tone = np.sin(2*np.pi*f*t)
    tone += .30*np.sin(2*np.pi*2*f*t)*np.exp(-t/.07)
    tone += .13*np.sin(2*np.pi*3.002*f*t)*np.exp(-t/.045)
    tone += .05*np.sin(2*np.pi*5*f*t)*np.exp(-t/.025)
    return tone*envelope(t, .0025, .16, .06)


def pad(notes, seconds):
    t = clock(seconds)
    left, right = np.zeros(len(t)), np.zeros(len(t))
    for midi in notes:
        f = hz(midi)
        left += np.sin(2*np.pi*f*.9987*t) + .14*np.sin(2*np.pi*f*1.999*t)
        right += np.sin(2*np.pi*f*1.0013*t+.13) + .14*np.sin(2*np.pi*f*2.001*t+.08)
    env = np.minimum(t/.13, 1)*np.minimum((seconds-t)/.50, 1)
    env *= (.85+.15*np.sin(2*np.pi*.32*t))
    return np.column_stack([left, right])*env[:, None]/len(notes)


def sweep(when, seconds, falling=False, gain=.08):
    t = clock(seconds)
    progress = t/seconds
    carrier = band_noise(seconds, 800, 8500)
    # A rising resonant tonal sweep under the air, synthesized from scratch.
    freq = 180 + 1750*(1-progress if falling else progress)**2
    tone = np.sin(2*np.pi*np.cumsum(freq)/SR)*.15
    env = (1-progress)**2 if falling else progress**2*np.minimum((seconds-t)/.035, 1)
    stereo = np.column_stack([carrier, np.roll(carrier, 53)])*.5
    stereo += tone[:, None]
    place(ambient, stereo*env[:, None], when, gain)


# Ten 4/4 bars. F# minor -> Dmaj9 -> Aadd9 -> Esus -> Dmaj9 -> F#m9.
chords = [
    (30, [54, 57, 61, 68]), (30, [54, 57, 61, 68]),
    (26, [54, 57, 61, 64]), (26, [54, 57, 61, 64]),
    (33, [52, 57, 59, 64]), (33, [52, 57, 59, 64]),
    (28, [52, 57, 59, 66]), (28, [52, 56, 59, 66]),
    (26, [54, 57, 61, 64]), (30, [54, 57, 61, 68]),
]

for bar, (root, notes) in enumerate(chords):
    beat = bar*4
    if bar < 8:
        place(ambient, pad(notes, 2.35), beat*BEAT, .105)
    for offset, length, velocity in [(0,.7,1), (1.5,.42,.80), (2.5,.35,.72), (3.25,.48,.86)]:
        position = beat+offset
        if position < 34:
            place(melody, bass(root, length), position*BEAT, .28*velocity)
    # A coherent eight-step motif follows the chord tones and leaves space.
    motif = [0, 2, 1, 3, 2, 1, 3, 2]
    for step, degree in enumerate(motif):
        position = beat+step*.5
        if position >= 34:
            continue
        if bar == 0 and step < 2:
            continue
        midi = notes[degree] + 12
        pan = [-.38, .23, -.15, .42][step%4]
        velocity = [1,.52,.7,.55,.82,.48,.68,.5][step]
        place(melody, pluck(midi), position*BEAT, .105*velocity, pan)

# Rhythm grows from a precise opening pulse to a tight, understated full groove.
for beat in range(40):
    if beat >= 36:
        continue
    if beat%4 in [0,2] or (beat >= 4 and beat%4 == 3 and beat%8 == 7):
        when = beat*BEAT
        place(drums, kick(), when, .64)
        kick_times.append(when)
    if beat%4 in [1,3] and beat >= 4 and beat < 34:
        place(drums, snare(), beat*BEAT, .235, .025)
        # Quiet delayed synthetic wire gives the backbeat a little room.
        place(ambient, snare(), beat*BEAT+.027, .025, -.4)
    if beat >= 2 and beat < 34:
        for offset in [0,.5]:
            gain = .038 if offset == 0 else .024
            place(drums, hat(), (beat+offset)*BEAT, gain, -.28 if offset == 0 else .35)
        if beat%4 == 3 and beat >= 8:
            place(drums, hat(True), (beat+.5)*BEAT, .021, .28)

# The five-beat editorial transitions get their own short, restrained accents.
cues = [2.25, 6.75, 11.25, 15.30]
for index, when in enumerate(cues):
    sweep(when-.40, .40, gain=.065 if index < 3 else .09)
    sweep(when, .45, falling=True, gain=.065)
    place(drums, kick(), when, .35)
    kick_times.append(when)
    for note, delay, velocity in [(78,0,.055),(85,.035,.025)]:
        place(ambient, pluck(note, .75), when+delay, velocity, -.18 if delay == 0 else .20)

# Final 2.7 seconds: the suspended harmony resolves and percussion gives way.
place(ambient, pad([54,57,61,68], 2.70), 15.30, .19)
place(melody, bass(30, 1.70), 15.30, .29)
place(melody, pluck(78, 1.4), 15.30, .12, -.12)
place(melody, pluck(80, 1.4), 15.525, .055, .16)
place(melody, pluck(81, 1.7), 15.75, .095, .10)

# Synchronized, subtle ducking keeps the synthesized kick clear of the harmony.
duck = np.ones(N)
for when in kick_times:
    start = round(when*SR)
    length = min(round(.22*SR), N-start)
    t = np.arange(length)/SR
    duck[start:start+length] *= 1-.25*np.exp(-t/.065)
melody *= duck[:, None]
ambient *= (.8+.2*duck[:, None])

# Stereo delays and a synthetic diffuse tail. Every echo derives from our voices.
wet = np.zeros_like(dry)
for delay, gain in [(.225,.17),(.3375,.10),(.45,.07),(.675,.04)]:
    shift = round(delay*SR)
    wet[shift:] += melody[:-shift, ::-1]*gain
for delay, gain in [(.071,.11),(.113,.085),(.173,.065),(.251,.055),(.389,.043),(.571,.03),(.817,.02)]:
    shift = round(delay*SR)
    source = ambient[:-shift]+melody[:-shift]*.30
    wet[shift:] += source[:, ::-1]*gain

mix = drums+melody+ambient+wet
# Remove subsonic drift and tame high-frequency energy with smooth FFT filters.
freq = np.fft.rfftfreq(N, 1/SR)
response = (1-np.exp(-(freq/25)**4))*np.exp(-(freq/17500)**8)
mix = np.fft.irfft(np.fft.rfft(mix, axis=0)*response[:,None], n=N, axis=0)
mix = np.tanh(mix*1.12)
fade = round(.14*SR)
mix[-fade:] *= np.linspace(1,0,fade)[:,None]
mix[:round(.003*SR)] *= np.linspace(0,1,round(.003*SR))[:,None]
peak_target = 10**(-1.4/20)
mix *= peak_target/np.max(np.abs(mix))
pcm = (mix*32767).round().astype('<i2')
ASSETS.mkdir(parents=True, exist_ok=True)
target = ASSETS/'original-score.wav'
with wave.open(str(target), 'wb') as wav:
    wav.setnchannels(2)
    wav.setsampwidth(2)
    wav.setframerate(SR)
    wav.writeframes(pcm.tobytes())

manifest = {
    'title':'Kept Close — original Bacom product cue',
    'composer':'Code synthesis for this project',
    'duration':DURATION, 'sampleRate':SR, 'channels':2,
    'bpm':133.33333333333334, 'beatDuration':BEAT, 'beats':40,
    'key':'F# minor', 'seed':210617,
    'sources':'Mathematical oscillators and seeded noise only; no samples, models, or existing media.',
    'events':[
        {'time':0,'label':'Immediate opening pulse; warm F# minor identity'},
        {'time':2.25,'label':'Import/review transition: rising air and tonal accent'},
        {'time':6.75,'label':'Reveal transition: sweep, sub impact, upper pluck'},
        {'time':11.25,'label':'Local features transition: descending airy accent'},
        {'time':15.30,'label':'Closing resolution into F#m9; percussion drops away'},
        {'time':16.20,'label':'Final three-note melodic resolution settles'},
        {'time':17.86,'label':'140 ms clean audio release; visual remains on screen'},
    ],
    'peakDbFS':round(float(20*np.log10(np.max(np.abs(mix)))),3),
    'rmsDbFS':round(float(20*np.log10(np.sqrt(np.mean(mix**2)))) ,3),
}
(ROOT/'music-cues.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(json.dumps({'file':str(target), 'duration':N/SR, 'peakDbFS':manifest['peakDbFS'], 'rmsDbFS':manifest['rmsDbFS'], 'frames':N, 'bytes':target.stat().st_size}))
