# Roadshow Technical Script

Use this as the short spoken version of the Role B technical story.

## 30-Second Version

Role B takes weather data, sun timing, and local Shanghai locations, then turns them into one card the frontend can render immediately. The live path uses Open-Meteo and SunCalc. For the roadshow, we also keep three stable demo modes, so the experience never breaks because of network or weather uncertainty.

## 60-Second Version

The core idea is that AI is the translator, not just the predictor. We collect structured signals like cloud cover, humidity, visibility, weather code, sunset time, and local POIs. Then we score the chance of a good sunset and translate it into a human recommendation: where to go, when the peak moment is, and how to shoot it.

For the demo, Shanghai is the default city because that is our real testing context. We use live data when we want realism, and `demo=high|mid|low` when we need stable roadshow control. The frontend gets the same response shape either way, so switching modes does not require UI changes.

## Likely Questions

### Is the weather real?

Yes in live mode. `/api/sunset?city=shanghai` uses Open-Meteo weather data and SunCalc sun timing. The demo modes are prewritten scenarios for controlled presentation.

### Why not call an LLM live?

For this prototype, live LLM output adds latency, API key risk, and prompt instability. The visible product value is the translation from signals to useful guidance, so we keep that voice polished with prewritten copy and deterministic scoring.

### How is the score calculated?

The score weighs cloud cover, humidity, visibility, and weather code. Partial cloud cover is best, moderate humidity is helpful, high visibility is good, and rain or fog is penalized.

### What happens if the weather API fails?

The API falls back to the high-score demo payload. The frontend still receives the same fields, so the card keeps working.

### Why Shanghai?

Shanghai gives us a real local demo context and strong visual locations: the Suzhou Creek bridges, the Huangpu waterfront, and west-facing skyline views. That makes the recommendation feel local instead of generic.

## Demo Operator Notes

- Start the UI with `demo=high`.
- Use `city=shanghai` to show live data only after the visual flow is stable.
- Keep `demo=low` ready if judges ask whether the product can tell users not to go out.
- Do not show `meta.debug` in the product UI.
