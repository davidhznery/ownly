# Reference code gift access

Set `OWNLY_REFERENCE_CODE` in the private `.env`, then rebuild/restart the web service:

```powershell
docker compose up -d --build web
```

Share the code privately with your invitees. They create an account with Google or email, then enter the code under **Have a reference code?** on the activation screen. They receive **30 days of Portfolio**, including up to 15 properties and market access, from the moment of redemption. No card or Stripe checkout is required. After 30 days the gateway blocks product access and offers a paid subscription. No automatic charge occurs; account and property data remain saved.

The fixed `ownly-gift-2026` campaign accepts at most **10 different accounts**, once per account. Changing the secret code or restarting does not reset the count. Accounts that have already opened Stripe checkout or started a subscription cannot redeem this campaign. The campaign can be disabled by clearing the environment variable and restarting. Existing redeemed gifts keep their expiry date.

Redemptions are persisted in `/data/accounts.json` in the existing `ownly_data` Docker volume. Preserve that volume when moving servers. As with the current JSON account store, run one gateway writer per data directory; this is not a shared multi-instance database.

The hero walkthrough now contains an original synthesized ambient score, with stereo pads, soft bells and fades. It is embedded in the MP4, so native video controls manage pause, seeking, mute and volume together. To regenerate it, see `scripts/create-video-soundtrack.py`.
