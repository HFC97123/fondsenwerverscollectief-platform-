# Testserver zoals Vercel: bestaat het bestand niet, dan index.html (adressen zonder #, zie src/app/adres.js).
# Gebruik: python3 spa_server.py <poort> <map>
import http.server, os, sys, functools

class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def send_head(self):
        pad = self.translate_path(self.path)
        if not os.path.exists(pad):
            naam = os.path.basename(self.path.split('?')[0])
            if naam and os.path.isfile(os.path.join(self.directory, naam)):
                self.path = '/' + naam  # relatief geladen bundel op een diep adres
            else:
                self.path = '/index.html'
        return super().send_head()

poort, map_ = int(sys.argv[1]), sys.argv[2]
http.server.ThreadingHTTPServer(('', poort), functools.partial(H, directory=map_)).serve_forever()
