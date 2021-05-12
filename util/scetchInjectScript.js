module.exports = (function () {
    if (!RegExp.escape) {
        RegExp.escape = function (s) {
            return String(s).replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
        };
    }

    function getDeepObjectByString(obj, str) {
        let parts = str.split(".").reverse();

        while (obj != null && parts.length > 0) obj = obj[parts.pop()];

        return obj;
    }

    globalThis.scetch = globalThis.scetch || {};

    globalThis.scetchInsert = function (target, position, component, data) {
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
            const rx = /\[\[(?!.*=) *(.*?) *\]\]/gi;
            let matchBoxes = [...component.matchAll(rx)];
            if (matchBoxes && matchBoxes.length) {
                matchBoxes = matchBoxes.filter((v, i, s) => s.indexOf(v) === i);

                for (let box of matchBoxes) {
                    let variable = getDeepObjectByString(data, box[1]);
                    if (variable !== undefined) component = component.replace(new RegExp(RegExp.escape(box[0]), "g"), variable);
                }
            }
        }

        if (component.constructor.name.indexOf("Element") == -1) component = new DOMParser().parseFromString(component, "text/html").querySelector("body>*");

        target.insertAdjacentElement(position, component);
        return component;
    };
}).toString();