module.exports = (function () {
    if (!RegExp.escape) {
        RegExp.escape = function (s) {
            return String(s).replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
        };
    }

    function recurseGetVariable(varName, variables) {
        let dotNot = typeof varName === "string" ? varName.split('.') : Array.isArray(varName) ? varName : undefined;
        if(dotNot === undefined) return undefined;

        let variable = variables;
        for(let d of dotNot) {
            if(typeof variable === "undefined") break;
            variable = variable[d];
        }
        return variable;
    }

    globalThis.scetch = globalThis.scetch ?? {};

    globalThis.scetch.insert = function (target, position, component, data) {
        let pos = ["beforeBegin", "afterBegin", "beforeEnd", "afterEnd"];

        if (typeof component === 'undefined') {
            component = position;
            position = "afterEnd";
        } else if (component.constructor.name === 'Object') {
            data = component;
            component = position;
            position = "afterEnd";
        }

        position = pos.indexOf(position) === -1 ? pos[pos.length - 1] : position; // make sure we use a good position!

        data = data || {};

        if (!!Object.getOwnPropertyNames(data).length) {
            const rx = /\[\[ *(.*?) *\]\]/gi;
            let matchBoxes = [...component.matchAll(rx)];
            if (matchBoxes && matchBoxes.length) {
                matchBoxes = matchBoxes.filter((v, i, s) => s.indexOf(v) === i);

                for (let box of matchBoxes) {
                    let variable = recurseGetVariable(box[1], data);
                    if (variable !== undefined) component = component.replace(new RegExp(RegExp.escape(box[0]), "g"), variable);
                }
            }
        }

        if (component.constructor.name.indexOf("Element") == -1) component = new DOMParser().parseFromString(component, "text/html").querySelector("body>*");

        target.insertAdjacentElement(position, component);
        return component;
    };
    globalThis.scetchInsert = function() {
        console.warn("scetchInsert is deprecated, use scetch.insert instead");
        return globalThis.scetch.insert.apply(this, arguments);
    };
}).toString();