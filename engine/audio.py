# Builds the soundtrack for a rendered template: synthesized music bed, sound effects on the picture's cues,
# and the voice lines, with the music ducked under the voice. Everything is generated here, so nothing is licensed from a library.
# python audio.py <out dir>
import json, subprocess, sys, wave
from pathlib import Path
import numpy as np

SR = 48000
d = Path(sys.argv[1])
tl = json.loads((d / "timeline.json").read_text("utf8"))
T = tl["T"]
N = int(T * SR)
PAD = SR * 4
rng = np.random.default_rng(7)


class Bus:
    def __init__(self):
        self.L = np.zeros(N + PAD)
        self.R = np.zeros(N + PAD)

    def add(self, s, at, g=1.0, pan=0.0):
        i = int(at * SR)
        if i < 0 or i >= N:
            return
        s = s[: len(self.L) - i]
        self.L[i : i + len(s)] += s * g * (1 - max(0, pan))
        self.R[i : i + len(s)] += s * g * (1 + min(0, pan))

    def stereo(self):
        return np.stack([self.L[:N], self.R[:N]], 1)


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def env(t, a, r):
    return np.minimum(1, t / a) * np.exp(-t / r)


def band(n, lo, hi):
    F = np.fft.rfft(rng.standard_normal(n))
    fr = np.fft.rfftfreq(n, 1 / SR)
    c, w = np.log((lo * hi) ** 0.5), np.log(hi / lo) / 2
    x = np.fft.irfft(F * np.exp(-(((np.log(fr + 1) - c) / w) ** 2)), n)
    return x / np.abs(x).max()


music, fx, voice = Bus(), Bus(), Bus()
# A template picks its tempo and mood: "drive" is dark and punchy, "soft" is bright and light.
A = {"bpm": 120, "style": "drive", **tl.get("audio", {})}
SOFT = A["style"] in ("soft", "pop", "happy")
HAPPY = A["style"] == "happy"  # hand claps, a shaker and a whistled tune over the marimba
HARD = A["style"] == "hard"  # like drive, plus a gritty bass line and a quieter pad
RETRO = A["style"] == "retro"  # eighties: the running sequence plus a big gated snare and a saw bass
PULSE = A["style"] in ("pulse", "retro")  # minor key with a running sixteenth-note sequence
POP = A["style"] == "pop"  # bright and bouncy: marimba, octave bass, claps
AMB = A["style"] == "ambient"  # no drums: a wide slow pad, sparse bells and a soft pulse on each bar
CHIP = A["style"] == "chip"  # 8-bit console: square-wave lead, triangle bass, noise drums, no pad
STAB = A["style"] == "stab"  # dance feel: steady kick, bright chord stabs on the off-beats, walking bass
CINE = A["style"] == "cine"  # film trailer: a low drone and a ticking clock, no beat; the hits come from the cues
LOFI = A["style"] == "lofi"  # slow, warm electric-piano chords with a brushed backbeat
ROOT = 73.42 if CINE else 130.81 if SOFT else 98.0 if HARD else 146.83 if LOFI else 110.0
CH = [[0, 4, 7, 12], [5, 9, 12, 17], [7, 11, 14, 19], [0, 4, 7, 12]] if CHIP else [[0, 3, 7, 10], [5, 8, 12, 15], [-2, 2, 5, 9], [-5, -1, 2, 7]] if LOFI else [[0, 4, 7, 11], [5, 9, 12, 16], [-3, 0, 4, 7], [-5, 2, 7, 11]] if SOFT else [[0, 3, 7, 10], [-4, 0, 3, 7], [-7, -4, 0, 3], [-2, 2, 5, 10]] if PULSE else [[0, 7, 14, 16], [-4, 3, 8, 15], [-7, 5, 9, 12], [-2, 5, 10, 14]]
BEAT = 60 / A["bpm"]
PUNCH = 0.7 if A["style"] == "happy" else 0.6 if A["style"] == "chip" else 0.85 if A["style"] == "pop" else 0.45 if SOFT else 0.75 if PULSE else 0.55 if LOFI else 1.0  # how hard the low hits land
BAR = BEAT * 4
m = tl["marks"]

# Music: a soft pad throughout, plucks from the logo, kick and bass under the product scenes, a held chord at the end.
k = 0
while k * BAR < T:
    ch = CH[k % 4]
    t = tt(BAR + 0.9)
    sh = np.minimum(1, t / 0.5) * np.minimum(1, np.maximum(0, (t[-1] - t) / 0.9))
    for j, st in enumerate(ch):
        f = ROOT * 2 ** (st / 12)
        s = sum(np.sin(2 * np.pi * f * h * (1 + dt) * t + j) / h**2 for h in (1, 2, 3) for dt in (-0.0018, 0.0018))
        music.add(s * sh, k * BAR, 0.05 if CINE else 0.0 if CHIP else 0.011 if HARD else 0.034 if AMB else 0.02, (-0.4, 0.3, -0.15, 0.4)[j])
    for q in range(8):
        at = k * BAR + q * BEAT / 2
        if CINE and q % 2 == 0 and m["beatIn"] <= at < m["beatOut"] - 0.2:  # clock tick
            t = tt(0.03)
            music.add((np.sin(2 * np.pi * 3200 * t) * 0.6 + rng.standard_normal(len(t)) * 0.4) * env(t, 0.0005, 0.006), at, 0.035 if (q // 2) % 2 else 0.02, 0.15)
        if CHIP and at < T - 0.8:
            for h16 in range(2):  # square-wave arpeggio in sixteenths
                t = tt(BEAT / 4 * 0.9)
                f = ROOT * 4 * 2 ** (ch[(q * 2 + h16) % 4] / 12)
                music.add(np.sign(np.sin(2 * np.pi * f * t)) * np.minimum(1, t / 0.002) * np.minimum(1, (t[-1] - t) / 0.01), at + h16 * BEAT / 4, 0.016, (-0.3, 0.3)[h16])
            t = tt(BEAT / 2 * 0.9)  # triangle bass in eighths
            f = ROOT / 2 * 2 ** (ch[0] / 12) * (2 if q % 4 == 3 else 1)
            music.add(2 / np.pi * np.arcsin(np.sin(2 * np.pi * f * t)) * np.minimum(1, (t[-1] - t) / 0.02), at, 0.09)
            if q % 4 == 2:  # noise snare
                t = tt(0.12)
                music.add(np.sign(rng.standard_normal(len(t))) * env(t, 0.001, 0.035), at, 0.05)
        if STAB and q % 2 == 1 and tl["s"][1] <= at < T - 0.9:  # off-beat chord stab
            t = tt(0.22)
            for j, st in enumerate(ch):
                f = ROOT * 2 * 2 ** (st / 12)
                saw = sum(np.sin(2 * np.pi * f * h * t) / h for h in range(1, 7))
                music.add(saw * env(t, 0.003, 0.06), at, 0.016, (-0.5, 0.2, -0.2, 0.5)[j])
        if STAB and m["beatIn"] <= at < m["beatOut"] - 0.1:  # bass walks through the chord
            t = tt(0.2)
            f = ROOT / 2 * 2 ** (ch[(q // 2) % 3] / 12)
            music.add((np.sin(2 * np.pi * f * t) + 0.25 * np.sin(6 * np.pi * f * t)) * env(t, 0.004, 0.09), at, 0.08)
        if HAPPY and at < T - 1.0:
            for h16 in range(2):  # shaker
                t = tt(0.05)
                music.add(band(len(t), 5000, 11000) * env(t, 0.004, 0.014), at + h16 * BEAT / 4, 0.03 if h16 else 0.05, 0.25)
            if q % 4 in (2, 3) and m["beatIn"] <= at < m["beatOut"]:  # double hand clap
                t = tt(0.16)
                music.add(band(len(t), 800, 3500) * env(t, 0.001, 0.04), at if q % 4 == 2 else at - BEAT / 4, 0.09, -0.1)
            if q % 2 == 0 and tl["s"][1] <= at:  # whistle
                t = tt(BEAT * 0.9)
                f = ROOT * 8 * 2 ** (ch[(q // 2 * 3 + k) % 4] / 12)
                music.add(np.sin(2 * np.pi * f * t + 3 * np.sin(2 * np.pi * 5.5 * t)) * np.minimum(1, t / 0.03) * np.exp(-t / 0.3), at, 0.016, 0.3)
        if RETRO and m["beatIn"] <= at < m["beatOut"] - 0.1:
            t = tt(0.22)  # saw bass in eighths
            f = ROOT / 2 * 2 ** (ch[0] / 12)
            music.add(np.tanh(1.4 * sum(np.sin(2 * np.pi * f * h * t) / h for h in range(1, 7))) * env(t, 0.004, 0.08), at, 0.06)
            if q % 4 == 2:  # gated snare: loud noise that is cut off instead of fading
                t = tt(0.26)
                music.add(band(len(t), 400, 6000) * np.minimum(1, t / 0.002) * (t < 0.2), at, 0.1)
        if LOFI and q in (0, 3, 6) and at < T - 1.0:  # electric piano: struck chord with a slow wobble
            t = tt(1.4)
            for j, st in enumerate(ch):
                f = ROOT * 2 ** (st / 12)
                s = (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.15)) * env(t, 0.004, 0.5) * (1 + 0.12 * np.sin(2 * np.pi * 4.5 * t))
                music.add(s, at, 0.03, (-0.4, 0.3, -0.15, 0.4)[j])
        if AMB and q % 2 == 0 and 0.6 < at < T - 1.2:  # glassy bell
            t = tt(2.2)
            f = ROOT * 8 * 2 ** (ch[(q // 2 + k) % 4] / 12)
            music.add((np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.2)) * env(t, 0.004, 0.55), at, 0.016, (-0.6, 0.6)[(q // 2) % 2])
        if AMB and q == 0 and at < T - 1.5:  # soft pulse on the bar
            t = tt(0.9)
            music.add(np.sin(2 * np.pi * (50 * t + 3 * (1 - np.exp(-t * 18)))) * env(t, 0.01, 0.25), at, 0.16)
        if tl["s"][1] <= at < T - 1.0 and not LOFI and not AMB and not CHIP and not STAB and not CINE:
            f = ROOT * 4 * 2 ** (ch[(q * 3 + k) % 4] / 12)
            t = tt(0.7)
            s = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) * env(t, 0.004, 0.16)
            if SOFT:  # marimba-like: a bright partial that dies quickly over a longer body
                s = np.sin(2 * np.pi * f * t) * env(t, 0.003, 0.26) + 0.35 * np.sin(2 * np.pi * f * 4 * t) * env(t, 0.002, 0.05)
            music.add(s, at, 0.03, (-0.5, 0.5)[q % 2])
            music.add(s, at + BEAT * 0.75, 0.011, (0.6, -0.6)[q % 2])
        if PULSE and at < T - 1.2:
            for h16 in range(2):
                t = tt(0.16)
                f = ROOT * 2 * 2 ** (ch[(q * 2 + h16 + k) % 4] / 12)
                sq = sum(np.sin(2 * np.pi * f * h * t) / h for h in (1, 3, 5))
                music.add(sq * env(t, 0.002, 0.05), at + h16 * BEAT / 4, 0.02, (-0.45, 0.45)[(q + h16) % 2])
        if POP and m["beatIn"] <= at < m["beatOut"] - 0.1:  # bass bouncing between octaves
            t = tt(0.2)
            f = ROOT / 2 * 2 ** (ch[0] / 12) * (2 if q % 2 else 1)
            music.add((np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) * env(t, 0.004, 0.08), at, 0.085)
        if HARD and m["beatIn"] <= at < m["beatOut"] - 0.1:
            t = tt(0.2)
            f = ROOT / 2 * 2 ** (ch[0] / 12)
            saw = sum(np.sin(2 * np.pi * f * h * t) / h for h in range(1, 9))
            music.add(np.tanh(saw * 1.6) * env(t, 0.004, 0.07), at, 0.055 if q % 2 else 0.03)
        if m["beatIn"] <= at < m["beatOut"] - 0.1 and not AMB and not CINE:
            if q % 2 == 0:
                t = tt(0.5)
                f = ROOT / 2 * 2 ** (ch[0] / 12)
                music.add(np.sin(2 * np.pi * (45 * t + 5.5 * (1 - np.exp(-t * 34)))) * env(t, 0.002, 0.12), at, 0.26 * PUNCH)
                music.add(np.sin(2 * np.pi * f * t) * env(t, 0.01, 0.22), at, 0.13)
                if LOFI and q % 4 == 2:  # brushed snare
                    t = tt(0.3)
                    music.add(band(len(t), 500, 3500) * env(t, 0.004, 0.08), at, 0.07)
                if q % 4 == 2 and (POP or not SOFT) and not PULSE and not LOFI and not CHIP:  # clap on beats 2 and 4
                    t = tt(0.22)
                    music.add(band(len(t), 900, 4500) * env(t, 0.001, 0.05), at, 0.1)
            else:
                t = tt(0.06)
                music.add(np.diff(rng.standard_normal(len(t) + 1)) * env(t, 0.001, 0.014), at, 0.02, 0.2)
            t = tt(0.03)
            music.add(np.diff(rng.standard_normal(len(t) + 1)) * env(t, 0.001, 0.007), at + BEAT / 4, 0.008, -0.3)
    k += 1


def whoosh(at, dur, g, lo=400, hi=2400):
    x = band(int(dur * SR), lo, hi)
    fx.add(x * np.sin(np.pi * np.linspace(0, 1, len(x))) ** 2, at, g)


def note(at, st, dur, g, pan=0.0):
    t = tt(dur)
    f = ROOT * 8 * 2 ** (st / 12)
    fx.add((np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)) * env(t, 0.003, dur / 4), at, g, pan)


SCALE = [0, 3, 7, 10, 12, 15]
for c in tl["cues"]:
    at, kind, i = c["t"], c["k"], c.get("i", 0)
    if kind == "tick":
        t = tt(0.05)
        fx.add((np.sin(2 * np.pi * 2300 * t) * 0.5 + rng.standard_normal(len(t)) * 0.4) * env(t, 0.0006, 0.008), at, 0.07, (-0.3, 0.3)[i % 2])
        whoosh(at - 0.04, 0.22, 0.035, 1200, 5000)
    elif kind == "slam":
        t = tt(0.32)
        fx.add(np.sin(2 * np.pi * (58 * t + 6 * (1 - np.exp(-t * 30)))) * env(t, 0.002, 0.09), at, 0.34 * PUNCH)
        fx.add(band(int(0.07 * SR), 1800, 8000) * env(tt(0.07), 0.0008, 0.016), at, 0.11, (-0.3, 0.3)[i % 2])
        whoosh(at - 0.09, 0.2, 0.07, 500, 3000)
    elif kind == "glitch":
        for j in range(9):
            t = tt(0.022 + 0.02 * rng.random())
            f = float(rng.choice([220, 440, 880, 1760, 3520]))
            fx.add(np.sign(np.sin(2 * np.pi * f * t)) * 0.5 + rng.standard_normal(len(t)) * 0.3, at + j * 0.034, 0.045, float(rng.uniform(-0.7, 0.7)))
    elif kind == "click":  # a mouse click: press and release
        for j, (dt, fq) in enumerate(((0, 1900), (0.07, 2600))):
            t = tt(0.03)
            fx.add((np.sin(2 * np.pi * fq * t) * 0.5 + rng.standard_normal(len(t)) * 0.5) * env(t, 0.0005, 0.005), at + dt, 0.16 - j * 0.07)
    elif kind == "ding":  # two soft rising notes
        for j, st in enumerate((7, 12)):
            note(at + j * 0.09, st, 0.9, 0.06, (-0.2, 0.2)[j])
    elif kind == "braam":  # the trailer horn: a detuned low cluster that swells and dies slowly
        t = tt(2.2)
        x = sum(np.tanh(1.8 * sum(np.sin(2 * np.pi * f * (1 + dt) * h * t) / h for h in range(1, 7))) for f in (36.71, 55.0, 73.42) for dt in (-0.006, 0.006))
        fx.add(x * np.minimum(1, t / 0.06) * np.exp(-t / 0.75), at, 0.06)
        fx.add(band(len(t), 60, 400) * np.exp(-t / 0.5), at, 0.12)
    elif kind == "swish":
        whoosh(at, 0.4, 0.13, 900, 5200)
    elif kind == "whoosh":
        whoosh(at, 0.6, 0.2)
    elif kind == "impact":
        t = tt(0.7)
        fx.add(np.sin(2 * np.pi * (48 * t + 4 * (1 - np.exp(-t * 26)))) * env(t, 0.003, 0.2), at, 0.4 * PUNCH)
        fx.add(band(int(0.12 * SR), 1500, 7000) * env(tt(0.12), 0.001, 0.03), at, 0.1)
    elif kind == "shimmer":
        for j, st in enumerate((0, 7, 12, 16, 19)):
            note(at + j * 0.045, st, 1.4, 0.03, (-0.5, 0.5, -0.2, 0.2, 0)[j])
    elif kind == "blip":
        note(at, SCALE[i % len(SCALE)], 0.4, 0.055, (-0.3, 0, 0.3)[i % 3])
    elif kind == "draw":
        x = band(int(c["d"] * SR), 700, 3200)
        fx.add(x * np.linspace(0, 1, len(x)) ** 1.5 * np.minimum(1, (len(x) - np.arange(len(x))) / (0.08 * SR)), at, 0.05)
    elif kind == "key":
        t = tt(0.035)
        fx.add(rng.standard_normal(len(t)) * env(t, 0.0008, 0.005), at, 0.03 + 0.012 * rng.random(), float(rng.uniform(-0.25, 0.25)))
    elif kind == "pop":
        t = tt(0.16)
        fx.add(np.sin(2 * np.pi * (330 * t + 9 * (1 - np.exp(-t * 40)))) * env(t, 0.002, 0.04), at, 0.2)
    elif kind == "riser":
        x = band(int(c["d"] * SR), 600, 6000)
        fx.add(x * np.linspace(0, 1, len(x)) ** 3, at, 0.22)
    elif kind == "boom":
        t = tt(1.6)
        fx.add(np.sin(2 * np.pi * (42 * t + 5 * (1 - np.exp(-t * 20)))) * env(t, 0.003, 0.45), at, 0.5 * PUNCH)
        fx.add(band(int(0.5 * SR), 300, 5000) * env(tt(0.5), 0.002, 0.12), at, 0.14)
    elif kind == "chime":
        for j, st in enumerate((0, 7, 12, 16)):
            t = tt(2.4)
            f = ROOT * 4 * 2 ** (st / 12)
            fx.add(np.sin(2 * np.pi * f * t) * env(t, 0.004, 0.7), at + j * 0.05, 0.06, (-0.4, 0.4, -0.2, 0.2)[j])

# Voice: each line normalized to the same loudness, placed where the picture expects it.
venv = np.zeros(N + PAD)
for i, v in enumerate(tl["vo"]):
    with wave.open(str(d / f"vo{i}.wav")) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(float) / 32768
    x *= 0.11 / max(1e-4, np.sqrt(np.mean(x**2)))
    voice.add(x, v["t"], 1.0)
    a = int(v["t"] * SR)
    venv[max(0, a - int(0.08 * SR)) : a + len(x) + int(0.12 * SR)] = 1
sm = int(0.18 * SR)
duck = 1 - 0.55 * np.convolve(venv, np.ones(sm) / sm, "same")[:N]

# A short synthetic room on the effects so they sit in one space instead of sounding dry.
ir_t = tt(1.1)
ir = [band(len(ir_t), 300, 6000) * np.exp(-ir_t / 0.28) for _ in range(2)]
F = fx.stereo()
n_fft = 1 << int(np.ceil(np.log2(N + len(ir_t))))
wet = np.stack([np.fft.irfft(np.fft.rfft(F[:, ch], n_fft) * np.fft.rfft(ir[ch], n_fft), n_fft)[:N] for ch in range(2)], 1)
wet *= 0.3 * np.abs(F).max() / max(1e-6, np.abs(wet).max())

S = music.stereo() * duck[:, None] * 1.5 + (F + wet) * (0.6 + 0.4 * duck)[:, None] + voice.stereo() * 2.4
t = np.arange(N) / SR
S *= (np.minimum(1, t / 0.08) * np.minimum(1, (T - t) / 0.45))[:, None]
S = np.tanh(S * 1.3)
S *= 0.89 / max(0.2, np.abs(S).max())
wav = d / "mix.wav"
with wave.open(str(wav), "wb") as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes((S * 32767).astype("<i2").tobytes())
out = d / f"{d.resolve().name}.mp4"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(d / "silent.mp4"), "-i", str(wav), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", str(out)], check=True)
rms = lambda b: 20 * np.log10(max(1e-9, np.sqrt(np.mean(b.stereo() ** 2))))
print("done", out, "| levels dB music %.1f fx %.1f voice %.1f" % (rms(music), rms(fx), rms(voice)))
