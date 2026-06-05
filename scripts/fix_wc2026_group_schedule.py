#!/usr/bin/env python3
"""
Regenerate WC 2026 seed SQL from the canonical generator and optionally
copy it into hpj-landing-publish.

Use when validate_wc2026_group_schedule.py fails or production DB is missing
group fixtures (expect 72 group matches, 3 per team).

Steps:
  1. python scripts/fix_wc2026_group_schedule.py
  2. python scripts/validate_wc2026_group_schedule.py   # must exit 0
  3. Supabase SQL Editor: run supabase/seed-wc-2026.sql (idempotent upserts)
     or supabase/patch-missing-group-matches.sql if only a few rows missing
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
GEN = REPO / "docs" / "cl-vote-mockup" / "supabase" / "_gen_seed_wc2026.py"
GEN_OUT = GEN.parent / "seed-wc-2026.sql"
PUBLISH_SEED = ROOT / "supabase" / "seed-wc-2026.sql"
VALIDATE = ROOT / "scripts" / "validate_wc2026_group_schedule.py"


def main() -> int:
    if not GEN.is_file():
        print(f"Generator not found: {GEN}", file=sys.stderr)
        return 1

    print(f"Running {GEN.name} ...")
    subprocess.run([sys.executable, str(GEN)], cwd=str(GEN.parent), check=True)

    if not GEN_OUT.is_file():
        print(f"Expected output missing: {GEN_OUT}", file=sys.stderr)
        return 1

    shutil.copy2(GEN_OUT, PUBLISH_SEED)
    print(f"Copied -> {PUBLISH_SEED}")

    print("Validating ...")
    r = subprocess.run([sys.executable, str(VALIDATE)], cwd=str(ROOT))
    return r.returncode


if __name__ == "__main__":
    sys.exit(main())
