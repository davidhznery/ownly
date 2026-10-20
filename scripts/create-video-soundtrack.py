"""Create Ownly's original ambient score and mux it into the existing video.
Developer requirements: pip install numpy imageio-ffmpeg
Run from the repository root: python scripts/create-video-soundtrack.py
"""
from pathlib import Path
import math
import subprocess
import tempfile
import wave
import numpy as np
import imageio_ffmpeg

video = Path("public/ownly-how-it-works.mp4")
rate, duration = 48000, 24.2
t = np.arange(round(rate * duration)) / rate
left = np.zeros_like(t)
right = np.zeros_like(t)
# Original slow Cmaj9 / Am9 / Fmaj9 / Gsus progression: no sampled music.
chords = [(48, 55, 59, 62, 64), (45, 52, 55, 59, 60),
          (41, 48, 52, 55, 57), (43, 50, 55, 57, 62)]
for index, chord in enumerate(chords):
    start = index * 6
    local = t - start
    envelope = np.clip(local / 1.7, 0, 1) * np.clip((8 - local) / 2.4, 0, 1)
    for voice, note in enumerate(chord):
        frequency = 440 * 2 ** ((note - 69) / 12)
        shimmer = 0.8 + 0.2 * np.sin(2 * np.pi * 0.11 * t + voice)
        for channel, detune in [(left, -0.0012), (right, 0.0012)]:
            phase = 2 * np.pi * frequency * (1 + detune) * local
            pad = np.sin(phase) + 0.16 * np.sin(2 * phase) + 0.04 * np.sin(3 * phase)
            channel += 0.028 * envelope * shimmer * pad
# Soft bell notes, with a quiet stereo echo.
for beat, note in enumerate([72, 76, 79, 74, 71, 76, 72, 67, 69, 72, 76, 79]):
    for channel, delay, gain in [(left, 0, 1), (right, 0.24, 0.65)]:
        local = t - (1.1 + beat * 1.8 + delay)
        positive = np.maximum(local, 0)
        envelope = (local >= 0) * (1 - np.exp(-positive * 25)) * np.exp(-positive * 1.7)
        frequency = 440 * 2 ** ((note - 69) / 12)
        channel += gain * 0.022 * envelope * np.sin(2 * np.pi * frequency * local)
fade = np.clip(t / 1.8, 0, 1) * np.clip((duration - t) / 2.2, 0, 1)
stereo = np.column_stack((left * fade, right * fade))
peak = float(np.max(np.abs(stereo)))
assert 0 < peak < 0.5, peak
pcm = (stereo * 32767).astype("<i2")
with tempfile.TemporaryDirectory(prefix="ownly-score-") as directory:
    wav = Path(directory) / "ambient.wav"
    output = Path(directory) / "with-audio.mp4"
    with wave.open(str(wav), "wb") as stream:
        stream.setnchannels(2)
        stream.setsampwidth(2)
        stream.setframerate(rate)
        stream.writeframes(pcm.tobytes())
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run([ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
                    "-i", str(video), "-i", str(wav), "-map", "0:v:0", "-map", "1:a:0",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
                    "-movflags", "+faststart", "-shortest", str(output)], check=True)
    video.write_bytes(output.read_bytes())
print(f"Created original stereo score: {duration}s, peak {20 * math.log10(peak):.1f} dBFS")
