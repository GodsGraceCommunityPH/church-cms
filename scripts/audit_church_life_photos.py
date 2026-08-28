"""Read-only Church Life photo audit. Never mutates Supabase or local images."""
from __future__ import annotations
import base64, hashlib, html, io, json, os, sys, urllib.request
from pathlib import Path
from PIL import Image, ImageFilter, ImageStat

ROOT=Path(__file__).resolve().parents[1]; ENV=ROOT/'frontend'/'.env.local'; OUT=ROOT/'docs'/'audits'/'church-life-photo-audit.html'
def env():
 d={}
 for line in ENV.read_text().splitlines():
  if '=' in line and not line.lstrip().startswith('#'): k,v=line.split('=',1);d[k.strip()]=v.strip()
 return d
def get(url,headers={}):
 req=urllib.request.Request(url,headers=headers);return urllib.request.urlopen(req,timeout=45).read()
def dhash(im):
 p=list(im.convert('L').resize((9,8)).getdata());return sum((p[y*9+x]>p[y*9+x+1])<<(y*8+x) for y in range(8) for x in range(8))
def hamming(a,b):return (a^b).bit_count()
def inspect(raw):
 im=Image.open(io.BytesIO(raw));im.thumbnail((1600,1600));gray=im.convert('L');mean=ImageStat.Stat(gray).mean[0];edges=gray.filter(ImageFilter.FIND_EDGES);sharp=ImageStat.Stat(edges).var[0];thumb=im.copy();thumb.thumbnail((240,180));buf=io.BytesIO();thumb.convert('RGB').save(buf,'JPEG',quality=72)
 reason=[]
 if mean<18:reason.append('extremely dark')
 if mean>242:reason.append('extremely overexposed')
 if sharp<45:reason.append('severe blur / very low detail')
 return {'sha':hashlib.sha256(raw).hexdigest(),'phash':dhash(im),'size':len(raw),'width':im.width,'height':im.height,'mean':mean,'sharp':sharp,'reason':reason,'thumb':'data:image/jpeg;base64,'+base64.b64encode(buf.getvalue()).decode()}
def main():
 cfg=env();base=cfg['VITE_SUPABASE_URL'];key=cfg['VITE_SUPABASE_ANON_KEY'];headers={'apikey':key,'Authorization':'Bearer '+key};select='id,slug,title,cover_photo_id,photos:church_life_photos!church_life_photos_album_id_fkey(id,image_path,storage_path,display_order)';albums=json.loads(get(base+'/rest/v1/church_life_albums?select='+select+'&order=display_order.asc',headers));rows=[]
 for album in albums:
  for p in album['photos']:
   path=p['storage_path'] or p['image_path'];item={'album':album['title'],'id':p['id'],'path':path,'cover':p['id']==album['cover_photo_id']}
   try:
    raw=get(base+'/storage/v1/object/public/church-life-images/'+path) if p['storage_path'] else (ROOT/'frontend'/'public'/path.lstrip('/')).read_bytes();item.update(inspect(raw))
   except Exception as exc:item['error']=str(exc)
   rows.append(item);print(f"{len(rows)} {album['title']} {path}",flush=True)
 good=[r for r in rows if 'sha'in r];exact={}
 for r in good:exact.setdefault(r['sha'],[]).append(r)
 exact=[g for g in exact.values() if len(g)>1]
 parent=list(range(len(good)))
 def find(x):
  while parent[x]!=x:parent[x]=parent[parent[x]];x=parent[x]
  return x
 def union(a,b):
  a,b=find(a),find(b)
  if a!=b:parent[b]=a
 for i in range(len(good)):
  for j in range(i+1,len(good)):
   if good[i]['sha']!=good[j]['sha'] and hamming(good[i]['phash'],good[j]['phash'])<=4:union(i,j)
 groups={}
 for i,r in enumerate(good):groups.setdefault(find(i),[]).append(r)
 near=[g for g in groups.values() if len(g)>1];low=[r for r in good if r['reason']]
 def cards(group):
  return ''.join(f"<article><img src='{r['thumb']}'><b>{html.escape(r['album'])}</b><small>{html.escape(r['path'])}<br>{r['size']/1048576:.2f} MB {'• CURRENT COVER' if r['cover'] else ''}</small></article>" for r in group)
 exact_save=sum(sum(r['size'] for r in g)-max(r['size'] for r in g) for g in exact);near_save=sum(sum(r['size'] for r in g)-max(r['size'] for r in g) for g in near)
 sections=[]
 for n,g in enumerate(exact,1):sections.append(f"<h3>Exact Duplicate Group {n}</h3><div class=grid>{cards(g)}</div>")
 for n,g in enumerate(near,1):sections.append(f"<h3>Near-Duplicate Group {n}</h3><p>Perceptual hash distance ≤ 4. Suggested strongest: {html.escape(max(g,key=lambda r:r['sharp'])['path'])}</p><div class=grid>{cards(g)}</div>")
 if low:sections.append('<h3>Low-quality / accidental-shot candidates</h3><div class=grid>'+cards(low)+'</div><ul>'+''.join(f"<li>{html.escape(r['path'])}: {', '.join(r['reason'])}</li>" for r in low)+'</ul>')
 summary=f"<h1>Church Life Photo Audit</h1><p><b>Read-only audit. No photos were deleted or changed.</b></p><ul><li>Total inspected: {len(good)} of {len(rows)}</li><li>Total size: {sum(r['size'] for r in good)/1048576:.1f} MB</li><li>Exact duplicate groups: {len(exact)}; recoverable: {exact_save/1048576:.1f} MB</li><li>Near-duplicate groups: {len(near)}; possible saving: {near_save/1048576:.1f} MB</li><li>Objective low-quality candidates: {len(low)}; size: {sum(r['size'] for r in low)/1048576:.1f} MB</li></ul>"
 OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text("<!doctype html><meta charset=utf-8><title>Church Life Photo Audit</title><style>body{font:15px system-ui;max-width:1200px;margin:30px auto;padding:0 20px}.grid{display:flex;flex-wrap:wrap;gap:14px}article{display:grid;width:240px;border:1px solid #ddd;padding:8px;border-radius:10px}img{width:240px;height:180px;object-fit:cover}small{overflow-wrap:anywhere}</style>"+summary+''.join(sections),encoding='utf-8');print(json.dumps({'inspected':len(good),'records':len(rows),'size_mb':round(sum(r['size'] for r in good)/1048576,1),'exact_groups':len(exact),'exact_recoverable_mb':round(exact_save/1048576,1),'near_groups':len(near),'near_possible_mb':round(near_save/1048576,1),'low_quality':len(low),'low_quality_mb':round(sum(r['size'] for r in low)/1048576,1),'report':str(OUT)}))
if __name__=='__main__':main()
