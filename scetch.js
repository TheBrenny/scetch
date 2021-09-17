// TODO: There's a bug with loops where if the condition fails the first time, we still print the data! fix this!
//       A fix might be to document this behaviour with a fix (wrap in an if block) and patch in scetch 2.0.0 (major change)?

const vm = require('vm'); // change this to vm2!!
const path = require('path');
const fs = require('fs').promises;

const scetchInjectScript = require("./util/scetchInjectScript");

let scetchDefaults = {
    root: path.join(__dirname, 'views'),
    ext: ".sce",
    nonceName: "nonce"
};
let scetchOptions = {};

// Escape polyfill because that's how we replace all.
if(!RegExp.escape) {
    RegExp.escape = function (s) {
        return String(s).replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
    };
}
// Matchall polyfill - this is how we handle Node <12
if(!String.prototype.matchAll) {
    String.prototype.matchAll = function (rx) {
        if(typeof rx === "string") rx = new RegExp(rx, "g");
        rx = new RegExp(rx);
        let cap = [];
        let all = [];
        while((cap = rx.exec(this)) !== null) all.push(cap);
        return all;
    };
}

function runInContext(script, context) {
    try {
        return vm.runInContext(script, context);
    } catch(e) {
        //console.error(e)
    }
    return false;
}

function runInNewContext(script, context) {
    try {
        return vm.runInNewContext(script, context);
    } catch(e) {
        //console.error(e);
    }
    return false;
}

function engine(filePath, variables, callback) {
    if(!path.isAbsolute(filePath)) filePath = path.join(scetchOptions.root, filePath);
    if(!filePath.endsWith('.sce')) filePath += '.sce';

    let p = fs.readFile(filePath)
        .then(data => data.toString())
        .then(data => processData.call(this, data, variables))
        .then(data => applyVariables.call(this, data, variables))
        .then(data => {
            if(!callback) return data;
            callback(null, data);
        }).catch(err => {
            if(!callback) return err;

            try {
                callback(err);
            } catch(catchErr) {
                console.error("FATAL?");
                console.error(catchErr);
            }
        });
    if(!callback) return p;
}

async function processData(data, variables, noLogic) {
    if(typeof this.root === "string") scetchOptions.root = this.root;
    if(typeof this.ext === "string") scetchOptions.ext = this.ext;

    return Promise.resolve(data)
        .then(data => applyPartials(data, variables))
        .then(data => applyComponentLoadScripts(data, variables))
        .then(data => applyComponentInjections(data, variables))
        .then(data => applyVariables(data, variables))
        .then(data => noLogic ? data : applyLogic(data, variables));
}

async function applyPartials(data, variables) {
    const rx = /\[\[i= *(.*?) *\]\]/gi;
    let matchBoxes = [...data.matchAll(rx)];
    if(!matchBoxes || !matchBoxes.length) return data;
    matchBoxes = matchBoxes.filter((v, i, s) => s.indexOf(v) === i);

    let root = scetchOptions.root;
    let ext = scetchOptions.ext;
    for(let box of matchBoxes) {
        try {
            let partial = (await fs.readFile(path.join(root, box[1] + ext))).toString();
            partial = await processData(partial, variables);
            data = data.replace(new RegExp(RegExp.escape(box[0]), "g"), partial);
        } catch(e) {
            console.error(e);
            continue;
        }
    }

    return data;
}

async function applyVariables(data, variables) {
    if(typeof variables === "undefined" || Object.getOwnPropertyNames(variables).length === 0) return data;
    const rx = /\[\[[^\[=]*? *([^\[\]\s]+?) *\]\]/gi;
    let matchBoxes = [...data.matchAll(rx)];
    if(!matchBoxes || !matchBoxes.length) return data;
    matchBoxes = matchBoxes.filter((v, i, s) => s.indexOf(v) === i); // TODO: Fix this filter

    for(let box of matchBoxes) {
        let dotNot = box[1].split('.');

        let variable = variables;
        for(let d of dotNot) {
            if(typeof variable === "undefined") break;
            variable = variable[d];
        }

        // TODO: Stringify 'variable' appropriately.
        if(variable !== undefined) data = data.replace(new RegExp(RegExp.escape(box[0]), "g"), variable);
    }

    return data;
}

async function applyComponentLoadScripts(data, variables) {
    const rx = /\[\[l= *(.+?) *\]\]/gi;
    let matchBoxes = [...data.matchAll(rx)];
    if(!matchBoxes || !matchBoxes.length) return data;
    matchBoxes = matchBoxes.filter((v, i, s) => s.indexOf(v) === i);

    let root = scetchOptions.root;
    let ext = scetchOptions.ext;

    let script = `<script nonce="${variables[scetchOptions.nonceName]}">(${scetchInjectScript})();;(()=>{`;

    for(let box of matchBoxes) {
        try {
            let p = path.join(root, box[1] + ext);
            let componentName = path.basename(p, ext);

            let component = (await fs.readFile(p)).toString();
            script += `scetch["${componentName}"] = \`${component}\`;\n`;

            data = data.replace(new RegExp(RegExp.escape(box[0]), "g"), ""); // remove all component references
        } catch(e) {
            console.error(e);
            continue;
        }
    }

    script += `})();</script>`;

    let insert = data.indexOf("</body>");
    data = data.substr(0, insert) + script + data.substr(insert);

    return data;
}

// TODO: dot ops don't work inside components if you don't name it the exact same as inside the component.
// [[c= component || comp=c ]]
// [[ comp.hello ]] <-- This won't work
// [[ [[c]].hello ]] <-- This might (should?) work
async function applyComponentInjections(data, variables) {
    const rx = /\[\[c= *([^ ]+?)(?: *\|\| *(.+?))? *\]\]/gi;
    const rxV = /(\w+)=("[^"\\]*(?:\\.[^"\\]*)*"|(?:\w+\.*)+)/gi;
    let matchBoxes = [...data.matchAll(rx)];
    if(!matchBoxes || !matchBoxes.length) return data;

    // get opts for all matchboxes

    let root = scetchOptions.root;
    let ext = scetchOptions.ext;
    for(let box of matchBoxes) {
        let matches = (box[2] || "").match(rxV) || [];
        matches = matches.map((el) => el.split("="));
        let options = {};

        for(let opt of matches) {
            if(opt[1].startsWith("\"")) opt[1] = opt[1].substring(1, opt[1].length - 1).replace(/\\"/gi, "\"");
            else opt[1] = variables[opt[1]] || `[[ ${opt[1]} ]]`;
            options[opt[0]] = opt[1];
        }

        try {
            let component = (await fs.readFile(path.join(root, box[1] + ext))).toString();
            component = await processData(component, options);
            data = data.replace(new RegExp(RegExp.escape(box[0]), "g"), component);
        } catch(e) {
            continue;
        }
    }

    return data;
}

async function applyLogic(data, variables) {
    // The name is quite suiting... 🤣🙃
    const endConditional = /\[\[\?==\]\]/gi;
    const endConditionalString = "[[?==]]";
    const ifOpen = /\[\[\?= *([^\s=].*?) *\]\]/gi;
    const elseIf = /\[\[3= *(.*?) *\]\]/gi;
    const numberLoop = /\[\[f= *(\w+?) *(\d+):(?:(\d+):)?(\d+) *\]\]/gi;
    const eachLoop = /\[\[e= *(\w+) *in *(\w+) *\]\]/gi;
    const whileLoop = /\[\[w= *(\S.*?) *\]\]/gi;

    // instead of splitting on each line, we split on what *COULD BE* a closing scetch tag.
    // This allows us to break single line scetch conditionals and operate on them as if they were multiline.
    // data = data.split("\n");
    data = data.split("[[").map((e, i, a) => i === 0 ? e : "[[" + e);
    let buffer = []; // the buffer is used to store manipulated lines (ie, opening loop lines). this means we can loop back to them once they've been processed without re-processing the loop itself

    let schema = (type, line, meta, vars) => {
        return {
            "type": type, // if, for, each, while
            "line": line || 0, // the line of the start (not reqd always)
            "meta": meta || {}, // any additional info for this type (not reqd always)
            "vars": vars || {},
            "output": true
        };
    };

    // TODO: Another output fix would be depth.output where it'll traverse the
    //       stack finding an "output=flase" and thensaying no to output if
    //       that's the case.
    let depth = [];
    depth.last = () => depth[depth.length - 1];
    depth.getVars = () => {
        let o = {};
        for(let d of depth) {
            o = Object.assign(o, d.vars);
        }
        return o;
    };
    let allVars = () => Object.assign({}, variables, depth.getVars());

    let ret = [];
    let safeEval;

    // TODO: Make the scoping of end conditions more correct!
    // TODO: Read a buffer instead of per line -- this'll allow one-liners -- FIXED?
    // More appropriate names would be chunkNo, and chunk instead of lines
    for(let lineNo = 0; lineNo < data.length; lineNo++) {
        let line = buffer[lineNo] || data[lineNo];

        if(depth.length > 0 && endConditional.test(line)) {
            // if relooping, continue so we don't end the block
            // this means if we're popping from the stack, then we break so we can continue reading the file
            switch(depth.last().type) {
                case "if":
                    depth.pop();
                    break;
                case "for":
                    depth.last().meta.val += depth.last().meta.skip;
                    if(depth.last().meta.val >= depth.last().meta.stop) {
                        //break loop
                        depth.pop();
                        break;
                    } else {
                        depth.last().vars[depth.last().meta.varName] = depth.last().meta.val;
                        lineNo = depth.last().line - 1; // line-1 so we can process the start of the loop that's in the buffer
                    }
                    continue;
                case "each":
                    depth.last().meta.idx++;
                    if(depth.last().meta.idx >= depth.last().meta.length) {
                        depth.pop();
                        break;
                    } else {
                        depth.last().vars[depth.last().meta.varName] = depth.last().meta.collection[depth.last().meta.idx];
                        lineNo = depth.last().line - 1;
                    }
                    continue;
                case "while":
                    let safeEval = runInContext(depth.last().meta.condition, depth.last().meta.context);
                    // let safeEval = depth.last().meta.condition.runInContext(depth.last().meta.context);
                    if(safeEval) {
                        lineNo = depth.last().line - 1;
                    } else {
                        depth.pop();
                        break;
                    }
                    continue;
            }
            line = line.substring(endConditionalString.length);
        }

        // Opening If
        let matchBoxes = [...line.matchAll(ifOpen)];
        if(!!matchBoxes && matchBoxes.length) {
            depth.push(schema("if", lineNo, {
                ran: false
            }));
            safeEval = runInNewContext(matchBoxes[0][1], allVars());
            // safeEval = vm.runInNewContext(matchBoxes[0][1], allVars()); // lol not so safe...
            depth.last().meta.ran = depth.last().output = safeEval;
            line = line.substring(matchBoxes[0][0].length);
        }

        // Else If, Else
        matchBoxes = [...line.matchAll(elseIf)];
        if(!!matchBoxes && matchBoxes.length && depth.last().type === "if") {
            if(depth.last().output || depth.last().meta.ran) depth.last().output = false;
            else {
                // else if or just else
                if(matchBoxes[0][1] != "") safeEval = runInNewContext(matchBoxes[0][1], allVars());
                // if (matchBoxes[0][1] != "") safeEval = vm.runInNewContext(matchBoxes[0][1], allVars());
                else safeEval = true;

                depth.last().meta.ran = depth.last().output = safeEval;
            }
            line = line.substring(matchBoxes[0][0].length);
        }

        // For each number
        matchBoxes = [...line.matchAll(numberLoop)];
        if(!!matchBoxes && matchBoxes.length) {
            let out = true;
            let d = {
                varName: matchBoxes[0][1],
                start: parseInt(matchBoxes[0][2]),
                val: parseInt(matchBoxes[0][2]),
                skip: parseInt(matchBoxes[0][3] || 1),
                stop: parseInt(matchBoxes[0][4])
            };
            if(d.start === d.stop) out = false; // 0 loop
            if(Math.sign(d.stop - d.start) != Math.sign(d.skip)) continue; // iterating wrong way! -- TODO: Handle this better
            let v = {
                [d.varName]: d.val
            };
            if(depth.length > 0) out = out && depth.last().output;
            depth.push(schema("for", lineNo, d, v));
            depth.last().output = out;
            line = line.substring(matchBoxes[0][0].length);
            buffer[lineNo] = line;
        }

        // For each OBJECT
        matchBoxes = [...line.matchAll(eachLoop)];
        if(!!matchBoxes && matchBoxes.length) {
            let out = true;
            let d = {
                varName: matchBoxes[0][1],
                idx: 0,
                collection: variables[matchBoxes[0][2]],
            };
            d.length = (d.collection || []).length;
            if(d.length === 0) out = false;
            let v = {};
            if(d.collection) v[d.varName] = d.collection[d.idx];
            if(depth.length > 0) out = out && depth.last().output;
            depth.push(schema("each", lineNo, d, v));
            depth.last().output = out;
            line = line.substring(matchBoxes[0][0].length);
            buffer[lineNo] = line;
        }

        // While Loop
        matchBoxes = [...line.matchAll(whileLoop)];
        if(!!matchBoxes && matchBoxes.length) {
            let out = true;
            if(depth.length > 0) out = out && depth.last().output;
            depth.push(schema("while", lineNo, {
                condition: matchBoxes[0][1],
                context: vm.createContext(allVars()),
                looping: false
            }));
            let safeEval = runInContext(depth.last().meta.condition, dept.last().meta.context);
            // let safeEval = depth.last().condition.runInContext(depth.last().meta.context);
            depth.last().meta.looping = depth.last().output = safeEval && out;
            line = line.substring(matchBoxes[0][0].length);
            buffer[lineNo] = line;
        }

        if(depth.length == 0 || depth.last().output) {
            ret.push(await processData(line, allVars(), true));
        }
    }

    if(depth.length > 0) console.error("depth wasn't emptied! This shouldn't happen! Contents: " + depth.map(d => d.type).join(", "));

    data = ret.join("");
    return data;
}

module.exports.override = (key, value) => {
    if(typeof key === 'object') {
        for(const k in key) {
            if(key.hasOwnProperty(k)) this.override(k, key[k]);
        }
    } else if(typeof key === 'string' && typeof value !== 'undefined') {
        scetchOptions[key] = value;
    }
};
module.exports.engine = engine;
module.exports = (opts) => {
    scetchOptions = Object.assign({}, scetchDefaults, opts || {});
    // if (typeof opts !== "undefined") this.override(opts);
    return this;
};