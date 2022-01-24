'use strict';

const express = require('express');

const router = express.Router();

const { InfluxDB, FluxTableMetaData } = require('@influxdata/influxdb-client');
const { influx: { url, token, org } } = require('../env');
const { from, map, take }             = require('rxjs');

const queryApi  = new InfluxDB({ url, token }).getQueryApi(org);
const fluxQuery = (measurement) => `from(bucket: "ubiquarium")
  |> range(start: -1d)
  |> filter(fn: (r) => r["measurement"] == "${ measurement }")
   |> filter(fn: (r) => r["location"] == "t1_1_ubiquarium_stand1")
  |> filter(fn: (r) => r["protocol"] == "netatmo") 
  |> yield(name: "last")`;

const makeHandker = (measurement) => (req, res) => {
    let arr   = [];
    const sub = from(queryApi.rows(fluxQuery(measurement)))
        .pipe(map(({ values, tableMeta }) => tableMeta.toObject(values)))
        .subscribe({
            next(o) {
                arr = [ ...arr, { value: o._value, time: new Date(o._time).getTime() } ];
            }, error(e) {
                console.error(e);
            }, complete() {
                res.send(arr);
                sub.unsubscribe();
                // console.log('\nFinished SUCCESS');
            },
        });
};

for (const measure of [ 'humidity', 'co2', 'temperature' ]) {
    router.get('/' + measure, makeHandker(measure));
}

module.exports = router;