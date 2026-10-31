# Market-data license and attribution

The MIT software license does **not** cover the bundled market datasets in `public/data/`.

**Source:** Binance Vision / [Binance Public Data](https://github.com/binance/binance-public-data), BTCUSDT and ETHUSDT daily spot candlesticks for 1 January–31 December 2025, retrieved 25 October 2026. Original archive URLs and checksums are retained in each dataset; normalized-file hashes are in `public/data/manifest.json`.

The [Binance Vision Dataset Terms](https://github.com/binance/binance-public-data/blob/master/TERMS_AND_CONDITIONS.md), version 1.0, updated 26 August 2026, specify **CC BY-NC-SA 4.0** in §3.1 and require a separate written enterprise agreement for commercial use in §3.4. The bundled normalized datasets and this project's data-format modifications are distributed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) ([legal code](https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.en)). Preserve attribution, identify modifications, use noncommercially, and apply the required share-alike terms when redistributing adaptations. Consult the linked license and provider terms for their full requirements.

**Changes by Crypto Strategy Lab:** `scripts/fetch-market-data.py` joined 12 monthly CSV archives per market, retained time and OHLCV fields, converted timestamps from microseconds to milliseconds and numeric strings to numbers, and serialized compact JSON with provenance and a manifest. No Binance endorsement is implied.

This MVP is a non-monetized research showcase. Commercial deployment needs appropriately licensed data before using these snapshots commercially.
