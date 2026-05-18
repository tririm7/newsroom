# Upgrade

TBD — written during M6 once `upgrade.sh` is finalized.

Covers: `./upgrade.sh` flow (auto pg_dump → git pull → docker build → drizzle migrate → restart), failure rollback path, expected downtime window (30 s – 5 min per patches v1.1 #4), and a recommendation to run upgrades during low-traffic windows.
