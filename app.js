const express = require(`express`);
const path = require(`path`);
const logger = require(`morgan`);
const wrap = require(`express-async-wrap`);
const _ = require(`lodash`);
const uuid = require(`uuid-by-string`);
const got = require(`got`);
const spacetime = require(`spacetime`);

const getYearRange = filter => {
    let fromYear = parseInt(filter.from);
    let toYear = parseInt(filter.to);

    if (_.isNaN(fromYear)) {
        fromYear = new Date().getFullYear();
    }
    if (_.isNaN(toYear)) {
        toYear = new Date().getFullYear();
    }
    const yearRange = [];
    while(fromYear <= toYear) {
        yearRange.push(fromYear);
        fromYear++;
    }
    return yearRange;
};

const app = express();
app.use(logger(`dev`));
app.use(express.json());
app.use(express.urlencoded({extended: false}));

app.get(`/logo`, (req, res) => res.sendFile(path.resolve(__dirname, `logo.svg`)));

const appConfig = require(`./config.app.json`);
app.get(`/`, (req, res) => res.json(appConfig));

app.post(`/validate`, (req, res) => res.json({name: `Public`}));

const syncConfig = require(`./config.sync.json`);
app.post(`/api/v1/synchronizer/config`, (req, res) => res.json(syncConfig));

const schema = require(`./schema.json`);
app.post(`/api/v1/synchronizer/schema`, (req, res) => res.json(schema));

app.post(`/api/v1/synchronizer/datalist`, wrap(async (req, res) => {
    //const timezones = await (got(`https://date.nager.at/api/v3/AvailableCountries`).json());
    //const timezones = ["Europe/Copenhagen"];
    let tzs = spacetime().timezones;
    const tzsOrdered = Object.keys(tzs).sort().reduce(
        (obj, key) => { 
            obj[key] = tzs[key]; 
            return obj;
        },
        {}
    );
    const timezones = Object.keys(tzsOrdered);
    //const items = tzsOrdered.map((row) => ({title: row, value: row}));
    const items = timezones.map((row) => ({title: row, value: row}));
    res.json({items});
}));

app.post(`/api/v1/synchronizer/data`, wrap(async (req, res) => {
    const {requestedType, filter} = req.body;
    if (requestedType !== `holiday`) {
        throw new Error(`Only holidays database can be synchronized`);
    }
    /*
    if (_.isEmpty(filter.countries)) {
        throw new Error(`Countries filter should be specified`);
    }
    */
    const {timezones} = filter;
    const yearRange = getYearRange(filter);
    const items = [];
    let s = spacetime()
    //for (const country of countries) {
        for (const year of yearRange) {
            s = s.year(year)
            console.log(s.leapYear()?366:365)
            for (let d = 1; d <= (s.leapYear()?3:3); d++) {
                s = s.dayOfYear(d);
                const item = s.json();
                console.log(item);
                item.date = item.year + "-" + (item.month +1) + "-" + item.date;
                item.name = "Dummy" + d;
                item.countryCode = s.timezone().name;
                item.id = uuid(JSON.stringify(item));
                items.push(item);
            }
        }
    //}
    return res.json({items});
}));

app.use(function (req, res, next) {
    const error = new Error(`Not found`);
    error.status = 404;
    next(error);
});

app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    console.log(err);
    res.json({message: err.message, code: err.status || 500});
});

module.exports = app;
