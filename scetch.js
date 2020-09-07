const path = require('path');
const fs = require('fs').promises;

let scetchDefaults = {
    root: path.join(__dirname, 'views'),
    ext: ".sce"
};
let scetchOptions = {};

// Escape polyfill because that's how we replace all.
if (!RegExp.escape) {
    RegExp.escape = function (s) {
        return String(s).replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
    };
}

function engine(filePath, options, callback) {
    if (!path.isAbsolute(filePath)) filePath = path.join(scetchOptions.root || this.root || scetchDefaults.root, filePath);
    if (!filePath.endsWith('.sce')) filePath += '.sce';

    let p = fs.readFile(filePath)
        .then(data => data.toString())
        .then(data => applyPartials.call(this, data))
        .then(data => applyVariables.call(this, data, options))
        .then(data => {
            if (!callback) return data;

            callback(null, data);
        }).catch(err => {
            if (!callback) return err;

            try {
                callback(err);
            } catch (catchErr) {
                console.error("FATAL?");
                console.error(catchErr);
            }
        });
    if (!callback) return p;
}

async function applyPartials(data) {
    const rx = /\[\[i= *(.*?) *\]\]/gi;
    let matchBoxes = [...data.matchAll(rx)].filter((v, i, s) => s.indexOf(v) === i);

    let root = scetchOptions.root || this.root || scetchDefaults.root;
    let ext = scetchOptions.ext || this.ext || scetchDefaults.ext;
    for (let box of matchBoxes) {
        try {
            let partial = await fs.readFile(path.join(root, box[1] + ext));
            data = data.replace(new RegExp(RegExp.escape(box[0])), partial);
        } catch (e) {
            continue;
        }
    }

    return data;
}

async function applyVariables(data, options) {
    if (typeof options === "undefined") return data;
    const rx = /\[\[(?!\w=) *(.*?) *\]\]/gi;
    let matchBoxes = [...data.matchAll(rx)].filter((v, i, s) => s.indexOf(v) === i);

    for (let box of matchBoxes) {
        if (typeof options[box[1]] === 'undefined') continue;
        let variable = options[box[1]];
        if (variable !== undefined) data = data.replace(new RegExp(RegExp.escape(box[0])), variable);
    }

    return data;
}

module.exports.override = (key, value) => {
    if (typeof key === 'object') {
        for (const k in key) {
            if (key.hasOwnProperty(k)) this.override(k, key[k]);
        }
    } else if (typeof key === 'string' && typeof value !== 'undefined') {
        scetchOptions[key] = value;
    }
};
module.exports.engine = engine;
module.exports = (opts) => {
    if (typeof opts !== "undefined") this.override(opts);
    return this;
};