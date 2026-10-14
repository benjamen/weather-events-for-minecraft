#!/usr/bin/env python3
"""Generates Weather Events' wind assets from code (original, CC0): the leaf particle texture and the wind howl."""
import json, os, subprocess, tempfile, wave
import numpy as np
from PIL import Image
RP = os.path.join(os.path.dirname(__file__), "..", "RP")
# 8x8 leaf: pointed oval with a lighter midrib, autumn green-brown.
img = np.zeros((8, 8, 4), np.uint8)
for y in range(8):
    for x in range(8):
        u, v = (x - 3.5) / 3.6, (y - 3.5) / 2.2
        if abs(u + v * 0.5) ** 2 + (v * 0.8) ** 2 < 0.9 and abs(x - y) <= 4:
            shade = 0.75 + 0.25 * (x == y)
            img[y, x] = [int(120 * shade), int(130 * shade), int(50 * shade), 255]
Image.fromarray(img, "RGBA").save(os.path.join(RP, "textures", "particle", "wx_leaf.png"))
SR = 44100; r = np.random.default_rng(5); n = SR * 6; t = np.arange(n) / SR
def lp(x, c):
    a = np.exp(-2 * np.pi * c / SR); y = np.zeros_like(x); s = 0.0
    for i, v in enumerate(x): s = (1 - a) * v + a * s; y[i] = s
    return y
x = lp(r.standard_normal(n), 380) * 1.2 + lp(r.standard_normal(n), 1400) * 0.5
x *= 0.45 + 0.55 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.31 * t)) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.11 * t + 2))
k = SR // 2; x[:k] *= np.linspace(0, 1, k); x[-k:] *= np.linspace(1, 0, k)
x = x / np.max(np.abs(x)) * 0.8
os.makedirs(os.path.join(RP, "sounds", "wx"), exist_ok=True)
with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
    with wave.open(tmp.name, "wb") as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype("<i2").tobytes())
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name, "-c:a", "libvorbis", "-q:a", "4", os.path.join(RP, "sounds", "wx", "wind_1.ogg")], check=True)
os.unlink(tmp.name)
json.dump({"format_version": "1.20.20", "sound_definitions": {"wx.wind": {"category": "weather", "max_distance": 48, "sounds": [{"name": "sounds/wx/wind_1", "volume": 0.8, "load_on_low_memory": True}]}}}, open(os.path.join(RP, "sounds", "sound_definitions.json"), "w"), indent=2)
print("wrote leaf texture and wind howl")
