import zipfile,json,pathlib,sys
if len(sys.argv)!=2:raise SystemExit('Usage: python3 tools/import-town-nature.py /path/to/kenney_nature-kit.zip')
z=zipfile.ZipFile(sys.argv[1]);out=pathlib.Path(__file__).resolve().parents[1]/'prototypes/labs/castle-drafts/toolkit/assets';out.mkdir(parents=True,exist_ok=True);models={}
for name in ['tree_oak','plant_bushDetailed','rock_smallA','flower_purpleA']:
 root='Models/OBJ format/'+name;materials={};current=None
 for line in z.read(root+'.mtl').decode().splitlines():
  t=line.split()
  if not t:continue
  if t[0]=='newmtl':current=t[1]
  if t[0]=='Kd':materials[current]=[float(x) for x in t[1:4]]
 vertices=[];triangles=[];color=[.5,.5,.5]
 for line in z.read(root+'.obj').decode().splitlines():
  t=line.split()
  if not t:continue
  if t[0]=='v':vertices.append([round(float(x),6) for x in t[1:4]])
  elif t[0]=='usemtl':color=materials[t[1]]
  elif t[0]=='f':
   ids=[int(x.split('/')[0])-1 for x in t[1:]]
   for i in range(1,len(ids)-1):triangles.append([ids[0],ids[i],ids[i+1],*[round(x,5) for x in color]])
 models[name]={'vertices':vertices,'triangles':triangles}
(out/'nature.json').write_text(json.dumps(models,separators=(',',':'))+'\n');(out/'KENNEY-LICENSE.txt').write_bytes(z.read('License.txt'))
(out/'SOURCES.md').write_text('''# Third-party assets\n\nKenney Nature Kit (2020), https://kenney.nl/assets/nature-kit\nLicense: CC0 1.0, supplied license in KENNEY-LICENSE.txt.\nDownloaded 2026-10-24 from the direct download linked on the author’s page.\n\nIncluded models: tree_oak, plant_bushDetailed, rock_smallA, flower_purpleA.\nConverted from OBJ/MTL to indexed triangles and diffuse colors in nature.json;\noriginal geometry is preserved. Scene instances scale and tint these models.\nNo Unity packages or purchased assets are bundled.\n\nOther candidates (not bundled):\n- Quaternius Medieval Village: https://quaternius.com/packs/medievalvillage.html (CC0)\n- Quaternius Medieval Village MegaKit: https://quaternius.com/packs/medievalvillagemegakit.html (free subset, CC0)\n''')
print('Imported',len(models),'models;', (out/'nature.json').stat().st_size,'bytes')
