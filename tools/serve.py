"""Dev server that refuses to be cached.

Plain `python3 -m http.server` sends Last-Modified and nothing else, so Chrome
heuristically caches src/*.js and quietly serves a stale build after an edit —
which looks exactly like a code bug. no-store removes that whole class of
confusion.
"""
import http.server
import sys


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        if '304' not in fmt % args:
            super().log_message(fmt, *args)


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    print('http://localhost:%d' % port)
    http.server.test(HandlerClass=Handler, port=port, bind='127.0.0.1')
