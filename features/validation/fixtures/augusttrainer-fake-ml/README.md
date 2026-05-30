# Fake ML Project

This fixture is a tiny deterministic ML-like project for AugustTrainer validation.

Run one experiment:

```bash
python3 train.py
```

Metric:

- `val_loss`, lower is better.

Editable files:

- `model_config.json`

Protected files:

- `train.py`
- `README.md`

The model improves when `quality_bonus` in `model_config.json` is increased up to `0.4`.
