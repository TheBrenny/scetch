const path = require('path');
const fs = require('fs').promises;

// Escape polyfill because that's how we replace all.
if (!RegExp.escape) {
    RegExp.escape = function (s) {
        return String(s).replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
    };
}

function engine(filePath, options, callback) {
    fs.readFile(filePath)
        .then(data => data.toString())
        .then(data => applyPartials.call(this, data))
        .then(data => applyVariables.call(this, data, options))
        .then(data => {
            callback(null, data);
        }).catch(err => {
            try {
                callback(err);
            } catch (catchErr) {
                console.error("FATAL?");
                console.error(catchErr);
            }
        });
}

async function applyPartials(data) {
    const rx = /\[\[i= *(.*?) *\]\]/gi;
    let matchBoxes = [...data.matchAll(rx)].filter((v, i, s) => s.indexOf(v) === i);

    for (let box of matchBoxes) {
        let partial = await fs.readFile(path.join(this.root, box[1] + this.ext));
        data = data.replace(new RegExp(RegExp.escape(box[0])), partial);
    }

    return data;
}

async function applyVariables(data, options) {
    const rx = /\[\[(?!\w=) *(.*?) *\]\]/gi;
    let matchBoxes = [...data.matchAll(rx)].filter((v, i, s) => s.indexOf(v) === i);

    for (let box of matchBoxes) {
        let variable = options[box[1]];
        if (variable !== undefined) data = data.replace(new RegExp(RegExp.escape(box[0])), variable);
    }

    return data;
}

module.exports.engine = engine;