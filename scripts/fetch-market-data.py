"""Fetch fixed Binance public daily-candle archives, verifying archive checksums."""
import concurrent.futures
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data"
BASE = "https://data.binance.vision/data/spot/monthly/klines"
YEAR = 2025


def fetch(url):
    with urllib.request.urlopen(url, timeout=30) as response:
        return response.read()


def month(symbol, number):
    name = f"{symbol}-1d-{YEAR}-{number:02d}.zip"
    url = f"{BASE}/{symbol}/1d/{name}"
    archive = fetch(url)
    checksum = fetch(url + ".CHECKSUM").decode().split()[0]
    assert hashlib.sha256(archive).hexdigest() == checksum, name
    with zipfile.ZipFile(io.BytesIO(archive)) as zipped:
        files = zipped.namelist()
        assert len(files) == 1 and files[0].endswith(".csv"), files
        rows = list(csv.reader(io.StringIO(zipped.read(files[0]).decode())))
    candles = []
    for row in rows:
        # Official spot archives use microseconds from January 2025.
        stamp = int(row[0])
        assert stamp >= 1_000_000_000_000_000, stamp
        candles.append(dict(time=stamp // 1000, open=float(row[1]), high=float(row[2]),
                            low=float(row[3]), close=float(row[4]), volume=float(row[5])))
    return number, candles, {"url": url, "sha256": checksum}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    datasets = []
    for symbol in ["BTCUSDT", "ETHUSDT"]:
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            parts = sorted(pool.map(lambda n: month(symbol, n), range(1, 13)))
        candles = [c for _, rows, _ in parts for c in rows]
        assert len(candles) == 365
        assert candles[0]["time"] == 1735689600000
        assert all(b["time"] - a["time"] == 86400000 for a, b in zip(candles, candles[1:]))
        source = "https://github.com/binance/binance-public-data"
        data = {"symbol": symbol, "interval": "1d", "quoteAsset": "USDT", "source": source,
                "archives": [p[2] for p in parts], "candles": candles}
        raw = (json.dumps(data, separators=(",", ":"), allow_nan=False) + "\n").encode()
        name = f"{symbol}-1d-{YEAR}.json"
        (OUT / name).write_bytes(raw)
        datasets.append({"symbol": symbol, "file": "./data/" + name,
                         "start": "2025-01-01", "end": "2025-12-31", "bars": len(candles),
                         "sha256": hashlib.sha256(raw).hexdigest(), "source": source})
        print(f"{symbol}: {len(candles)} daily candles; 12 archive checksums verified", flush=True)
    manifest = {"schema": "crypto-strategy-lab/data/v1", "interval": "1d", "quoteAsset": "USDT",
                "retrievedAt": datetime.now(timezone.utc).isoformat(), "datasets": datasets,
                "limitations": ["A fixed historical snapshot, not a live price feed.",
                                "Binance spot USDT quotes; USDT/USD equivalence is not guaranteed.",
                                "Checksums verify downloaded archive identity, not independent price accuracy."]}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
