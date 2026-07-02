# Userscripts

A small collection of [Tampermonkey](https://www.tampermonkey.net/) userscripts that enhance the [Roblox](https://www.roblox.com/) **Top Earning / Charts** page.

## Scripts

| Script | Description |
| --- | --- |
| [`ranks.user.js`](ranks.user.js) | Adds a rank number (`#1`, `#2`, `...`) overlay to each game thumbnail on the charts page. |
| [`redirect.user.js`](redirect.user.js) | Rewrites `/charts` links so they open the all-device, all-country view by default. |
| [`revenue.user.js`](revenue.user.js) | Adds estimated revenue from a configured provider API to Roblox chart game cards. |
| [`search.user.js`](search.user.js) | Adds a search bar to the Top Earning page for filtering games by name. |

## Installation

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension.
2. Click a script below. Tampermonkey will open an install page. Click **Install**.

   - [Install Ranks](https://raw.githubusercontent.com/CountMyBands/Userscripts/main/ranks.user.js)
   - [Install Redirect](https://raw.githubusercontent.com/CountMyBands/Userscripts/main/redirect.user.js)
   - [Install Revenue](https://raw.githubusercontent.com/CountMyBands/Userscripts/main/revenue.user.js)
   - [Install Search](https://raw.githubusercontent.com/CountMyBands/Userscripts/main/search.user.js)

Each script includes `@updateURL` / `@downloadURL`, so Tampermonkey checks this repo for updates automatically.

## Revenue Provider

`revenue.user.js` prompts for a provider URL and API key the first time it runs. To change either value later, open the Tampermonkey menu and choose **Set Revenue Provider and API Key**.

The provider URL can be the full revenue endpoint, or just a host. If only a host is entered, the script uses `/metrics/revenue`.

## Updating

To publish a change:

1. Edit the script locally.
2. **Bump the `@version`** in the metadata block (e.g. `1.0` -> `1.1`). This is required for Tampermonkey to pick up the update.
3. Commit and push to this repo.

Tampermonkey will update on its own schedule, or you can force it via **Tampermonkey -> Utilities -> Check for userscript updates**.

## Author

CountMyBands
