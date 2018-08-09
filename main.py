# If you run this on a private server, set this to "private"
# to enable file saving functionality
runMode = "public"

from os import listdir, path
import json
from aiohttp import web
from aiohttp_index import IndexMiddleware

PROJECT_ROOT = path.dirname(path.abspath(__file__))
PAYLOADS_ROOT = path.join(PROJECT_ROOT, 'app', 'payloads')

async def handle_manifest(request):
	onlyfiles = [f for f in listdir(PAYLOADS_ROOT) if path.isfile(path.join(PAYLOADS_ROOT, f))]
	return web.Response(text=json.dumps(onlyfiles))

async def handle_payload_put(request):
  if runMode != "private":
    return web.Response(status=405) # method not allowed
  payloadName = request.match_info['payload']
  payload = await request.text()
  with open(path.join(PAYLOADS_ROOT, payloadName), 'w+') as file:
    file.write(payload)
  return web.Response(status=204)
  
app = web.Application(middlewares=[IndexMiddleware()])
app.router.add_route('GET',
					path='/app/payloads/manifest.json',
					handler=handle_manifest)
app.router.add_route('PUT',
					path='/app/payloads/{payload}',
					handler=handle_payload_put)
					
app.router.add_static('/app',
					path=path.join(PROJECT_ROOT, 'app'),
					name='app',
					show_index=True)
app.router.add_static('/',
					path=PROJECT_ROOT,
					name='root',
					show_index=True)

web.run_app(app)