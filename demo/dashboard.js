const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8766;
const STATE_FILE = path.join(__dirname, 'ui-state.json');
const HTML_FILE = path.join(__dirname, 'dashboard.html');

http.createServer(function(req, res) {
  if (req.url === '/ui-state.json') {
    try {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } catch(e) {
      res.writeHead(404);
      res.end('{}');
    }
  } else {
    try {
      const html = fs.readFileSync(HTML_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch(e) {
      res.writeHead(500);
      res.end('dashboard.html not found');
    }
  }
}).listen(PORT, function() {
  console.log('Dashboard: http://localhost:' + PORT);
});
