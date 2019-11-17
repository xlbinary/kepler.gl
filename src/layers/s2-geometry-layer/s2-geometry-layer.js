// Copyright (c) 2019 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import memoize from 'lodash.memoize';
import {S2Layer} from 'deck.gl';
import {hexToRgb} from 'utils/color-utils';

import Layer from '../base-layer';
import S2LayerIcon from './s2-layer-icon';
import {HIGHLIGH_COLOR_3D} from 'constants/default-settings';

export const TOKEN_FIELDS = {
  token: ['token', 's2_token']
};

export const s2RequiredColumns = ['token'];
export const S2TokenAccessor = ({token}) => d => d[token.fieldIdx];
export const S2TokenResolver = ({token}) => token.fieldIdx;

export const S2VisConfigs = {
  opacity: 'opacity',
  colorRange: 'colorRange',
  filled: {
    type: 'boolean',
    label: 'Fill Color',
    defaultValue: true,
    property: 'filled'
  },

  // height
  enable3d: 'enable3d',
  elevationScale: 'elevationScale',
  elevationPercentile: 'elevationPercentile',
  sizeRange: 'elevationRange'
};

export default class S2GeometryLayer extends Layer {

  constructor(props) {
    super(props);
    this.registerVisConfig(S2VisConfigs);
    this.getS2Token = memoize(S2TokenAccessor, S2TokenResolver);
  }

  get type() {
    return 's2';
  }

  get name() {
    return 'S2'
  }

  get requiredLayerColumns() {
    return s2RequiredColumns;
  }

  get layerIcon() {
    return S2LayerIcon;
  }

  static findDefaultLayerProps({fields = []}) {
    const foundColumns = this.findDefaultColumnField(TOKEN_FIELDS, fields);
    if (!foundColumns || !foundColumns.length) {
      return {props: []};
    }

    return {
      props: foundColumns.map(columns => ({
        isVisible: true,
        label: 'S2',
        columns
      }))
    };
  }

  getDefaultLayerConfig(props = {}) {
    return {
      ...super.getDefaultLayerConfig(props),

      // filled
      filled: true
    };
  }

  /* eslint-disable complexity */
  formatLayerData(_, allData, filteredIndex, oldLayerData, opt = {}) {
    const {
      colorScale,
      colorDomain,
      colorField,
      color,
      columns,
      sizeField,
      sizeScale,
      sizeDomain,
      visConfig: {sizeRange, colorRange}
    } = this.config;

    // color
    const cScale =
      colorField &&
      this.getVisChannelScale(
        colorScale,
        colorDomain,
        colorRange.colors.map(c => hexToRgb(c))
      );

    // height
    const sScale =
      sizeField && this.getVisChannelScale(sizeScale, sizeDomain, sizeRange, 0);

    const getS2Token = this.getS2Token(columns);

    let data;
    if (
      oldLayerData &&
      oldLayerData.data &&
      opt.sameData &&
      oldLayerData.getS2Token === getS2Token
    ) {
      data = oldLayerData.data;
    } else {
      data = filteredIndex.reduce((acc, index, i) => {
        const token = getS2Token(allData[index]);
        return token ?[
          ...acc,
          {
            token: getS2Token(allData[index]),
            data: allData[index]
          }
        ] : acc;
      }, []);
    }

    const getFillColor = cScale
      ? d => this.getEncodedChannelValue(cScale, d.data, colorField)
      : color;

    const getElevation = sScale
      ? d => this.getEncodedChannelValue(sScale, d.data, sizeField, 0)
      : 0;

    return {
      data,
      getFillColor,
      getElevation
    };
  }
  /* eslint-enable complexity */

  renderLayer({
    data,
    idx,
    layerInteraction,
    objectHovered,
    mapState,
    interactionConfig
  }) {
    const eleZoomFactor = this.getElevationZoomFactor(mapState);
    const {config} = this;
    const {visConfig} = config;

    const updateTriggers = {
      getFillColor: {
        color: config.color,
        colorField: config.colorField,
        colorRange: config.visConfig.colorRange,
        colorScale: config.colorScale
      }
    };

    return [
      new S2Layer({
        id: this.id,
        ...layerInteraction,
        ...data,
        idx,
        getS2Token: d => d.token,

        // color
        opacity: visConfig.opacity,
        filled: visConfig.filled,

        // highlight
        autoHighlight: Boolean(config.sizeField),
        highlightColor: HIGHLIGH_COLOR_3D,

        // render
        pickable: true,

        updateTriggers,

        extruded: visConfig.enable3d,
        elevationScale: visConfig.elevationScale * eleZoomFactor,
        elevationLowerPercentile: visConfig.elevationPercentile[0],
        elevationUpperPercentile: visConfig.elevationPercentile[1]
      })
    ];

  }

}
