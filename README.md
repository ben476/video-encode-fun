# Video Encode Playground

A bunch of small tools and scripts to play with video encoding. Don't expect any of them to be usable though - this code was never meant to touch the light of day. I just thought it would be fun to share.

## Efficient\* parallel encoding

_Found in main.ts, task.ts, client.ts_

Master slave style parallel encoding using ffmpeg and SVT-AV1. The master divvy's up the work and sends it to the slaves. Except I dig deep down and touch byte streams, native libaries, and bunch of complicated stuff for fun and learning.

This was actually a tough nut to crack, because for convex hull generation, every single scene is encoded at every single quality level. That meant a single scene is decoded 63 times. For the sake of efficiency, I have a single decode stream managed by the master, and I mangle the raw Y4M byte stream and segment it into usable fragments that are then shared with the slaves. The slaves then decode the fragments and encode them, which is it's own can of worms with this setup.

### Netflix style convex hull generation

A technique used by Netflix to squeeze as much quality out of their encodes as possible.
