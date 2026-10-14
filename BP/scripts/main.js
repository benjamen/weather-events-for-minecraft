import { startPuddles } from "./puddle-blocks.js";
import { currentLevels, startWeather } from "./weather.js";

startWeather();
startPuddles(currentLevels);
