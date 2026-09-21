"""Local, bounded inference test viewer. Run using terrain-diffusion/.venv/bin/python."""
import json
import math
import hashlib
import io
from pathlib import Path
import subprocess
import sys
import threading
from flask import Flask, jsonify, request, send_from_directory, Response

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'artifacts' / 'terrain-diffusion'
OUTPUT.mkdir(parents=True, exist_ok=True)
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 64 * 1024 * 1024
SOURCE = OUTPUT / 'source.json'
ORIGINS = {'http://127.0.0.1:8871', 'http://localhost:8871', 'http://127.0.0.1:5174', 'http://localhost:5174'}
job = None
job_lock = threading.Lock()
log_file = None

@app.get('/benchmark')
def index():
    return '''<!doctype html><meta name="viewport" content="width=device-width"><title>Spacology · Terrain Lab</title>
<style>body{margin:0;background:#111923;color:#e4eaf0;font:16px system-ui}main{max-width:1000px;margin:40px auto;padding:24px}h1{font-size:32px}p{color:#b6c5ce;line-height:1.6}button,select{padding:12px;border:1px solid #587283;border-radius:8px;background:#243846;color:white}section{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px}img{width:100%;image-rendering:auto;border-radius:12px}pre{white-space:pre-wrap;font:13px monospace}article{background:#1a2733;padding:22px;border-radius:12px}@media(max-width:700px){section{grid-template-columns:1fr}}</style>
<main><p>SPACOLOGY / TERRAIN EXPERIMENTS</p><h1>Terrain Diffusion Lab</h1>
<p>Test one 23.04 km region at 90 metres per pixel. Import an FMG Full JSON world or send it from Alien Worlds. Choose a location to refine, or run the synthetic benchmark.</p>
<p id="source">No FMG world imported.</p><input id="file" type="file" accept=".json" aria-label="FMG Full JSON"><button id="import">Import world</button><p><label>Source <select id="mode"><option value="fmg">Imported FMG world</option><option value="synthetic">Synthetic benchmark</option></select></label> <label>Latitude <input id="lat" type="number" min="-85" max="85" step="any" value="0"></label> <label>Longitude <input id="lon" type="number" min="-180" max="180" step="any" value="0"></label></p>
<select id="device" aria-label="Inference device"><option value="mps">Apple GPU · MPS</option><option value="cpu">CPU</option></select>
<button id="run">Generate test region</button><p id="status" role="status">Checking local runner…</p>
<section><article><h2>Generated elevation</h2><img id="terrain" alt="Shaded relief from the last completed diffusion run" hidden><p>Shaded from actual model elevation data; not a generated illustration.</p></article><article><h2>Run measurements</h2><pre id="report"></pre><details><summary>Runner log</summary><pre id="log"></pre></details></article></section>
<p>World generation stays in FMG. Imported map cells supply a local 129×129 conditioning patch. Seasonality is estimated from Earth biome analogues. Choose a region with roughly 1475 km of surrounding map coverage. Regional previews are independent; stitching adjacent outputs is not supported yet. Planetary biome and sci-fi overlays remain separate from the Earth-trained terrain model.</p></main>
<script>
const run=document.getElementById('run'); let stamp='';
async function refresh(){try{const r=await fetch('/status');const s=await r.json();run.disabled=s.running;document.getElementById('source').textContent=s.source?'Imported: '+s.source.name:'No FMG world imported.';document.getElementById('import').disabled=s.running;document.getElementById('status').textContent=s.running?'Generating a bounded tile…':s.exitCode!=null&&s.exitCode!==0?'Run failed. See runner log.':s.report?'Last test completed.':'Ready to run a benchmark.';document.getElementById('report').textContent=JSON.stringify(s.report,null,2)||'No completed result yet.';document.getElementById('log').textContent=s.log;if(s.report&&stamp!==s.stamp){stamp=s.stamp;const image=document.getElementById('terrain');image.src='/artifact/relief.png?v='+stamp;image.hidden=false;}}catch(e){document.getElementById('status').textContent='Local runner unavailable.';}}
run.onclick=async()=>{run.disabled=true;try{const r=await fetch('/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({device:document.getElementById('device').value,mode:document.getElementById('mode').value,latitude:Number(document.getElementById('lat').value),longitude:Number(document.getElementById('lon').value)})});if(!r.ok)throw Error(await r.text());await refresh();}catch(e){document.getElementById('status').textContent=e.message;run.disabled=false;}};document.getElementById('import').onclick=async()=>{const file=document.getElementById('file').files[0];if(!file)return;try{const r=await fetch('/import',{method:'POST',headers:{'Content-Type':'application/json'},body:await file.text()});if(!r.ok)throw Error(await r.text());await refresh();}catch(e){document.getElementById('status').textContent=e.message;}};refresh();setInterval(refresh,2500);
</script>'''

@app.get('/')
def viewer():
    return send_from_directory(ROOT / 'tools/terrain-viewer', 'index.html')

@app.get('/viewer.js')
def viewer_script():
    return send_from_directory(ROOT / 'tools/terrain-viewer', 'viewer.js')

@app.get('/world')
def world():
    if not SOURCE.exists():
        return jsonify(error='Import a world in the benchmark lab first'), 404
    data = json.loads(SOURCE.read_text())
    geo = data['mapCoordinates']
    return jsonify(name=data['info'].get('mapName','World'), bounds=geo,
        hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest())

@app.get('/overview.png')
def overview():
    if not SOURCE.exists():
        return 'Import a world first', 404
    import numpy as np
    from scipy.spatial import cKDTree
    from PIL import Image
    data=json.loads(SOURCE.read_text()); grid=data['grid']; w,h=1024,512
    x,y=np.meshgrid((np.arange(w)+0.5)/w*data['info']['width'], (np.arange(h)+0.5)/h*data['info']['height'])
    _,ids=cKDTree(grid['points']).query(np.stack([x.ravel(),y.ravel()],axis=1))
    elevation=np.array([c['h'] for c in grid['cells']])[ids].reshape(h,w)
    temperature=np.array([c['temp'] for c in grid['cells']])[ids].reshape(h,w)
    colors=np.zeros((h,w,3),dtype=np.uint8)
    colors[:]=[69,110,86];colors[elevation<20]=[22,55,77]
    colors[elevation>45]=[133,137,109];colors[elevation>65]=[188,183,160]
    colors[(temperature<0)&(elevation>=20)]=[204,222,219]
    image=Image.fromarray(colors);buffer=io.BytesIO();image.save(buffer,format='PNG')
    return Response(buffer.getvalue(),mimetype='image/png')

active_detail = None

@app.post('/detail')
def detail():
    global job, log_file, active_detail
    config=request.get_json(silent=True) or {}
    lat,lon=config.get('latitude'),config.get('longitude')
    if not all(isinstance(v,(int,float)) and math.isfinite(v) for v in (lat,lon)) or not -85<=lat<=85 or not -180<=lon<=180:
        return jsonify(error='Detail is available between 85°S and 85°N.'),400
    with job_lock:
        if not SOURCE.exists():return jsonify(error='Import an FMG world first'),400
        digest=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
        if config.get('world') != digest:return jsonify(error='World changed. Reload the viewer.'),409
        lat,lon=round(lat,1),round(lon,1)
        key=hashlib.sha256(f'fmg-detail-v1:{digest}:{lat}:{lon}:90m:mps'.encode()).hexdigest()
        folder=OUTPUT/'cache'/key
        report=folder/'report.json'
        if report.exists():return jsonify(state='ready',key=key,latitude=lat,longitude=lon,report=json.loads(report.read_text()))
        if job is not None and job.poll() is None:
            return jsonify(state='running' if active_detail==key else 'busy',key=key),202
        if active_detail==key and job is not None and job.poll()!=0:
            return jsonify(state='failed',key=key,error='Refinement failed. '+(folder/'runner.log').read_text(errors='replace')[-1800:])
        folder.mkdir(parents=True,exist_ok=True)
        if log_file:log_file.close()
        log_file=(folder/'runner.log').open('w')
        job=subprocess.Popen([sys.executable,'-u',str(ROOT/'tools/td-smoke.py'),'--device','mps','--fmg',str(SOURCE),
            '--latitude',str(lat),'--longitude',str(lon),'--output',str(folder)],cwd=ROOT,stdout=log_file,stderr=subprocess.STDOUT)
        active_detail=key
        return jsonify(state='running',key=key,latitude=lat,longitude=lon),202

@app.get('/detail/<key>.png')
def detail_image(key):
    if len(key)!=64 or any(c not in '0123456789abcdef' for c in key):return 'Not found',404
    return send_from_directory(OUTPUT/'cache'/key,'relief.png')

@app.before_request
def check_origin():
    if request.method in ('POST', 'OPTIONS') and request.headers.get('Origin') not in ORIGINS | {None}:
        return jsonify(error='Local requests only'), 403

@app.after_request
def cors(response):
    origin = request.headers.get('Origin')
    if origin in ORIGINS:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Vary'] = 'Origin'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    return response

@app.route('/import', methods=['POST', 'OPTIONS'])
def import_world():
    if request.method == 'OPTIONS':
        return '', 204
    from fmg_conditioning import validate
    try:
        data = validate(request.get_json())
        # Check field structure before accepting a new source.
        for cell in data['grid']['cells']:
            for key in ('h', 'temp', 'prec'):
                if not math.isfinite(float(cell[key])):
                    raise ValueError('Invalid map fields')
        for cell in data['pack']['cells']:
            if len(cell['p']) != 2 or not all(math.isfinite(float(v)) for v in cell['p']):
                raise ValueError('Invalid packed cell positions')
    except (ValueError, KeyError, TypeError) as error:
        return jsonify(error=str(error)), 400
    with job_lock:
        if job is not None and job.poll() is None:
            return jsonify(error='Wait for the active run before replacing its source'), 409
        pending = OUTPUT / 'source.pending.json'
        pending.write_text(json.dumps(data, allow_nan=False))
        pending.replace(SOURCE)
    return jsonify(imported=True, name=data['info'].get('mapName', 'Unnamed world'))

@app.get('/status')
def status():
    report_path = OUTPUT / 'report.json'
    log = OUTPUT / 'runner.log'
    source = json.loads(SOURCE.read_text()) if SOURCE.exists() else None
    return jsonify(source={'name': source['info'].get('mapName', 'Unnamed world')} if source else None, running=job is not None and job.poll() is None,
        exitCode=job.poll() if job else None,
        report=json.loads(report_path.read_text()) if report_path.exists() else None,
        stamp=str(report_path.stat().st_mtime_ns) if report_path.exists() else '',
        log=log.read_text(errors='replace')[-12000:] if log.exists() else '')

@app.post('/run')
def run():
    global job, log_file, active_detail
    if request.headers.get('Origin') not in (None, 'http://127.0.0.1:8871', 'http://localhost:8871'):
        return jsonify(error='Local requests only'), 403
    config = request.get_json(silent=True) or {}
    device = config.get('device')
    mode = config.get('mode', 'synthetic')
    extra = []
    if mode == 'fmg':
        if not SOURCE.exists():
            return jsonify(error='Import an FMG Full JSON world first'), 400
        lat, lon = config.get('latitude'), config.get('longitude')
        if not all(isinstance(v, (int,float)) and math.isfinite(v) for v in (lat,lon)) or not -85 <= lat <= 85 or not -180 <= lon <= 180:
            return jsonify(error='Invalid coordinates'), 400
        extra = ['--fmg', str(SOURCE), '--latitude', str(lat), '--longitude', str(lon)]
    elif mode != 'synthetic':
        return jsonify(error='Invalid source'), 400
    if device not in ('cpu', 'mps'):
        return jsonify(error='Choose cpu or mps'), 400
    with job_lock:
        if job is not None and job.poll() is None:
            return jsonify(error='A run is already active'), 409
        if log_file:
            log_file.close()
        active_detail = None
        log_file = (OUTPUT / 'runner.log').open('w')
        job = subprocess.Popen([sys.executable, '-u', str(ROOT / 'tools/td-smoke.py'), '--device', device,
            '--output', str(OUTPUT)] + extra, cwd=ROOT, stdout=log_file, stderr=subprocess.STDOUT)
    return jsonify(started=True), 202

@app.get('/artifact/<name>')
def artifact(name):
    if name not in ('relief.png', 'report.json', 'elevation.npy'):
        return 'Not found', 404
    return send_from_directory(OUTPUT, name)

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8871, debug=False)
