# v3.12.1 — Visual consistency pass

App-wide design-token cleanup:

- Every raw data-color literal (red accent, success green, gold) replaced with theme tokens + `color-mix` alphas across gym, health, analytics, home and finance pages — light theme now flips all status colors correctly
- All charts confirmed at the v3.x chart contract (scrub + readout + haptics where applicable)
- No functional/data changes
