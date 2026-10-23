"""Original 100 BPM cinematic electronic soundtrack. Run from repo root.
Requirements: numpy, imageio-ffmpeg. Video frames are copied unchanged.
"""
from pathlib import Path
import subprocess
import tempfile
import wave
import numpy as np
import imageio_ffmpeg

RATE, DURATION, BEAT = 48000, 24.2, 0.5
mix = np.zeros((round(RATE * DURATION), 2))
rng = np.random.default_rng(23)

def clock(seconds):
    return np.arange(round(RATE * seconds)) / RATE

def add(sound, start, gain, pan=0):
    offset = round(start * RATE)
    count = min(len(sound), len(mix) - offset)
    if count > 0:
        angle = (pan + 1) * np.pi / 4
        mix[offset:offset + count] += gain * sound[:count, None] * [np.cos(angle), np.sin(angle)]

def hz(note):
    return 440 * 2 ** ((note - 69) / 12)

def pluck(note, duration=0.65):
    t = clock(duration)
    phase = 2 * np.pi * hz(note) * t
    voice = sum(np.sin(h * phase) * np.exp(-t * (5 + h * 2)) / h for h in range(1, 7))
    return voice * np.minimum(t / 0.004, 1) * np.minimum((duration - t) / 0.04, 1)

# Cinematic electronic: 100 BPM, spacious half-time percussion, deep pulses,
# evolving harmonic texture and three deliberate sections across the film.
BEAT = 0.6

def impact(start, gain=1):
    t = clock(2.1)
    phase = 2 * np.pi * (38 * t + 72 * 0.045 * (1 - np.exp(-t / 0.045)))
    low = np.sin(phase) * np.exp(-t * 3.8)
    noise = rng.standard_normal(len(t))
    air = np.convolve(noise, np.ones(24) / 24, mode='same')
    hit = (low + 0.45 * air * np.exp(-t * 5)) * np.minimum(t / 0.003, 1)
    add(hit, start, 0.45 * gain)
    add(air * np.exp(-t * 2), start + 0.04, 0.08 * gain, -0.6)
    add(air * np.exp(-t * 2), start + 0.09, 0.08 * gain, 0.6)

# Sustained, dark synth harmonics breathe around the bass pulses.
for section, chord in enumerate([(50, 57, 60, 64), (46, 53, 57, 60),
                                  (53, 60, 64, 67), (48, 55, 62, 64)]):
    t = clock(6.2)
    env = np.minimum(t / 0.24, 1) * np.clip((6.2 - t) / 0.7, 0, 1)
    duck = 0.65 + 0.35 * (1 - np.exp(-np.mod(t, BEAT) * 11))
    for voice, note in enumerate(chord):
        for pan, detune in [(-0.7, 0.998), (0.7, 1.002)]:
            phase = 2 * np.pi * hz(note) * detune * t
            synth = sum(np.sin(h * phase) / h ** 1.7 for h in range(1, 9))
            add(synth * env * duck, section * 6, 0.035, pan)
    impact(section * 6, 1 if section in (0, 2) else 0.7)

for step in range(39):
    start = step * BEAT
    root = [26, 22, 29, 24][min(int(start // 6), 3)]
    t = clock(0.52)
    f = hz(root)
    bass = np.sin(2 * np.pi * f * t) + 0.38 * np.sin(4 * np.pi * f * t)
    bass += 0.12 * np.sin(6 * np.pi * f * t)
    env = np.minimum(t / 0.012, 1) * np.exp(-t * 7) * np.clip((0.52 - t) / 0.08, 0, 1)
    add(bass * env, start, 0.34 if step % 2 == 0 else 0.21)
    # Second section introduces sparse metallic ticks, then the full percussion.
    if start >= 6:
        t = clock(0.085)
        tick = sum(np.sin(2 * np.pi * f * t) for f in (1670, 2311, 3463)) / 3
        tick *= np.exp(-t * 65) * np.minimum(t / 0.002, 1)
        add(tick, start + BEAT / 2, 0.055, (-1) ** step * 0.5)
    if step % 4 == 2 and start >= 6:
        t = clock(0.4)
        noise = rng.standard_normal(len(t))
        snap = np.tanh(noise - np.roll(noise, 1)) * np.exp(-t * 25)
        snap += 0.3 * np.sin(2 * np.pi * 170 * t) * np.exp(-t * 18)
        snap *= np.minimum(t / 0.002, 1)
        add(snap, start, 0.12)
        add(snap, start + 0.12, 0.025, 0.7)
    if step % 2 == 0:
        t = clock(0.32)
        phase = 2 * np.pi * (45 * t + 75 * 0.025 * (1 - np.exp(-t / 0.025)))
        add(np.sin(phase) * np.exp(-t * 15) * np.minimum(t / 0.002, 1), start, 0.28)

# A sparse descending sonic signature, voiced low rather than as bright bells.
for start in (0.2, 6.2, 12.2, 18.2):
    for i, note in enumerate((74, 69, 64)):
        t = clock(1.4)
        phase = 2 * np.pi * hz(note) * t
        voice = (np.sin(phase) + 0.25 * np.sin(2 * phase))
        voice *= np.minimum(t / 0.025, 1) * np.exp(-t * 3.3) * np.clip((1.4 - t) / 0.2, 0, 1)
        add(voice, start + i * BEAT * 0.75, 0.09, (i - 1) * 0.3)
        add(voice, start + i * BEAT * 0.75 + 0.3, 0.025, 0.65)

# Filtered rising air leads into the reveal; the final hit leaves a clean tail.
for start in (10.6, 16.6):
    t = clock(1.4)
    noise = rng.standard_normal(len(t))
    air = np.convolve(noise, np.ones(10) / 10, mode='same')
    air *= (t / 1.4) ** 2 * np.minimum((1.4 - t) / 0.03, 1)
    add(air, start, 0.18, -0.4)
    add(air, start + 0.025, 0.14, 0.4)
impact(22.8, 0.85)
t = clock(DURATION)
mix *= (np.minimum(t / 0.015, 1) * np.clip((DURATION - t) / 0.65, 0, 1))[:, None]
# +5 dB RMS over the original -29.8 dBFS, with at least 2 dB peak headroom.
peak = np.max(np.abs(mix))
mix *= min(10 ** (-24.8 / 20) / np.sqrt(np.mean(mix ** 2)), 10 ** (-2 / 20) / peak)
assert np.isfinite(mix).all() and np.max(np.abs(mix)) < 0.8
video = Path('public/ownly-how-it-works.mp4')
with tempfile.TemporaryDirectory(prefix='ownly-score-') as directory:
    wav = Path(directory) / 'cinematic.wav'
    output = Path(directory) / 'with-audio.mp4'
    with wave.open(str(wav), 'wb') as stream:
        stream.setnchannels(2)
        stream.setsampwidth(2)
        stream.setframerate(RATE)
        stream.writeframes((mix * 32767).astype('<i2').tobytes())
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-hide_banner', '-loglevel', 'error',
                    '-i', str(video), '-i', str(wav), '-map', '0:v:0', '-map', '1:a:0',
                    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
                    '-movflags', '+faststart', '-shortest', str(output)], check=True)
    video.write_bytes(output.read_bytes())
print(f'Original cinematic score: {DURATION}s, RMS {20*np.log10(np.sqrt(np.mean(mix**2))):.1f} dBFS, peak {20*np.log10(np.max(np.abs(mix))):.1f} dBFS')
