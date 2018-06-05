from os import listdir, path
import json
from aiohttp import web
from aiohttp_index import IndexMiddleware

PROJECT_ROOT = path.dirname(path.abspath(__file__))
PAYLOADS_ROOT = path.join(PROJECT_ROOT, 'app', 'payloads')

async def handle_manifest(request):
	onlyfiles = [f for f in listdir(PAYLOADS_ROOT) if path.isfile(path.join(PAYLOADS_ROOT, f))]
	return web.Response(text=json.dumps(onlyfiles))

app = web.Application(middlewares=[IndexMiddleware()])
app.router.add_route('GET',
					path='/app/payloads/manifest.json',
					handler=handle_manifest)
					
app.router.add_static('/app',
					path=path.join(PROJECT_ROOT, 'app'),
					name='app',
					show_index=True)
app.router.add_static('/',
					path=PROJECT_ROOT,
					name='root',
					show_index=True)

web.run_app(app)