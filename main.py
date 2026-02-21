# Modern aiohttp server for barcOwned
# Updated for Python 3.10+ / aiohttp 3.x

# If you run this on a private server, set this to "private"
# to enable file saving functionality
runMode = "public"

from os import listdir, path, getenv
import json
import os
from aiohttp import web

PROJECT_ROOT = path.dirname(path.abspath(__file__))
PAYLOADS_ROOT = path.join(PROJECT_ROOT, 'payloads')


async def handle_manifest(request):
    onlyfiles = [f for f in listdir(PAYLOADS_ROOT) if path.isfile(path.join(PAYLOADS_ROOT, f))]
    return web.json_response(onlyfiles)


async def handle_rename(request):
    if runMode != "private":
        return web.Response(status=405)

    newPayloadName = await request.text()
    os.rename(
        path.join(PAYLOADS_ROOT, request.match_info['payload']),
        path.join(PAYLOADS_ROOT, newPayloadName)
    )
    return web.Response(status=200)


async def handle_runmode(request):
    return web.Response(text=runMode)


async def handle_payload_put(request):
    if runMode != "private":
        return web.Response(status=405)
    payloadName = request.match_info['payload']
    payload = await request.text()
    with open(path.join(PAYLOADS_ROOT, payloadName), 'w+') as file:
        file.write(payload)
    return web.Response(status=204)


# Serve index.html for directory-like paths
async def handle_index(request):
    """Serve index.html for directory paths."""
    req_path = request.match_info.get('path', '')

    # Map URL paths to filesystem paths
    if req_path.startswith('app') or req_path.startswith('editor'):
        # Both /app and /editor serve the React build
        fs_path = path.join(PROJECT_ROOT, 'app', 'build', 'index.html')
    elif req_path.startswith('run'):
        fs_path = path.join(PROJECT_ROOT, 'run', 'index.html')
    elif req_path == '' or req_path == '/':
        fs_path = path.join(PROJECT_ROOT, 'index.html')
    else:
        # Try to serve as a static file
        fs_path = path.join(PROJECT_ROOT, req_path)
        if path.isdir(fs_path):
            fs_path = path.join(fs_path, 'index.html')

    if path.isfile(fs_path):
        return web.FileResponse(fs_path)
    raise web.HTTPNotFound()


app = web.Application()

# API routes
app.router.add_get('/payloads/manifest.json', handle_manifest)
app.router.add_put('/payloads/{payload}', handle_payload_put)
app.router.add_patch('/rename-payload/{payload}', handle_rename)
app.router.add_get('/runmode', handle_runmode)

# Static file routes (order matters - more specific first)
app.router.add_static('/app/static', path.join(PROJECT_ROOT, 'app', 'build', 'static'), name='app_static')
app.router.add_static('/payloads', PAYLOADS_ROOT, name='payloads')
app.router.add_static('/css', path.join(PROJECT_ROOT, 'css'), name='css')
app.router.add_static('/js', path.join(PROJECT_ROOT, 'js'), name='js')
app.router.add_static('/resources', path.join(PROJECT_ROOT, 'resources'), name='resources')

# Directory index routes
app.router.add_get('/', handle_index)
app.router.add_get('/app', handle_index)
app.router.add_get('/app/', handle_index)
app.router.add_get('/app/{path:.*}', handle_index)
app.router.add_get('/editor', handle_index)
app.router.add_get('/editor/', handle_index)
app.router.add_get('/editor/{path:.*}', handle_index)
app.router.add_get('/run', handle_index)
app.router.add_get('/run/', handle_index)
app.router.add_get('/run/{path:.*}', handle_index)

if __name__ == '__main__':
    web.run_app(app, port=int(getenv('PORT', 8080)))
