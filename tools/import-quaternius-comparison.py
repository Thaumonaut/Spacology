import zipfile,json,pathlib,subprocess,hashlib,sys
root=pathlib.Path('prototypes/labs/castle-drafts/toolkit/room-compare/assets');archive=pathlib.Path(sys.argv[1]);z=zipfile.ZipFile(archive);prefix='Medieval Village MegaKit[Standard]/glTF/';models=['Wall_Plaster_Straight','Wall_Plaster_Door_Flat','Wall_Plaster_Window_Wide_Flat','Wall_Plaster_Window_Thin_Round','Floor_WoodDark','Roof_RoundTiles_6x4','Roof_RoundTiles_6x8','Roof_RoundTiles_4x4','Roof_Front_Brick6','Roof_Front_Brick4','Prop_Crate'];images=set();bounds={}
for name in models:
 d=json.loads(z.read(prefix+name+'.gltf'));used=set()
 for m in d.get('materials',[]):
  for k in ['normalTexture','occlusionTexture']:m.pop(k,None)
  pbr=m.get('pbrMetallicRoughness',{});pbr.pop('metallicRoughnessTexture',None);pbr['metallicFactor']=0;pbr['roughnessFactor']=.85
  if 'baseColorTexture' in pbr:used.add(pbr['baseColorTexture']['index'])
 textures=[];newImages=[];remap={}
 for i in sorted(used):
  t=dict(d['textures'][i]);image=d['images'][t['source']];t['source']=len(newImages);newImages.append(image);remap[i]=len(textures);textures.append(t);images.add(image['uri'])
 for m in d.get('materials',[]):
  p=m.get('pbrMetallicRoughness',{}).get('baseColorTexture')
  if p:p['index']=remap[p['index']]
 d['images']=newImages;d['textures']=textures;d['asset']['extras']={'source':'Quaternius Medieval Village MegaKit Standard / CC0','adaptation':'Base colour textures only; resized to 512px. Geometry and UVs unchanged.'}
 (root/(name+'.gltf')).write_text(json.dumps(d,separators=(',',':')))
 for b in d['buffers']:(root/b['uri']).write_bytes(z.read(prefix+b['uri']))
 src=z.read('Medieval Village MegaKit[Standard]/OBJ/'+name+'.obj').decode();v=[list(map(float,l.split()[1:4])) for l in src.splitlines() if l.startswith('v ')];bounds[name]={'min':[min(p[a] for p in v) for a in range(3)],'max':[max(p[a] for p in v) for a in range(3)]}
for name in images:
 (root/name).write_bytes(z.read(prefix+name));subprocess.run(['sips','-Z','512',str(root/name)],check=True,stdout=subprocess.DEVNULL)
(root/'LICENSE-QUATERNIUS.txt').write_bytes(z.read('Medieval Village MegaKit[Standard]/License_Standard.txt'))
(root/'manifest.json').write_text(json.dumps({'source':'https://quaternius.com/packs/medievalvillagemegakit.html','download':'https://quaternius.itch.io/medieval-village-megakit','license':'CC0-1.0','downloaded':'2026-10-25','models':bounds,'textures':sorted(images),'sourceArchiveSHA256':hashlib.sha256(archive.read_bytes()).hexdigest()},indent=2))
print(len(models),'models,',len(images),'base-colour textures;',round(sum(f.stat().st_size for f in root.iterdir())/1048576,2),'MiB')
