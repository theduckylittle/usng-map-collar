# USNG OpenLayers Layer

Provides a USNG "map collar" for OpenLayers maps.
The spec USNG map collar is designed to be outside the map
but this renders as a layer inside of the map.

## Demo

To run the demo, install the dependencies and hit start!

```
npm install
npm start
```

The navigate a browser to [http://localhost:1234/](http://localhost:1234).

## WIP: Using in your project

Install the package:

```
npm install usng-map-collar
```

```
import UsngGrid from 'usng-map-collar/UsngGrid';
```

Then add it as a layer to the OpenLayers Map.

## Styling

The UTM zone lines, grid lines, and label styles can all be overridden by passing in
options to the constructor.

 * `zoneLineStyle` - Styling for the UTM zone lines.
 * `gridLineStyle` - Style for the USNG grid-lines.
 * `gridLabelStyle` - Style for the labels on the grid.

## Controlling when grid levels show up

The constructor can be given an `intervalFn` function which determines when
different grid intervals will be displayed. The following is the default:

```
const defaultIntervalFn = (resolution) => {
  let interval = 1000000;
  if (resolution < 0.02) {
    interval = 1;
  } else if (resolution < 0.25) {
    interval = 10;
  } else if (resolution < 2.5) {
    interval = 100;
  } else if (resolution < 25) {
    interval = 1000;
  } else if (resolution < 160) {
    interval = 10000;
  } else if (resolution < 2500) {
    interval = 100000;
  }
  return interval;
};
```

## License and Copyright

(c) 2020 Dan "Ducky" Little, MIT License (see LICENSE file for details).
