const vm = require('vm');
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

function engine(filePath, variables, callback) {
    if (!path.isAbsolute(filePath)) filePath = path.join(scetchOptions.root || this.root || scetchDefaults.root, filePath);
    if (!filePath.endsWith('.sce')) filePath += '.sce';

    let p = fs.readFile(filePath)
        .then(data => data.toString())
        .then(data => processData.call(this, data, variables))
        .then(data => applyVariables.call(this, data, variables))
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

async function processData(data, variables, noLogic) {
    return Promise.resolve(data)
        .then(data => applyPartials.call(this, data))
        .then(data => applyComponentLoadScripts.call(this, data))
        .then(data => applyComponentInjections.call(this, data, variables))
        .then(data => applyVariables.call(this, data, variables))
        .then(data => noLogic ? data : applyLogic.call(this, data, variables));
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

async function applyVariables(data, variables) {
    if (typeof variables === "undefined" || Object.getOwnPropertyNames(variables).length === 0) return data;
    const rx = /\[\[(?!.*=) *([^\[\]\s]+?) *\]\]/gi;
    let matchBoxes = [...data.matchAll(rx)];
    if (!matchBoxes || !matchBoxes.length) return data;
    matchBoxes = matchBoxes.filter((v, i, s) => s.indexOf(v) === i);

    for (let box of matchBoxes) {
        let dotNot = box[1].split('.');

        let variable = variables;
        for (let d of dotNot) {
            if(typeof variable === "undefined") break;
            variable = variable[d];
        }
        if(typeof variable === "undefined") continue;

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

async function applyComponentInjections(data, variables) {
    const rx = /\[\[c= *([^ ]+?)(?: *\|\| *(.+?))? *\]\]/gi;
    const rxV = /(\w+)=("[^"\\]*(?:\\.[^"\\]*)*"|(?:\w+\.*)+)/gi;
    let matchBoxes = [...data.matchAll(rx)];
    if (!matchBoxes || !matchBoxes.length) return data;

    // get opts for all matchboxes

    let root = scetchOptions.root || this.root || scetchDefaults.root;
    let ext = scetchOptions.ext || this.ext || scetchDefaults.ext;
    for (let box of matchBoxes) {
        let matches = (box[2] || "").match(rxV) || [];
        matches = matches.map((el) => el.split("="));
        let options = {};

        for (let opt of matches) {
            if (opt[1].startsWith("\"")) opt[1] = opt[1].substring(1, opt[1].length - 1).replace(/\\"/gi, "\"");
            else opt[1] = variables[opt[1]] || `[[ ${opt[1]} ]]`;
            options[opt[0]] = opt[1];
        }

        try {
            let component = (await fs.readFile(path.join(root, box[1] + ext))).toString();
            component = await processData(component, options);
            data = data.replace(new RegExp(RegExp.escape(box[0]), "g"), component);
        } catch (e) {
            continue;
        }
    }

    return data;
}

async function applyLogic(data, variables) {
    // The name is quite suiting... 🤣🙃
    const endConditional = /\[\[\?==\]\]/gi;
    const ifOpen = /\[\[\?= *([^\s=].*?) *\]\]/gi;
    const elseIf = /\[\[3= *(.*?) *\]\]/gi;
    const numberLoop = /\[\[f= *(\w+?) *(\d+):(?:(\d+):)?(\d+) *\]\]/gi;
    const eachLoop = /\[\[e= *(\w+) *in *(\w+) *\]\]/gi;
    const whileLoop = /\[\[w= *(\S.*?) *\]\]/gi;

    data = data.split("\n");

    let schema = (type, line, meta) => {
        return {
            "type": type, // if, for, each, while
            "line": line || 0, // the line of the start (not reqd always)
            "meta": meta || {} // any additional info for this type (not reqd always)
        };
    };

    let depth = [];
    depth.last = () => depth[depth.length - 1];

    let ret = [];
    let safeEval;

    let output = true;
    let loopVars = {};

    for (let lineNo = 0; lineNo < data.length; lineNo++) {
        let line = data[lineNo];

        if (depth.length > 0 && endConditional.test(line)) {
            switch (depth.last().type) {
                case "if":
                    output = true;
                    depth.pop();
                    break;
                case "for":
                    depth.last().meta.val += depth.last().meta.skip;
                    if (depth.last().meta.val >= depth.last().meta.stop) {
                        //break loop
                        loopVars = {};
                        depth.pop();
                    } else {
                        loopVars[depth.last().meta.varName] = depth.last().meta.val;
                        lineNo = depth.last().line;
                    }
                    break;
            }
            continue;
        }

        // Opening If
        let matchBoxes = [...line.matchAll(ifOpen)];
        if (!!matchBoxes && matchBoxes.length) {
            depth.push(schema("if", lineNo, {
                ran: false
            }));
            safeEval = vm.runInNewContext(matchBoxes[0][1], variables); // lol not so safe...
            depth.last().ran = output = safeEval;
            continue;
        }

        // Else If, Else
        matchBoxes = [...line.matchAll(elseIf)];
        if (!!matchBoxes && matchBoxes.length && depth.last().type === "if") {
            if (output || depth.last().ran) output = false;
            else {
                // else if or just else
                if (matchBoxes[0][1] != "") safeEval = vm.runInNewContext(matchBoxes[0][1], variables);
                else safeEval = true;

                depth.last().ran = output = safeEval;
            }
            continue;
        }

        // For each number
        matchBoxes = [...line.matchAll(numberLoop)];
        if (!!matchBoxes && matchBoxes.length) {
            let d = {
                varName: matchBoxes[0][1],
                start: parseInt(matchBoxes[0][2]),
                val: parseInt(matchBoxes[0][2]),
                skip: parseInt(matchBoxes[0][3] || 1),
                stop: parseInt(matchBoxes[0][4])
            };
            depth.push(schema("for", lineNo, d));
            loopVars[d.varName] = parseInt(d.start);
            continue;
        }

        matchBoxes = [...line.matchAll(eachLoop)];
        matchBoxes = [...line.matchAll(whileLoop)];

        if (output) {
            ret.push(await processData(line, Object.assign({}, variables, loopVars), true));
        }
    }

    data = ret.join("\n");
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