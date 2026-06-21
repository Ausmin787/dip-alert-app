"""Regression checks for the Oracle VM deployment assets."""

from __future__ import annotations

import sqlite3
import subprocess
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path


DEPLOY_DIR = Path(__file__).resolve().parent


class DeploySafetyTests(unittest.TestCase):
    def test_sqlite_backup_helper_creates_valid_snapshot(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "live.db"
            backup = Path(tmp) / "backup.db"
            with closing(sqlite3.connect(source)) as connection:
                connection.execute("CREATE TABLE sample (value TEXT NOT NULL)")
                connection.execute("INSERT INTO sample VALUES ('preserved')")
                connection.commit()

            result = subprocess.run(
                [
                    sys.executable,
                    str(DEPLOY_DIR / "backup_sqlite.py"),
                    str(source),
                    str(backup),
                ],
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            with closing(sqlite3.connect(backup)) as connection:
                self.assertEqual(
                    connection.execute("PRAGMA integrity_check").fetchone(),
                    ("ok",),
                )
                self.assertEqual(
                    connection.execute("SELECT value FROM sample").fetchone(),
                    ("preserved",),
                )

    def test_deploy_script_has_failure_rollback_and_quarantine(self) -> None:
        script = (DEPLOY_DIR / "deploy.sh").read_text(encoding="utf-8")

        self.assertIn("trap deploy_error ERR", script)
        self.assertIn("BLOCKED_COMMIT_FILE", script)
        self.assertIn("REQS_CHANGED", script)
        self.assertNotIn('cp "$DB_PATH" "$dest"', script)

    def test_deploy_failure_alert_is_wired(self) -> None:
        script = (DEPLOY_DIR / "deploy.sh").read_text(encoding="utf-8")
        service = (DEPLOY_DIR / "dip-alert-deploy.service").read_text(
            encoding="utf-8"
        )
        env_example = (DEPLOY_DIR / "dip-alert.env.example").read_text(
            encoding="utf-8"
        )

        # helper exists and is invoked from both rollback branches
        self.assertIn("notify_failure()", script)
        self.assertGreaterEqual(script.count("notify_failure"), 3)
        # credentials are optional and come from the optional env file
        self.assertIn("DEPLOY_ALERT_PHONE", env_example)
        self.assertIn("DEPLOY_ALERT_APIKEY", env_example)
        self.assertIn(
            "EnvironmentFile=-/etc/dip-alert/dip-alert.env", service
        )

    def test_system_user_setup_is_portable_and_creates_expected_home(self) -> None:
        readme = (DEPLOY_DIR / "README.md").read_text(encoding="utf-8")

        self.assertIn("useradd --system --user-group --create-home", readme)
        self.assertIn("--home-dir /home/dipalert", readme)
        self.assertIn("install -d -m 0750 -o dipalert -g dipalert /home/dipalert", readme)
        self.assertNotIn("adduser --system --group", readme)

    def test_failed_deploy_is_visible_to_systemd(self) -> None:
        unit = (DEPLOY_DIR / "dip-alert-deploy.service").read_text(
            encoding="utf-8"
        )

        self.assertNotIn("SuccessExitStatus=0 1", unit)


if __name__ == "__main__":
    unittest.main()
