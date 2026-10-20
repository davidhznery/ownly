# Booking prices in Market Pro

The JSON importer accepts `provider: "booking"`, `schema_version: 1`, `currency: "EUR"` and an `observations` array. It preserves property links, unit names, addresses, taxes, additional charges and rate conditions. The existing observations table has additive provider, source-details and review-reason columns; historical Airbnb IDs remain unchanged.

Prices shown per night are the advertised stay total divided by nights. They are approximate advertised prices for the recorded guests and dates, not host earnings, occupancy or a quote for another stay. Market Pro defaults to all saved months; selecting a month or range narrows the observations.

Provider identities remain separate. Listings on multiple platforms can represent the same physical accommodation; the snapshot counts source listings, not verified unique homes across platforms.

Booking rows are flagged for review if their apartment price exceeds EUR 1,000 per night, their address has a known conflicting FNT/RBT/VLT/ATD postal prefix, or their unit label says Single Room. These are review signals, not automatic corrections or proof that the source is wrong. Flagged rows remain stored and visible in the administrator import panel but do not affect customer price averages. Source assertions such as taxes included are preserved alongside charge notes and are not independently verified by importing a JSON file.
