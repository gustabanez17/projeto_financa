export const SYNC_PATHS = [
  "historyResetVersion","activeUser","theme","sidebarColor","navOrder","month","homeGroups","sharedQuotes","savings",
  ...["Rebeca","Gustavo"].flatMap(name=>["plan","forecasts","transactions","people","alerts","alertTemplate","quotes","cards"].map(field=>`users.${name}.${field}`))
];

const readPath = (source,path) => path.split(".").reduce((value,key)=>value?.[key],source);

const writePath = (source,path,value) => {
  const keys=path.split("."),root={...source};
  let cursor=root,current=source;
  keys.forEach((key,index)=>{
    if(index===keys.length-1){cursor[key]=value;return;}
    cursor[key]={...(current?.[key]||{})};
    cursor=cursor[key];
    current=current?.[key];
  });
  return root;
};

export const collectSyncPatches = (previous,next,currentPatches={},revision=Date.now()) => {
  const patches={...currentPatches};
  SYNC_PATHS.forEach(path=>{
    const before=readPath(previous,path),after=readPath(next,path);
    if(JSON.stringify(before)!==JSON.stringify(after))patches[path]={value:after,revision};
  });
  return patches;
};

export const applySyncPatches = (base,patches={}) => Object.entries(patches).reduce((state,[path,entry])=>writePath(state,path,entry.value),base);
