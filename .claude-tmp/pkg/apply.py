import json,hashlib,os,shutil,sys
root=sys.argv[1]; pkg=os.path.dirname(os.path.abspath(__file__))
man=json.load(open(os.path.join(pkg,'manifest.json')))
conflicts=[]
for f,h in man.items():
    dst=os.path.join(root,f)
    if h is None:
        if os.path.exists(dst): conflicts.append(f+' (exists)')
        continue
    cur=open(dst,'rb').read().replace(b'\r\n',b'\n') if os.path.exists(dst) else None
    if cur is None or hashlib.sha256(cur).hexdigest()!=h: conflicts.append(f)
if conflicts and '--force' not in sys.argv:
    print('CONFLICTS:'); print('\n'.join(conflicts)); sys.exit(2)
for f in man:
    dst=os.path.join(root,f); os.makedirs(os.path.dirname(dst),exist_ok=True)
    shutil.copyfile(os.path.join(pkg,'files',f),dst)
print('applied',len(man))
