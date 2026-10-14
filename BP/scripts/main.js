import { startHail } from "./hail-stones.js";
import { startPuddles } from "./puddle-blocks.js";
import { currentLevels, currentWind, startWeather } from "./weather.js";
import { startWindStreams } from "./wind-streams.js";

startWeather();
startPuddles(currentLevels);
startHail(() => currentLevels().hail);
startWindStreams(currentWind);
