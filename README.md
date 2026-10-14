# Weather Events for Minecraft

A Minecraft Bedrock add-on pack (behaviour + resource) with prefix `wx:`. It is separate from any game and built
on [bedrock-kit](https://github.com/benjamen/bedrock-kit); DeadAir and other games use it by adding the packs to a world.

Rain, wind, hail, snow and sun, each in three levels (light, medium, heavy) that can combine: rain with puddles that
dry up, wind that pushes players and streams leaves, hail, snow that piles up, and sun that blinds and burns.

## Working on it

```
npm test                 # pure-logic tests, including a check that the vendored kit matches bedrock-kit
npm run sync-kit         # re-vendor the kit and the fog ladder (needs ../bedrock-kit next to this repo)
```

Everything in `BP/scripts/kit/` is copied from bedrock-kit: change it there, never here. See `DESIGN.md`.
