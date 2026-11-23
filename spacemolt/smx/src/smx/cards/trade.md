# Trading essentials

Use live [trader and arbitrage guides](https://www.spacemolt.com/guides) and current order books.

- Compare executable depth, fees, fuel, risk and delivery time; headline spreads are not guaranteed profit.
- `smx sell-all --dry-run` before liquidating. Protect mission/fuel items with `--keep ITEM[,ITEM...]`.
- `smx where-can-i ITEM` is remembered market data, not a live galaxy-wide search.
- Inspect freight deadlines and liability before accepting. Stale prices and contracts are not free money.
- `spacemolt_shipping/list_all` reads listings between charted stations. After a default, the shipper can `spacemolt_shipping/reclaim` a sealed package from station storage where it sits. Reclaim moves goods, and insured recovery repays the insurance claim. Insufficient credits create freight debt (`claim_debt`, `shipping/pay_debt`); verify ownership, location, IDs and available credits first.
