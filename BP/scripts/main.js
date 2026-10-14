import { startBarometer } from "./barometer-item.js";
import { startHail } from "./hail-stones.js";
import { startPuddles } from "./puddle-blocks.js";
import { startSnowLayers } from "./snow-layers.js";
import { startSun } from "./sun-effects.js";
import { currentLevels, currentOutlook, currentTemperature, currentWind, shownLevels, startWeather } from "./weather.js";
import { startFlakes, startWindStreams } from "./wind-streams.js";

startWeather();
startPuddles(currentLevels);
startHail(() => currentLevels().hail);
startWindStreams(currentWind);
startSun(() => currentLevels().sun);
startSnowLayers(currentLevels, currentTemperature);
startBarometer(currentOutlook, shownLevels);
startFlakes(() => currentLevels().snow, currentWind);
