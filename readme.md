# scetch

`scetch` is yet another templating library for vanilla http(s) and express. It differs from the rest because it taught me how the express rendering/middleware engine works, and is also really, really, really simple to use. I really mean ***DEAD SIMPLE***.

Why `scetch` and not `sketch`? Honestly, I don't know. I think I wanted it to be different? 

***Can you condense regexes like a pro? If so, then feel free to chonk down these regexes for super stonks on speed!***

## Installation

```bash
npm install --save scetch
```

## Usage

- [Quick Start](#quick-start)
- [`sce` How To](#sce-how-to)

### Quick Start

Consider this as your `__dirname/views/home.sce`
```handlebars
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>scetch - the newest templating engine!</title>
</head>
<body>
    <p>You requested [[url]]</p>
    <p>The time is [[time]]</p>
</body>
</html>
```

#### Vanila HTTP(S)

In your `server.js`:
```javascript
const http = require('http');
const router = require('./router');
const scetch = require('scetch')();

router.get('/callback-*', (req, res) => {
    scetch.engine('home',{
        url: req.url,
        time: new Date().toLocaleString()
    }, (data) => {
      res.write(data).end();
    });
});
router.get('/promise-*', async function (req, res) => {
    res.write(await scetch.engine('home', {
        url: req.url,
        time: new Date().toLocaleString()
    })).end();
});
```

#### Express

In your `app.js`:
```javascript
const express = require('express');
const scetch = require('scetch')();

let app = express();
app.set('views', 'views'); // registers './views' as the folder holding all the scetch template files
app.engine('sce', scetch.engine); // 'sce' registers the file extension, scetch.engine is the actual engine!
app.set('view engine', 'sce'); // tells express to look for '*.sce' files when rendering

app.get('/*', (req,res) => {
    res.render('home', {
        url: req.url,
        time: new Date().toLocaleString()
    });
});
```

## `sce` How To

scetch offers a variety of handlebar-like expressions to make your templates easy to manage:
 <!-- no toc -->
- [Options](#options)
- [Variables](#variables)
- [Partials](#partials)
- [Conditionals](#conditionals)
- [Loops](#loops)
- [Components](#components)
- [Data Bindings](#data-bindings)

These expressions are found using Regular Expressions, therefore, scetch is pretty flexible about what you can put in - it even doesn't care for spaces, so add as many as you want!

### Options

scetch has a couple of options that you can use to override the default settings of how you expect it to function. This list is by no means exhaustive, and it can even change with any update - fair warning.

The following are the default settings, and can be changed by modifying the values.

```js
const scetch = require("scetch")({
    root: path.join(__dirname, 'views'),
    ext: ".sce",
    nonceName: "nonce"
});
```

### Variables

- Usage: `[[ variableName ]]` or `[[ object.value ]]`
- Regex: `/\[\[[^=]*? *([^\[\]\s]+?) *\]\]/gi`

Variables are inserted within the scetch engine by swapping the placeholder with the variable passed from the express route. What you'll notice is that you can also use dot notation for objects! Depth for dot notation is relatively shallow, and it's probably best that you stray from it when using loops - this is what caused my hair to fall out last night! Otherwise, I guess it works well -- I haven't really tested it too hard... ~~This allows for extra complexity which you might not get from another templating engine!~~ <== That is completely a guess and has no evidence.

To access elements of an array through this tag, you can use dot notation as well! This makes things like `[[ array.0.id ]]` possible!

### Partials

- Usage: `[[i= location/to/partial ]]`
- Regex: `/\[\[i= *(.+?) *\]\]/gi`

Partials are synonymous with includes (yeah, just like PHP includes... almost...). You can specify a portion of your HTML (the whole head tag for example), and then add in `[[i=partial/head]]` into your template, and your whole head tag will be inserted!

### Conditionals

- Usage:
  - If: `[[?= js.eval.expression ]]`
  - Else If: `[[3= another.js.eval.expression ]]`
  - Else: `[[3= ]]` (else if with no expression)
  - End If: `[[?==]]`
- Regexes:
  - If: `/\[\[\?= *([^\s=].*?) *\]\]/gi`
  - Else (If): `/\[\[3= *(.*?) *\]\]/gi`
  - End If: `"[[?==]]"` (straight up string matching)
****
Conditionals provide you with a way to control the flow of your rendered views. You can show or hide content *on the server side* to make sure the end user does (not) see what they're (not) supposed to! These expressions are run in a separate context in order to avoid any security vulnerabilities coming from the use of potentially untrusted evals.

### Loops

- Usage:
  - For: `[[f= counter 0:10 ]]` or `[[f= number 0:2:10 ]]` (step 2 each time) (excludes upper boundary)
  - For Each: `[[e= newVar in array ]]` (newVar is a variable, not an index!)
  - While: `[[w= jsBoolEvalExpression() ]]` (executed on entry)
  - End Loop: `[[?==]]` (I know, it's the end if! 😮)
- Regexes:
  - For: `/\[\[f= *(\w+?) *(\d+):(?:(\d+):)?(\d+) *\]\]/gi`
  - For Each: `/\[\[e= *(\w+) *in *(\S+) *\]\]/gi`
  - While: `/\[\[w= *(\S.*?) *\]\]/gi`
  - End Loop: `"[[?==]]"` (I know, it's the end if! 😮)

Loops allow you to duplicate certain pieces of your template so you can create multiples! The counter loop is inclusive of start, and exclusive of end, so looping from 0 to 10 will provide 0 through 9 (or 10 values).

Also, if you want to use the number counter to reference an array element from a variable passed in, you can use dot notation and variable substitution, like `[[ array.[[counter]] ]]`. scetch handles this by substituting the value for the counter in during the loop, and then substituting the whole variable just before finishing up! (Take note that this is only required because of variable name dependency.)

What you might also notice, is that the end loop tag is identical to the end if - this is intentional, because the last open if/for/while will be closed using the end loop/if!

TODO: It would be excellent to be able to loop numbers between variables: `[[f= counter start:finish ]]`

### Components

- Usage:
  - Prepare component: `[[l= location/to/component ]]` - Places a `<script>` tag before the closing `</body>` tag.
  - Inject component server-side: `[[c= location/to/component || obj=obj.variable literal="literal strings" escaped="\"escaped\" values too" ]]`
  - Inject component client-side: `js: scetch.insert(target, [position], scetchComponent, data)`
- Regexes:
  - Prepare: `/\[\[l= *(.+?) *\]\]/gi`
  - Injection:
    - Whole Capture: `/\[\[c= *([^ ]+?)(?: *\|\| *(.+?))? *\]\]/gi`
    - Variables Capture: `/(\w+)=("[^"\\]*(?:\\.[^"\\]*)*"|(?:\w+\.*)+)/gi`
    - RegExr: https://regexr.com/5bimv and https://regexr.com/5biqb

Components in scetch allow you to render partials both statically and dynamically! You can render the partial before sending data to the client by using `c=`, allowing you to, for example, add multiple rows of todos! Then if the client wants a new todo, the global scetch object can insert one on your command! By calling `scetch.insert($(".todos"), "beforeend", scetch.comps.todo)`, you can add a new todo component before the closing tag of the todo list!

The `scetch.comps` object literally holds the string data of the scetch components. Therefore you can add partials that you don't even load! Simply swap out the scetch component you want to use for valid HTML and, scetch's your engine, it's in!

The only limitation to using the client-side injection is that you only have access to applying variables. You don't get loops, you don't get conditions, you don't get nothin' but variables.

*See also! `scetch.insert` is more-or-less a wrapper for [`insertAdjacentHTML`](https://developer.mozilla.org/en-US/docs/Web/API/Element/insertAdjacentHTML). Go there to understand the arguments!*

### Data Bindings

- Usage: `[[b= bindingName "#targetElementsQuery" "target element attribute" "optional default" ]]`
- Regex: `/\[\[b= *(\w+?) +("[^"\\]*(?:\\.[^"\\]*)*"|(?:\w+\.*)+) +("[^"\\]*(?:\\.[^"\\]*)*"|(?:\w+\.*)+) +("[^"\\]*(?:\\.[^"\\]*)*"|(?:\w+\.*)+)? *\]\]/gi`
  - RegExr: https://regexr.com/6hbkb

Binding allows you to set up global variables which automatically update the DOM on `set`. It works by registering variables in the global `scetch.bindings` with getters and setters. These variables can also be accessed and modified through the `scetch.get(variable)` and `scetch.set(variable, value)` functions.

Additionally if the `"target element attribute"`  begins with an exclamation mark (`!`) then the target is not assumed to be an attribute, but rather a `.property` of the DOM element (ie, `innerText`, `innerHTML`, `hidden`, etc).

Also, the great thing about scetch is that it will allow you to use variables instead of literal strings as arguments, so a default value could be passed to the engine as a variable set by the server.

As an example, setting up a the following binding would allow you to modify the `innerText` of a button to reflect how many times it's been pressed:

```html
<button id="buttonCounter"></button>
[[b= counter "#buttonCounter" "!innerText" "Click Me!" ]]
<script>
    document.querySelector("#buttonCounter").addEventListener("click", () => {
        let num = parseInt(scetch.get("counter"));
        if(isNaN(num)) num = 0;
        scetch.set("counter", num + 1)
    });
</script>
```

## Nonce Usage

Your web app doesn't allow inline scripts? No worries! Nonce use is available to help secure your web apps! One package (also written by TheBrenny) that can help become a middleware to ExpressJS is [`nonce-express`](https://github.com/TheBrenny/nonce-express).

Alternatively, nonces (or any value, really) can be set by setting a variable in the variables object passed to `res.render` or `scetch.engine`.

## scetch to *Mona Lisa*

scetch's processing flow isn't fully matured yet, and is subject to change at any time. This may break your environment, so be careful when it comes to updating scetch! Here's the current flow:

- `engine(filepath, variables, cb)`
  - Read data in `filepath`
  - `processData(data, variables, noLogic)`
    - Apply Partials
    - Apply Component Injections
    - Apply Variables
    - Apply Logic (recursively calls `processData` for some things)
  - Apply Variables (as a safety measure)
  - Apply Data Bindings
  - Apply Component Load Scripts
  - Return the processed data!

A cool idea would be to make this processing flow more modular, and let you users take control of it, but we'll see what happens... I gotta give scetch a real canvas first!

## Contributing

Pull requests are warmly welcomed. For major changes, please open an issue first to discuss what you would like to change.

~~Please make sure to update tests as appropriate.~~ Yeah.... We'll get to testing one day... Maybe you could sort it out? 🙏

TODO: We could use cypress? 😏
TODO: We should also have a demo!!

## Final Words

This is literally just a passion project for no other reason than to build and maintain a project that I can use in my life! I've used it in a number of projects already, and plan to continue using it for more!

If you feel like adopting scetch, please be aware of the risks associated with a library that's just for fun!

## License

[MIT](https://choosealicense.com/licenses/mit/)