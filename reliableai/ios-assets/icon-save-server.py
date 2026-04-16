import http.server, json, base64, os

DIR = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)
        data = json.loads(body)
        img_data = data['data'].split(',', 1)[-1]
        if self.path == '/save-splash':
            save_path = os.path.join(DIR, 'splash-2732x2732.png')
        else:
            save_path = os.path.join(DIR, 'icon-1024.png')
        with open(save_path, 'wb') as f:
            f.write(base64.b64decode(img_data))
        self.send_response(200)
        self._cors()
        self.end_headers()
        self.wfile.write(b'saved')
        print(f'Saved: {save_path}')

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def log_message(self, *a): pass

srv = http.server.HTTPServer(('127.0.0.1', 9878), Handler)
print('Save server on :9878')
srv.serve_forever()
