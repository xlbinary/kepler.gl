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

import {set, arrayfy} from './utils';
import {MAX_GPU_FILTERS} from 'constants/default-settings';
import {notNullorUndefined} from './data-utils';
/**
 * Set gpu mode based on current number of gpu filters exists
 * @param {Object} gpuFilter
 * @param {Array<Object>} filters
 */
export function setFilterGpuMode(filter, filters) {
  // filter can be apply to multiple dataset, hence gpu filter mode should also be
  // an array, however, to keep us sane, for now, we only check if there is available channel for every dataId,
  // if all of them has, we set gpu mode to true
  // TODO: refactor filter so we don't keep an array of everything

  filter.dataId.forEach((dataId, datasetIdx) => {
    const gpuFilters = filters.filter(f => f.dataId.includes(dataId) && f.gpu);

    if (filter.gpu && gpuFilters.length === MAX_GPU_FILTERS) {
      return set(['gpu'], false, filter);
    }
  });

  return filter;
}

export function assignGpuChannels(allFilters) {
  return allFilters.reduce((accu, f, index) => {
    let filters = accu;

    // if gpu is true assign and validate gpu Channel
    if (f.gpu) {
      f = assignGpuChannel(f, accu);
      filters = set([index], f, accu);
    }

    return filters;
  }, allFilters);
}
/**
 * Assign a new gpu filter a channel based on first availability
 * @param {Object} filter
 * @param {Array<Object>} filters
 */
export function assignGpuChannel(filter, filters) {
  // find first available channel
  if (!filter.gpu) {
    return filter;
  }

  const gpuChannel = filter.gpuChannel || [];

  filter.dataId.forEach((dataId, datasetIdx) => {
    const findGpuChannel = channel => f => {
      const dataIdx = arrayfy(f.dataId).indexOf(dataId);
      return (
        f.id !== filter.id &&
        dataIdx > -1 &&
        f.gpu &&
        arrayfy(f.gpuChannel)[dataIdx] === channel
      );
    };

    if (
      Number.isFinite(gpuChannel[datasetIdx]) &&
      !filters.find(findGpuChannel(gpuChannel[datasetIdx]))
    ) {
      // if value is already assigned and valid
      return;
    }

    let i = 0;

    while (i < MAX_GPU_FILTERS) {
      if (!filters.find(findGpuChannel(i))) {
        gpuChannel[datasetIdx] = i;
        return;
      }
      i++;
    }
  });

  // if cannot find channel for all dataid, set gpu back to false
  // TODO: refactor filter to handle same filter different gpu mode
  if (!gpuChannel.length || !gpuChannel.every(Number.isFinite)) {
    return {
      ...filter,
      gpu: false
    };
  }

  return {
    ...filter,
    gpuChannel
  };
}
/**
 * Edit filter.gpu to ensure that only
 * X number of gpu filers can coexist.
 * @param {Array<Object>} filters
 * @returns {Array<Object>} updated filters
 */
export function resetFilterGpuMode(filters) {
  const gpuPerDataset = {};

  return filters.map((f, i) => {
    if (f.gpu) {
      let gpu = true;
      arrayfy(f.dataId).forEach(dataId => {
        const count = gpuPerDataset[dataId];

        if (count === MAX_GPU_FILTERS) {
          gpu = false;
        } else {
          gpuPerDataset[dataId] = count ? count + 1 : 1;
        }
      });

      if (!gpu) {
        return set(['gpu'], false, f);
      }
    }

    return f;
  });
}

/**
 * Initial filter uniform
 * @returns {Array<Array<Number>>}
 */
function getEmptyFilterRange() {
  return new Array(MAX_GPU_FILTERS).fill(0).map(d => [0, 0]);
}

// By default filterValueAccessor expect each datum to be formated as {index, data}
// data is the row in allData, and index is its index in allData
const defaultGetIndex = d => d.index;
const defaultGetData = d => d.data;

/**
 *
 * @param {Array<Object>} channels
 * @return {Function} getFilterValue
 */
const getFilterValueAccessor = channels => (
  getIndex = defaultGetIndex,
  getData = defaultGetData
) => d =>
  // for empty channel, value is 0 and min max would be [0, 0]
  channels.map(filter => {
    if (!filter) {
      return 0;
    }
    const value = filter.mappedValue
      ? filter.mappedValue[getIndex(d)]
      : getData(d)[filter.fieldIdx];

    return notNullorUndefined(value)
      ? value - filter.domain[0]
      : Number.MIN_SAFE_INTEGER;
  });

/**
 * Get filter properties for gpu filtering
 * @param {Array<Object>} filters
 * @param {string} dataId
 * @returns {{filterRange: {Object}, filterValueUpdateTriggers: Object, getFilterValue: Function}}
 */
export function getGpuFilterProps(filters, dataId) {
  const filterRange = getEmptyFilterRange();
  const triggers = {};

  // array of filter for each channel, undefined, if no filter is assigned to that channel
  const channels = [];

  for (let i = 0; i < MAX_GPU_FILTERS; i++) {
    const filter = filters.find(
      f => f.gpu &&
        f.dataId.includes(dataId) &&
        f.gpuChannel[f.dataId.indexOf(dataId)] === i
    );

    filterRange[i][0] = filter ? filter.value[0] - filter.domain[0] : 0;
    filterRange[i][1] = filter ? filter.value[1] - filter.domain[0] : 0;

    triggers[`gpuFilter_${i}`] = filter ? filter.name[filter.dataId.indexOf(dataId)] : null;
    channels.push(filter);
  }

  const filterValueAccessor = getFilterValueAccessor(channels);

  return {
    filterRange,
    filterValueUpdateTriggers: triggers,
    filterValueAccessor
  };
}
