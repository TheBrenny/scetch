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
        .then(addPartials.bind(this))
        .then(data => {
            callback(null, data);
        }).catch(err => {
            callback(err);
        });
}

async function addPartials(data) {
    // const rx = /\[\[i= *(.*?) *\]\]/g;
    // [...data.matchAll(rx)].filter((v, i, s) => s.indexOf(v) === i).forEach(async (matchBox) => {
    //     // match group is array: [whole match, group 1]
    //     let partial = await fs.readFile(path.join(this.root, matchBox[1] + this.ext)).catch((err) => {
    //         throw new Error(err);
    //     });
    //     data = data.replaceAll(matchBox[0], partial);
    // });

    // return data;

    const rx = /\[\[i= *(.*?) *\]\]/g;
    let matchBoxes = [...data.matchAll(rx)].filter((v, i, s) => s.indexOf(v) === i);
    for (let box of matchBoxes) {
        let partial = await fs.readFile(path.join(this.root, box[1] + this.ext));
        data = data.replace(new RegExp(RegExp.escape(box[0])), partial);
    }

    return data;

    // return new Promise((resolve, reject) => {

    //     (matchBox) => {
    //         // match group is array: [whole match, group 1]
    //         fs.readFile(path.join(this.root, matchBox[1] + this.ext))
    //             .then(partial => {
    //                 data = data.replace(new RegExp(RegExp.escape(matchBox[0])), partial);
    //             })
    //             .catch(reject).toString();
    //     };
    //     resolve(data);
    // });
}

module.exports.engine = engine;