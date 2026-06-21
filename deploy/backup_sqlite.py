"""Create a transactionally consistent SQLite backup while the app is running."""

from __future__ import annotations

import os
import sqlite3
import sys
from contextlib import closing
from pathlib import Path


def backup_sqlite(source_path: Path, destination_path: Path) -> None:
    if not source_path.is_file():
        raise FileNotFoundError(source_path)
    if destination_path.exists():
        raise FileExistsError(destination_path)

    destination_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with closing(sqlite3.connect(source_path)) as source:
            with closing(sqlite3.connect(destination_path)) as destination:
                source.backup(destination)
                result = destination.execute("PRAGMA integrity_check").fetchone()
                if result != ("ok",):
                    raise RuntimeError(f"backup integrity check failed: {result!r}")
        os.chmod(destination_path, 0o600)
    except Exception:
        destination_path.unlink(missing_ok=True)
        raise


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: backup_sqlite.py SOURCE DESTINATION", file=sys.stderr)
        return 2
    try:
        backup_sqlite(Path(sys.argv[1]), Path(sys.argv[2]))
    except Exception as exc:
        print(f"SQLite backup failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
