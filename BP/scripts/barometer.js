// Weather Events: the barometer. An item you hold up to read the weather: what it is now, what is coming and when. Pure
// text rules, tested; barometer-item.js (glue) shows it when the item is used.
import { describeWeather } from "./channels.js";

const span = (s) => (s >= 90 ? `${Math.round(s / 60)} min` : `${s} s`);

// "Gale. Next: rain in 2 min." from forecast.js's outlook() answer and the whole levels now.
export function readout(o, shown) {
  const now = shown ? describeWeather(shown) : o.now.name;
  return `${now} | next: ${o.next.name} in ${span(o.secondsLeft)}`;
}

// A pressure reading from 0 (falling fast, storm coming) to 1 (high and steady) for the dial: how bad the next front is
// against the one now. `severity` scores a front by its levels.
export const severity = (levels) => (levels.rain ?? 0) * 0.8 + (levels.wind ?? 0) * 0.5 + (levels.hail ?? 0) + (levels.snow ?? 0) * 0.6;
export function pressure(o) {
  const delta = severity(o.next.levels ?? {}) - severity(o.now.levels ?? {});
  return Math.min(1, Math.max(0, 0.6 - delta * 0.12));
}
export const needle = (p) => (p < 0.25 ? "falling fast" : p < 0.45 ? "falling" : p < 0.65 ? "steady" : "rising");
