# scetch

`scetch` is yet another templating library for express. It differs from the rest because it taught me how the express rendering/middleware engine works, and also really, really, really simple to use. I mean ***REALLY*** simple.

Why `scetch` and not `sketch`? Honestly, I don't know. I think I wanted it to be different? 

## Installation

```bash
npm install --save scetch
```

## Usage

### Quick Start

In your `app.js`:
```javascript
const express = require('express');
const scetch = require('scetch');

let app = express();
app.set('views', 'views'); // registers './views' as the folder holding all the scetch template files
app.engine('sce', scetch.engine); // 'sce' registers the file extension, scetch.engine is the actual engine!
app.set('view engine', 'sce'); // tells express to look for '*.sce' files when rendering

app.get('/*', (req,res) => {
    res.render('home', {
        url: req.url,
        time: new Date(Date.now()).toLocaleString()
    });
});
```

And here's the `views/home.sce`
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

### `sce` How To

`scetch` offers a variety of handlebar-like expressions to make your templates easy to manage:
 - [Variables](#variables)
 - [Includes](#includes)
 - ~~[Conditionals](#conditionals)~~
 - ~~[Loops](#loops)~~
 - ~~[Components](#components)~~

These expressions are found using Regular Expressions, therefore, `scetch` is pretty flexible about what you can put in - it even doesn't care for spaces, so add as many as you want!

#### Variables

- Usage: `[[ variableName ]]` ~~or `[[ object.value ]]`~~ TODO
- Regex: `/\[\[(?!\w=) *(.*?) *\]\]/gi`

Variables are inserted within the `scetch` engine by swapping the placeholder with the variable passed from the express route. ~~What you'll notice is that you can also use dot notation for objects! This allows for extra complexity which you might not get from another templating engine!~~

#### Includes

- Usage: `[[i= location/to/partial ]]`
- Regex: `/\[\[i= *(.*?) *\]\]/gi`

Includes are partials. You can specify a portion of your HTML (the whole head tag for example), and then add in `[[i=partial/head]]` into your template, and your whole head tag will be inserted!

#### ~~Conditionals~~ TODO!

- Usage:
  - If: `[[?= "js eval expression" != null ]]`
  - Else If: `[[3= "another expression" == null ]]`
  - Else: `[[!= else ]]`
  - End If: `[[?==]]`
- Regexes: `yet to be built`

Conditionals provide you with a way to control the flow of your rendered views. You can show or hide content *on the server side* to make sure the end user does (not) see what they're (not) supposed to!

#### ~~Loops~~ TODO!

- Usage:
  - For: `[[f= counter 0:10 ]]` or `[[f= number 0:2:10 ]]` (step 2 each time)
  - For Each: `[[e= newVar in array ]]`
  - While: `[[w= jsBoolEvalExpression() ]]`
  - End Loop: `[[?==]]` (I know, it's the end if! 😮)
- Regexes: `yet to be built`

Loops allow you to duplicate certain pieces of your template so you can create multiples! The counter loop is inclusive of both ends, so looping from 0 to 10 will provide 0 and 10 as values. What you might also notice, is that the end loop is identical to the end if - this is intentional, because the last open if/for/while will be closed using the end loop/if!

#### ~~Components~~ TODO! Maybe?

I don't actually know why I want this...

## Contributing
Pull requests are warmly welcomed. For major changes, please open an issue first to discuss what you would like to change.

~~Please make sure to update tests as appropriate.~~ Yeah.... We'll get to testing one day... Maybe you could sort it out? 🙏

## License
[MIT](https://choosealicense.com/licenses/mit/)