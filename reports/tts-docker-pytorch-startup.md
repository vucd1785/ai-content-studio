# TTS Docker startup — Missing PyTorch

## A. Confirmed root cause

1. **`app/main.py` imported `align_transcript_to_wav` at module load**, which pulls `app.alignment.pipeline` → `audio_io.py` → `import torch`.
2. **Dockerfile only ran `pip install .`** (base deps: FastAPI + `vieneu`), **not** optional extras `[align,align-whisper]` where `torch`, `torchaudio`, Whisper, and alignment stack are declared in `pyproject.toml`.
3. **`audio_io.py` genuinely needs PyTorch** for resampling/mono load at 16 kHz (Whisper/CTC alignment path). That is correct; the bug was **eager import at API startup** plus **missing extras in the image**, not a spurious dependency.

`/health` and ONNX `/synthesize` do **not** need `torch` at import time; only `/align` (and code paths that call `load_wav_mono`) do.

## B. Files changed

| File | Change |
|------|--------|
| `services/tts/app/main.py` | Lazy-import `align_transcript_to_wav` inside `POST /align` |
| `services/tts/app/alignment/__init__.py` | PEP 562 lazy export for `align_transcript_to_wav` |
| `services/tts/Dockerfile` | Install `.[align,align-whisper]` with PyTorch CPU extra index |
| `services/tts/README.md` | Document Docker align deps + lazy import |
| `services/tts/tests/test_align_api.py` | Patch target → `app.alignment.pipeline.align_transcript_to_wav` |
| `services/tts/tests/test_api_contract.py` | Assert `align_transcript_to_wav` not bound on `app.main` at import |

## C. Dependency / import correction

- **Import:** defer alignment pipeline until first `/align` request so uvicorn can start and `/health` works even if align deps were missing (would still get 503 on `/align` with clear error).
- **Docker:** install pinned optional groups via  
  `pip install ".[align,align-whisper]" --extra-index-url https://download.pytorch.org/whl/cpu`  
  so Whisper alignment works in the CPU Compose profile without CUDA wheels.

No API contract changes. No fake health responses.

## D. Tests and build results

```text
cd services/tts
python -c "from app.main import app; print('import_ok')"   → import_ok
python -m pytest tests/ -q --ignore=tests/test_alignment_integration.py
  → 42 passed, 2 skipped (integration skipped)
```

Docker image rebuild was **not** executed in this session (long download). Director should run `--build` once locally.

## E. Docker Compose restart command

From repo root:

```powershell
Set-Location E:\Docker\ai-content-studio
docker compose --profile cpu up -d --build tts
```

## F. Health verification command

```powershell
curl.exe -s http://localhost:8000/health
```

Expect JSON with `"status":"ok"` after VieNeu model preload (may be `"degraded"` briefly during first startup; Compose `start_period` allows up to 600s).

Optional:

```powershell
docker compose --profile cpu ps tts
docker compose --profile cpu logs tts --tail 50
```

## G. Risks and remaining blockers

- **First rebuild** downloads PyTorch CPU + Whisper-related wheels and may take several minutes; Hugging Face / Whisper weights still load on first synthesis/align (existing caches in volumes `tts_hf_cache`, `tts_whisper_cache` are preserved).
- **Image size** increases vs torch-free ONNX-only image; intentional for default `ALIGNMENT_ENGINE=whisper`.
- **P1-08 Director verification** still requires TTS to reach `status: ok` and cached WAV/alignment under `./data`; this fix unblocks container **startup**, not missing local cache files.
- Local dev without `[align]` extras: `/health` + `/synthesize` work; `/align` returns 503 `alignment_engine_unavailable` until `pip install -e ".[align,align-whisper]"`.
