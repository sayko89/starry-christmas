# Third-party data, code and fonts

## Stars drawn in the sky — HYG database

`data/stars-deep.bin` holds every star of the [HYG database](https://github.com/astronexus/HYG-Database)
v4.1 (David Nash / astronexus: the Hipparcos, Yale Bright Star and Gliese catalogues combined) down to
magnitude 8.5 — 61,816 stars — packed by `tools/build_data.py`. HYG is licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); this packed file is an adaptation of
it and is shared under the same licence.

## The Milky Way — Gaia EDR3 rendering

`textures/milky-way.jpg` is *Milky Way 360 equirectangular rendering with foreground stars removed*
by Kevinmloch (made with bsrender from ESA Gaia EDR3 data; ESA/Gaia/DPAC), from
[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Milky_Way_360_equirectangular_rendering_with_foreground_stars_removed.png),
licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). It is the 3840 × 1920
JPEG of that file as packaged in the `astraeus-data` npm package; it is not modified (it is dimmed and
projected onto the sky when drawn).

## Star names and constellations — d3-celestial

`data/stars.json` (used for star names and the Christmas star) and `data/constellations.json` are derived from the data
files of [d3-celestial](https://github.com/ofrohn/d3-celestial) by Olaf Frohn (star positions from
the Hipparcos catalogue) by `tools/build_data.py`.

```
Copyright (c) 2015, Olaf Frohn
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.```

## Cities and time zones — city-timezones

`data/cities.json` is derived from [city-timezones](https://github.com/kevinroberts/city-timezones)
by Kevin Roberts, MIT License. Nine Turkish provinces missing from that list were added by hand
(see `tools/build_data.py`).

## Moon and planets — Astronomy Engine

`vendor/astronomy.browser.min.js` is [Astronomy Engine](https://github.com/cosinekitty/astronomy)
by Don Cross, MIT License (the full licence text is at the top of the file).

## 3D — three.js

`vendor/three.min.js` is [three.js](https://github.com/mrdoob/three.js) r187 (MIT License,
Copyright © 2010-2026 three.js authors), bundled and minified with only the classes the opening
scene uses, plus the bloom post-processing passes (EffectComposer, RenderPass, UnrealBloomPass,
OutputPass):

```bash
echo "export { AdditiveBlending, ..., WebGLRenderer } from 'three';" > entry.js
npx esbuild entry.js --bundle --minify --format=esm --legal-comments=inline --outfile=vendor/three.min.js
```

## Fonts

Great Vibes, Playfair Display and Inter, from [Fontsource](https://fontsource.org), all under the
SIL Open Font License 1.1 — see `fonts/OFL-*.txt`.
