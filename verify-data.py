"""Validate protobuf tile structure, polygon geometry and official attributes."""
import pathlib, collections, hashlib, json
root=pathlib.Path(__file__).parent/'dist'
def varint(b,i):
    v=s=0
    while True:
        c=b[i];i+=1;v|=(c&127)<<s
        if c<128:return v,i
        s+=7
def fields(b):
    i=0
    while i<len(b):
        tag,i=varint(b,i);wire=tag&7
        if wire==0:v,i=varint(b,i)
        elif wire==2:
            n,i=varint(b,i);v=b[i:i+n];i+=n
        elif wire in (1,5):
            n=8 if wire==1 else 4;v=b[i:i+n];i+=n
        else:raise ValueError('Invalid wire type')
        yield tag>>3,v
def packed(b):
    i=0
    while i<len(b):
        v,i=varint(b,i);yield v
manifest=json.loads((root/'data-manifest.json').read_text())
names=collections.Counter();total=0;polygons=0
for tile in manifest['tiles']:
    b=(root/f"tiles/13/{tile['x']}/{tile['y']}.pbf").read_bytes()
    assert hashlib.sha256(b).hexdigest()==tile['sha256']
    layers=[list(fields(v)) for k,v in fields(b) if k==3]
    for layer in layers:
        assert next(v for k,v in layer if k==1)==b'veg2024'
        keys=[v.decode() for k,v in layer if k==3]
        assert '凡例名' in keys and '植生自然度' in keys
        values=[]
        for k,v in layer:
            if k==4:
                value=list(fields(v));values.append(next((x.decode() for t,x in value if t==1),None))
        for k,v in layer:
            if k!=2:continue
            f=dict(fields(v));total+=1
            if f.get(3)==3:polygons+=1
            assert len(f.get(4,b''))>0
            tags=list(packed(f[2]));props={keys[tags[i]]:values[tags[i+1]] for i in range(0,len(tags),2)}
            names[props.get('凡例名')]+=1
assert polygons==total and total>0
print(json.dumps({'tiles':len(manifest['tiles']),'polygon_fragments':total,'distinct_legend_names':len(names),'names':list(names)},ensure_ascii=False))
