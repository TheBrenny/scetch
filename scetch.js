const path = require('path');
const fs = require('fs').promises;

const scetchInjectScript = require("./util/scetchInjectScript").toString();

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
        .then(data => applyComponentLoadScripts.call(this, data))
        .then(data => applyComponentInjections.call(this, data))
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
    let matchBoxes = [...data.matchAll(rx)];
    if (!matchBoxes || !matchBoxes.length) return data;
    matchBoxes = matchBoxes.filter((v, i, s) => s.indexOf(v) === i);

    let root = scetchOptions.root || this.root || scetchDefaults.root;
    let ext = scetchOptions.ext || this.ext || scetchDefaults.ext;
    for (let box of matchBoxes) {
        try {
            let partial = (await fs.readFile(path.join(root, box[1] + ext))).toString();
            data = data.replace(new RegExp(RegExp.escape(box[0]), "g"), partial);
        } catch (e) {
            continue;
        }
    }

    return data;
}

async function applyVariables(data, options) {
    if (typeof options === "undefined") return data;
    const rx = /\[\[(?!.*=) *(.*?) *\]\]/gi;
    let matchBoxes = [...data.matchAll(rx)];
    if (!matchBoxes || !matchBoxes.length) return data;
    matchBoxes = matchBoxes.filter((v, i, s) => s.indexOf(v) === i);

    for (let box of matchBoxes) {
        if (typeof options[box[1]] === 'undefined') continue;
        let variable = options[box[1]];
        if (variable !== undefined) data = data.replace(new RegExp(RegExp.escape(box[0]), "g"), variable);
    }

    return data;
}

async function applyComponentLoadScripts(data) {
    const rx = /\[\[l= *(.+?) *\]\]/gi;
    let matchBoxes = [...data.matchAll(rx)];
    if (!matchBoxes || !matchBoxes.length) return data;
    matchBoxes = matchBoxes.filter((v, i, s) => s.indexOf(v) === i);

    let root = scetchOptions.root || this.root || scetchDefaults.root;
    let ext = scetchOptions.ext || this.ext || scetchDefaults.ext;

    let script = `<script>(${scetchInjectScript})();;(()=>{`;

    for (let box of matchBoxes) {
        try {
            let p = path.join(root, box[1] + ext);
            let componentName = path.basename(p, ext);

            let component = (await fs.readFile(p)).toString();
            script += `scetch["${componentName}"] = \`${component}\`;\n`;

            data = data.replace(new RegExp(RegExp.escape(box[0]), "g"), ""); // remove all component references
        } catch (e) {
            continue;
        }
    }

    script += `})();</script>`;

    let insert = data.indexOf("</body>");
    data = data.substr(0, insert) + script + data.substr(insert);

    return data;
}

async function applyComponentInjections(data) {
    const rx = /\[\[c= *([^ ]+?)(?: *\|\| *(.+?))? *\]\]/gi;
    const rxV = /(\w+)=("[^"\\]*(?:\\.[^"\\]*)*"|(?:\w+\.*)+)/gi;
    let matchBoxes = [...data.matchAll(rx)];
    if (!matchBoxes || !matchBoxes.length) return data;

    // get opts for all matchboxes

    let root = scetchOptions.root || this.root || scetchDefaults.root;
    let ext = scetchOptions.ext || this.ext || scetchDefaults.ext;
    for (let box of matchBoxes) {
        let matches = box[2].match(rxV);
        let options = {};

        for (let opt of matches) {
            options[opt[1]] = opt[2];
        }

        try {
            let component = (await fs.readFile(path.join(root, box[1] + ext))).toString();
            component = await applyVariables(component, options);
            data = data.replace(new RegExp(RegExp.escape(box[0]), "g"), component);
        } catch (e) {
            continue;
        }
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