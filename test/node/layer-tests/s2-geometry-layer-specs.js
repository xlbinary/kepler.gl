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

import test from 'tape';
import {
  testCreateCases,
  testFormatLayerDataCases
} from 'test/helpers/layer-utils';
import {data} from 'test/fixtures/s2-geometry';
import S2GeometryLayer from 'layers/s2-geometry-layer/s2-geometry-layer';
import {processCsvData} from 'processors/data-processor';

test('#S2Geometry -> constructor', t => {
  const TEST_CASES = [{
    props: {
      dataId: 'smoothie',
      isVisible: true,
      label: 'text s2geometry layer'
    },
    test: layer => {
      t.ok(
        layer.config.dataId === 'smoothie',
        'S2GeometryLayer dataId should be correct'
      );
      t.ok(layer.type === 's2', 'type should be s2');
      t.deepEqual(Object.keys(layer.visConfigSettings), [
          'opacity',
          'colorRange',
          'filled',
          'enable3d',
          'elevationScale',
          'elevationPercentile',
          'sizeRange'
        ],
        'should provide the correct visConfigSettings properties');
    }
  }];

  testCreateCases(t, S2GeometryLayer, TEST_CASES);
  t.end();
});

test('#S2Geometry -> formatLayerData', t => {
  const {rows, fields} = processCsvData(data);

  t.deepEqual(fields, [
    {
      name: 'token',
      format: '',
      tableFieldIndex: 1,
      type: 'string',
      analyzerType: 'STRING'
    },
      {
      name: 'value',
      format: '',
      tableFieldIndex: 2,
      type: 'real',
      analyzerType: 'FLOAT'
    }
  ], 'Should compute fields correctly');

  const filteredIndex = [0, 2, 4];

  const nullRows = [[null, 12345], [null, 3456]];
  const rowsWithNull = nullRows.concat(rows);
  const dataset = {
    data: rowsWithNull,
    allData: rowsWithNull,
    filteredIndexForDomain: filteredIndex
  };

  const props = {
    dataId: 'puppy',
    label: 's2 file',
    columns: {
      token: {
        value: 'token',
        fieldIdx: 0
      }
    }
  };

  const TEST_CASES = [
    {
      props,
      data: [data, rows, filteredIndex, undefined],
      test: result => {
        const {layerData} = result;
        const expectedLayerData = {
          data: [
            {token: rows[0][0], data: rows[0]},
            {token: rows[2][0], data: rows[2]},
            {token: rows[4][0], data: rows[4]}
          ],
          getPosition: () => {},
          getElevation: () => {}
        };

        t.equal(
          layerData.getElevation,
          0,
          'Elevation should be set to 0'
        );

        t.deepEqual(
          layerData.data,
          expectedLayerData.data,
          'should format correct s2-geometry layerData'
        );

        t.deepEqual(
          Object.keys(layerData),
          ['data', 'getFillColor', 'getElevation'],
          'layerData should have 3 keys'
        );
      }
    },
    {
      props,
      updates: [
        {method: 'updateLayerConfig', args: [{colorField: fields[1]}]},
        {method: 'updateLayerConfig', args: [{sizeField: fields[1]}]},
        {
          method: 'updateLayerVisualChannel',
          args: [dataset, 'color']
        }
      ],
      data: [rowsWithNull, rowsWithNull, filteredIndex, undefined],
      test: result => {
        const {layerData} = result;
        const expectedLayerData = {
          data: [
            {token: rows[0][0], data: rows[0]},
            {token: rows[2][0], data: rows[2]}
          ],
          getPosition: () => {},
          getElevation: () => {}
        };

        t.ok(
          typeof layerData.getFillColor === 'function',
          'should have getFillColor'
        );

        t.ok(
          typeof layerData.getElevation === 'function',
          'should have getElevation'
        );

        t.deepEqual(
          layerData.data,
          expectedLayerData.data,
          'should format correct s2-geometry layerData and remove null values'
        );

        t.deepEqual(
          Object.keys(layerData),
          ['data', 'getFillColor', 'getElevation'],
          'layerData should have 3 keys'
        );
      }
    }
  ];

  testFormatLayerDataCases(t, S2GeometryLayer, TEST_CASES);

  t.end();
});
