// Weather Events, the barometer item on the Minecraft side: using it shows the outlook on the action bar. Glue, not run in a
// game yet. `outlook` is a function returning forecast.js's outlook(), `shown` returns the whole levels now.
import { world } from "@minecraft/server";
import { needle, pressure, readout } from "./barometer.js";

export function startBarometer(outlook, shown) {
  world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
    if (itemStack.typeId !== "wx:barometer") return;
    try {
      const o = outlook();
      source.onScreenDisplay.setActionBar(`§bBarometer: ${needle(pressure(o))} | ${readout(o, shown())}`);
    } catch {
      // no forecast yet
    }
  });
}
