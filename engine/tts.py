# Voices every line of a content file and records how long each one is, so the picture can be timed to the voice.
# python tts.py <content.json> <out dir>
# Engines: "kokoro" runs on this machine (Apache-2.0 model, no account, no per-use cost); "edge" is a draft-only fallback.
import asyncio, json, subprocess, sys, wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
content = json.loads(Path(sys.argv[1]).read_text("utf8"))
out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
voice = content["voice"]
TRIM = "silenceremove=start_periods=1:start_threshold=-48dB,areverse,silenceremove=start_periods=1:start_threshold=-48dB,areverse"


def finish(src, i):
    wav = out / f"vo{i}.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-af", TRIM, "-ar", "48000", "-ac", "1", str(wav)], check=True)
    src.unlink()
    with wave.open(str(wav)) as w:
        return round(w.getnframes() / w.getframerate(), 3)


durs = []
if voice.get("engine", "kokoro") == "kokoro":
    import soundfile as sf
    from kokoro_onnx import Kokoro

    k = Kokoro(str(ROOT / "models/kokoro-v1.0.onnx"), str(ROOT / "models/voices-v1.0.bin"))
    for i, text in enumerate(content["vo"]):
        samples, sr = k.create(text, voice=voice["name"], speed=voice.get("speed", 1.0), lang=voice.get("lang", "en-us"))
        raw = out / f"raw{i}.wav"
        sf.write(str(raw), samples, sr)
        durs.append(finish(raw, i))
else:
    import edge_tts

    async def run():
        for i, text in enumerate(content["vo"]):
            raw = out / f"raw{i}.mp3"
            await edge_tts.Communicate(text, voice["name"], rate=voice.get("rate", "+0%")).save(str(raw))
            durs.append(finish(raw, i))

    asyncio.run(run())
(out / "vo.json").write_text(json.dumps(durs))
print("voice", voice["name"], durs, "total", round(sum(durs), 2))
