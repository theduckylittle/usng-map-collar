/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2020 Dan "Ducky" Little
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import GeometryLayout from 'ol/geom/GeometryLayout';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import Stroke from 'ol/style/Stroke';
import Fill from 'ol/style/Fill';
import Text from 'ol/style/Text';
import Style from 'ol/style/Style';
import Collection from 'ol/Collection';
import Feature from 'ol/Feature';
import {equals} from 'ol/extent';
import {fromLatLon as utmFromLatLon, toLatLon as utmToLatLon} from 'utm';
import {fromLonLat, toLonLat} from 'ol/proj';


const EastWestLetters = [
  ['S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'], // 0 + 6
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], // 1
  ['J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R'], // 2
  ['S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'], // 3
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], // 4
  ['J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R'] // 5
];

const NorthSouthLetters = [
  ['F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'A', 'B', 'C', 'D', 'E'],
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V']
];

const LABEL_DIGITS = {
  10000: 1,
  1000: 2,
  100: 3,
  10: 4,
  1: 5
};

const formatLabel = (meters, interval, zone, direction) => {
  if (interval === 100000) {
    if (direction === 'ew') {
      return EastWestLetters[zone % 6][Math.floor(meters / 100000) - 1];
    } else {
      return NorthSouthLetters[zone % 2][Math.floor((meters % 2000000) / 100000)];
    }
  }
  const nDigits = LABEL_DIGITS[interval];
  const asString = (meters < 1000000 ? '0' : '') + meters;
  return asString.slice(2, 2 + nDigits);
};

const extentToLonLat = (extent) => (
  toLonLat([extent[0], extent[1]]).concat(toLonLat([extent[2], extent[3]]))
);

const zonesInExtent = (extent84) => {
  const left = Math.floor((180 + extent84[0]) / 6 + 1);
  const right = Math.ceil((180 + extent84[2]) / 6 + 1);
  const zones = [];
  for (let i = left; i < right; i++) {
    zones.push(i);
  }
  return zones;
};

const gridLinesEasting = (zone, extent84, extent, interval = 100000) => {
  const lines = [];
  const points = [];

  const zoneEnd = zone * 6 - 180;
  const zoneStart = zoneEnd - 6;

  const topRight = utmFromLatLon(extent84[3], extent84[2] > zoneEnd ? zoneEnd : extent84[2]);
  const bottomLeft = utmFromLatLon(extent84[1], extent84[0] < zoneStart ? zoneStart : extent84[0]);

  if (zoneStart > extent84[0]) {
    bottomLeft.easting = 300000;
  }

  if (zoneEnd < extent84[2]) {
    topRight.easting = 700000;
  }

  const start = Math.floor(bottomLeft.easting / interval) * interval;
  const end = Math.ceil(topRight.easting / interval) * interval;

  for (let easting = start; easting <= end; easting += interval) {
    const latlon = utmToLatLon(easting, bottomLeft.northing, zone, null, true);
    const a = fromLonLat([latlon.longitude, extent84[1]]);
    const b = fromLonLat([latlon.longitude, extent84[3]]);
    // put the label at the center of the quad
    const labelLL = utmToLatLon(easting + interval / 2, bottomLeft.northing, zone, null, true);
    const labelCoords = fromLonLat([labelLL.longitude, labelLL.latitude]);

    lines.push({
      geom: new LineString(a.concat(b), GeometryLayout.XY)
    });

    points.push({
      geom: new Point(labelCoords),
      label: formatLabel(easting, interval, zone, 'ew'),
      class: 'ew'
    });
  }

  return {
    lines,
    points
  };
};

const gridLinesNorthing = (zone, extent84, extent, interval = 100000) => {
  const lines = [];
  const points = [];

  const zoneEnd = zone * 6 - 180;
  const zoneStart = zoneEnd - 6;

  const topLeft = utmFromLatLon(extent84[3], extent84[0]);
  const bottomRight = utmFromLatLon(extent84[1], extent84[2]);

  const start = Math.floor(bottomRight.northing / interval) * interval;
  const end = Math.ceil(topLeft.northing / interval) * interval;

  for (let northing = start; northing <= end; northing += interval) {
    const latlon = utmToLatLon(topLeft.easting, northing, zone, null, true);
    const a = fromLonLat([zoneStart, latlon.latitude]);
    const b = fromLonLat([zoneEnd, latlon.latitude]);
    a[0] = zoneStart < extent84[0] ? extent[0] : a[0];
    b[0] = zoneEnd > extent84[2] ? extent[2] : b[0];

    // put the label at the center of the quad
    const labelLL = utmToLatLon(bottomRight.easting, northing + interval / 2, zone, null, true);
    const labelCoords = fromLonLat([labelLL.longitude, labelLL.latitude]);

    lines.push({
      geom: new LineString(a.concat(b), GeometryLayout.XY)
    });

    points.push({
      geom: new Point([b[0], labelCoords[1]]),
      label: formatLabel(northing, interval, zone, 'ns'),
      class: 'ns'
    });
  }
  return {
    lines,
    points
  };
};

/**
 * Default resolver function for converting the resolution
 * of the map into an "interval" of meters used.
 */
const defaultIntervalFn = (resolution) => {
  let interval = 100000;
  if (resolution < 0.04) {
    interval = 1;
  } else if (resolution < 0.5) {
    interval = 10;
  } else if (resolution < 3) {
    interval = 100;
  } else if (resolution < 20) {
    interval = 1000;
  } else if (resolution < 160) {
    interval = 10000;
  }
  return interval;
};


/**
 * UsngGrid Layer class.
 * Uses a "built-in" source for generating the render features.
 */
class UsngGrid extends VectorLayer {
  constructor(options = {}) {
    super({
      renderBuffer: 0,
      updateWhileAnimating: true,
      updateWhileInteracting: true
    });

    // use a source with a custom loader for lines & text
    this.setSource(
      new VectorSource({
        loader: this.loaderFunction.bind(this),
        strategy: this.strategyFunction.bind(this),
        features: new Collection(),
        overlaps: false,
        useSpatialIndex: false
        //wrapX: options.wrapX
      })
    );

    this.zoneLineStyle = options.zoneLineStyle || new Style({
      stroke: new Stroke({
        color: '#ff0000',
        width: 4
      })
    });

    this.gridLineStyle = options.gridLineStyle || new Style({
      stroke: new Stroke({
        color: 'rgba(0,0,0,0.9)',
        width: 2,
        lineDash: [0.5, 4]
      })
    });

    this.labelStyle = {
      'ew': options.eastWestLabelStyle || new Style({
        text: new Text({
          font: '12px Calibri,sans-serif',
          textBaseline: 'bottom',
          textAlign: 'center',
          fill: new Fill({
            color: 'rgba(0,0,0,1)'
          }),
          stroke: new Stroke({
            color: 'rgba(255,255,255,1)',
            width: 3
          }),
          text: '00'
        })
      }),
      'ns': options.northSouthLabelStyle || new Style({
        text: new Text({
          font: '12px Calibri,sans-serif',
          textAlign: 'right',
          offsetX: -5,
          fill: new Fill({
            color: 'rgba(0,0,0,1)'
          }),
          stroke: new Stroke({
            color: 'rgba(255,255,255,1)',
            width: 3
          }),
          text: '00'
        })
      })
    };

    this.intervalFn = options.intervalFn || defaultIntervalFn;
  }

  loaderFunction(extent, resolution, projection) {
    const source = this.getSource();
    const collection = source.getFeaturesCollection();
    collection.clear();

    this.loadedExtent_ = extent;

    const extent84 = extentToLonLat(extent);
    const zones = zonesInExtent(extent84);

    const interval = this.intervalFn(resolution);

    for (let z = 0, zz = zones.length; z < zz; z++) {
      const zone = zones[z];

      // draw the zone line
      const zoneFeature = new Feature();
      const zoneLon = -180 + zone * 6;
      const zoneLine = fromLonLat([zoneLon, -90]).concat(fromLonLat([zoneLon, 90]));
      zoneFeature.setGeometry(new LineString(zoneLine, GeometryLayout.XY));
      zoneFeature.setStyle(this.zoneLineStyle);
      collection.push(zoneFeature);

      const eastingLines = gridLinesEasting(zone, extent84, extent, interval);
      const northingLines = gridLinesNorthing(zone, extent84, extent, interval);

      const lineFeatures = eastingLines.lines.concat(northingLines.lines);
      const pointFeatures = eastingLines.points.concat(northingLines.points);

      for (let l = 0, ll = lineFeatures.length; l < ll; l++) {
        const def = lineFeatures[l];
        const gridFeature = new Feature();
        gridFeature.setGeometry(def.geom);
        gridFeature.setStyle(this.gridLineStyle);
        collection.push(gridFeature);
      }

      for (let p = 0, pp = pointFeatures.length; p < pp; p++) {
        const def = pointFeatures[p];
        const f = new Feature();
        f.setGeometry(def.geom);
        const labelStyle = this.labelStyle[def.class].clone();
        labelStyle.getText().setText(def.label);
        f.setStyle(labelStyle);
        collection.push(f);
      }
    }
  }

  strategyFunction(extent, resolution) {
    if (this.loadedExtent_ && !equals(this.loadedExtent_, extent)) {
      this.getSource().removeLoadedExtent(this.loadedExtent_);
    }
    return [extent];
  }
}

export default UsngGrid;
