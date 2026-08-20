# Website

See the [live demo](https://cellfso.web.app)

## Graph
An efficient 2D [deck.gl](https://deck.gl) visualization of the nodes inside one region and all LoS links, mostly AI generated.
[concaveman](https://github.com/mapbox/concaveman) is used to compute concave hulls around all connected components. The k-edge-connectivity feature is incomplete, we moved to Python's [NetworkX](https://networkx.org/en/) instead.

## Calibrator
This tool is designed to inspect the accuracy of the database manually but efficiently on a subset of points. We used it to compare the database position with the real position of 360 cell sites.

It can be used locally by choosing an empty directory to store the results in (updated positions).
It iterates through the cell sites given in [public/calibrator/csv](public/calibrator/csv) one by one, limited to tower supports by default. Try the query parameter `?input=building` to only see building supports.
Look around to find the actual position of the support visually and move the map so the marker points at it.
The top controls show the relative shift in coordinates. Press `I` to see available shortcuts.
Intentionally skip samples using `Backspace` whenever the imagery is insufficient for correct judgment or the correct support cannot be identified.