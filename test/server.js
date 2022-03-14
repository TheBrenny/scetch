const http = require("http");
const path = require("path");
const scetch = require("../scetch")({
    root: path.join(__dirname, 'views'),
});

const serverInfo = {
    host: "localhost",
    port: 7233
};

const server = http.createServer(async (req, res) => {
    res.write(await scetch.engine('index', {
        url: req.url,
        time: new Date().toLocaleString()
    }));
    res.end();
});

server.listen(serverInfo.port, serverInfo.host, () => {
    console.log(`Server is listening at http://${serverInfo.host}:${serverInfo.port}...`);
});