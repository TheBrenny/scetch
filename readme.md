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
  res.write(await scetch.engine('home'), {
        url: req.url,
        time: new Date().toLocaleString()
    }).end;
})
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
- [Variables](#variables)
- [Partials](#partials)
- [Conditionals](#conditionals)
- [Loops](#loops)
- [Components](#components)

These expressions are found using Regular Expressions, therefore, scetch is pretty flexible about what you can put in - it even doesn't care for spaces, so add as many as you want!

### Variables

- Usage: `[[ variableName ]]` ~~or `[[ object.value ]]`~~ TODO
- Regex: `/\[\[[^=]*? *([^\[\]\s]+?) *\]\]/gi`

Variables are inserted within the scetch engine by swapping the placeholder with the variable passed from the express route. What you'll notice is that you can also use dot notation for objects! Depth for dot notation is relatively shallow, and it's probably best that you stray from it when using loops - this is what caused my hair to fall out last night! Otherwise, I guess it works well -- I haven't really tested it too hard... ~~This allows for extra complexity which you might not get from another templating engine!~~

### Partials

- Usage: `[[i= location/to/partial ]]`
- Regex: `/\[\[i= *(.+?) *\]\]/gi`

Partials are synonymous with includes (yeah, just like PHP includes... almost...). You can specify a portion of your HTML (the whole head tag for example), and then add in `[[i=partial/head]]` into your template, and your whole head tag will be inserted!

### Conditionals

- Usage:
  - If: `[[?= "js eval expression" != null ]]`
  - Else If: `[[3= "another expression" == null ]]`
  - Else: `[[3= ]]` (else if with no expression)
  - ~~Else: `[[!= else ]]`~~
  - End If: `[[?==]]`
- Regexes:
  - If: `/\[\[\?= *([^\s=].*?) *\]\]/gi`
  - Else (If): `/\[\[3= *(.*?) *\]\]/gi`
  - End If: `/\[\[\?==\]\]/gi`

Conditionals provide you with a way to control the flow of your rendered views. You can show or hide content *on the server side* to make sure the end user does (not) see what they're (not) supposed to!

### Loops

- Usage:
  - For: `[[f= counter 0:10 ]]` or `[[f= number 0:2:10 ]]` (step 2 each time)
  - For Each: `[[e= newVar in array ]]` (newVar is a variable, not an index!)
  - While: `[[w= jsBoolEvalExpression() ]]`
  - End Loop: `[[?==]]` (I know, it's the end if! 😮)
- Regexes:
  - For: `/\[\[f= *(\w+?) *(\d+):(?:(\d+):)?(\d+) *\]\]/gi`
  - For Each: `/\[\[e= *(\w+) *in *(\w+) *\]\]/gi`
  - While: `/\[\[w= *(\S.*?) *\]\]/gi`
  - End Loop: `/\[\[\?==\]\]/gi` (I know, it's the end if! 😮)

Loops allow you to duplicate certain pieces of your template so you can create multiples! The counter loop is inclusive of start, and exclusive of end, so looping from 0 to 10 will provide 0 through 9 (or 10 values).

Also, if you want to use the number counter to reference an array element from a variable passed in, you can use dot notation and variable substitution, like `[[ array.[[counter]] ]]`. scetch handles this by substituting the value for the counter in during the loop, and then substituting the whole variable just before finishing up! (Take note that this is only required because of variable name dependency.)

What you might also notice, is that the end loop tag is identical to the end if - this is intentional, because the last open if/for/while will be closed using the end loop/if!

### Components

- Usage:
  - Prepare component: `[[l= location/to/component ]]` - Places a `script` object where this tag is.
  - Inject component on server: `[[c= location/to/component || obj=obj.variable literal="literal strings" escaped="\"escaped\" values too" ]]`
  - Inject component on client-side: `js: scetch.insert(target, [position], scetchComponent, data)`
- Regexes:
  - Prepare: `\[\[l= *(.+?) *\]\]`
  - Injection:
    - Whole Capture: `/\[\[c= *([^ ]+?)(?: *\|\| *(.+?))? *\]\]/gi`
    - Variables Capture: `/(\w+)=("[^"\\]*(?:\\.[^"\\]*)*"|(?:\w+\.*)+)/gi`
    - RegExr: https://regexr.com/5bimv and https://regexr.com/5biqb

Components in scetch allow you to render partials both statically and dynamically! You can render the partial before sending data to the client by using `c=`, allowing you to, for example, add multiple rows of todos! Then if the client wants a new todo, the global scetch object can insert one on your command! By calling `scetch.insert($(".todos"), "beforeend", scetch.comps.todo)`, you can add a new todo component before the closing tag of the todo list!

*See also! `scetch.insert` is more-or-less a wrapper for [`insertAdjacentHTML`](https://developer.mozilla.org/en-US/docs/Web/API/Element/insertAdjacentHTML). Go there to understand the arguments!*

## scetch to *Mona Lisa*

scetch's processing flow isn't fully matured yet, and is subject to change at any time. This may break your environment, so be careful when it comes to updating scetch! Here's the current flow:

`Partials  ->  Component Load Scripts  ->  Component Injections  ->  Variables  ->  If/Else (NOT YET!)  ->  Numerical Loops  ->  Elemental Loops  ->  While Loops`

A cool idea would be to make this processing flow more modular, and let you users take control of it, but we'll see what happens... I gotta give scetch a real canvas first!

## Contributing
Pull requests are warmly welcomed. For major changes, please open an issue first to discuss what you would like to change.

~~Please make sure to update tests as appropriate.~~ Yeah.... We'll get to testing one day... Maybe you could sort it out? 🙏

## License
[MIT](https://choosealicense.com/licenses/mit/)