module.exports = (function () {
    globalThis.scetch = globalThis.scetch ?? {};
    // globalThis.scetch.bindings = globalThis.scetch.bindings ?? {};
    if(!globalThis.scetch.bindingMethodsCreated) {
        // This allows us to create one get/set/bindings obj ever.
        // When this script is called again, we skip this if, so we don't create another binding object.
        // the end state is that we have an untouchable, scoped, bindings object which can only be modded through the get/set
        let bindings = {};
        globalThis.scetch.get = globalThis.scetch.get ?? ((varName) => bindings[varName].value ?? undefined);
        globalThis.scetch.set = globalThis.scetch.set ?? ((varName, value) => {
            bindings[varName].value = value;
            let els = document.querySelectorAll(bindings[varName].element);
            let att = bindings[varName].attribute;

            if(att.startsWith("!")) els.forEach(el => el[att.substring(1)] = value);
            else els.forEach(el => el.setAttribute(att, value));

            return value;
        });
        globalThis.scetch.bind = globalThis.scetch.bind ?? ((varName, element, attribute, defaultVal) => {
            bindings[varName] = {
                value: undefined,
                element: element,
                attribute: attribute
            };
            if(defaultVal !== undefined) globalThis.scetch.set(varName, defaultVal);
        });
        globalThis.scetch.bindingMethodsCreated = true;
    }

}).toString();