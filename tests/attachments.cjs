// Install jsdom, then run: node tests/attachments.cjs
// DOM integration test: GitHub writes and published assets stay in memory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const { File } = require('node:buffer');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname,'..');
const sourceRoot = process.env.KJ_SOURCE_ROOT || root;
const initial = JSON.parse(fs.readFileSync(path.join(root,'data/content.json')));
let published=structuredClone(initial),head='initial',next=0,commits=0;
const blobs=new Map(),trees=new Map(),assets=new Map();
const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname.slice(1);
  if(name==='data/content.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(published));}
  else if(assets.has(name))res.end(assets.get(name));
  else res.writeHead(404).end();
});
const file=(name,bytes=Buffer.from('첨부 문서 무결성 검증\n'))=>new File([bytes],name);
function makeDOM(html,url){
  const dom=new JSDOM(html,{url,runScripts:'outside-only'}),w=dom.window;
  w.TextDecoder=TextDecoder;w.TextEncoder=TextEncoder;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(value=''){this.returnValue=value;this.open=false;this.dispatchEvent(new w.Event('close'));};
  return {dom,w,run:code=>vm.runInContext(code,dom.getInternalVMContext())};
}
const wait=async check=>{const start=Date.now();while(!check()){if(Date.now()-start>5000)throw Error('Timed out');await new Promise(r=>setTimeout(r,5));}};
async function main(){
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const {dom,w,run}=makeDOM(fs.readFileSync(path.join(root,'admin/index.html'),'utf8'),origin+'/admin/index.html');
  const apiRequests=[];
  w.fetch=async(url,options={})=>{
    assert.ok(String(url).startsWith('https://api.github.com/repos/lee1431/kj/'),'only mock GitHub endpoint');
    const p=new URL(url).pathname.replace('/repos/lee1431/kj',''),body=options.body?JSON.parse(options.body):null;let data;
    apiRequests.push({p,method:options.method||'GET'});
    if(p==='/branches/main')data={commit:{sha:head,commit:{tree:{sha:'base'}}}};
    else if(p==='/git/trees/base')data={tree:[],truncated:false};
    else if(p.startsWith('/contents/'))data={content:Buffer.from(JSON.stringify(published)).toString('base64'),encoding:'base64'};
    else if(p==='/git/ref/heads/main')data={object:{sha:head}};
    else if(p==='/git/blobs'){const sha='blob'+(++next);blobs.set(sha,body);data={sha};}
    else if(p==='/git/trees'){const sha='tree'+(++next);trees.set(sha,body.tree);data={sha};}
    else if(p==='/git/commits'){const sha='commit'+(++next);trees.set(sha,trees.get(body.tree));data={sha};}
    else if(p==='/git/refs/heads/main'){
      for(const entry of trees.get(body.sha)){
        const b=blobs.get(entry.sha),bytes=Buffer.from(b.content,b.encoding==='base64'?'base64':'utf8');
        if(entry.path==='data/content.json')published=JSON.parse(bytes);else assets.set(entry.path,bytes);
      }head=body.sha;commits++;data={object:{sha:head}};
    }else throw Error('Unexpected mock request '+p);
    return {ok:true,status:200,json:async()=>data};
  };
  run(fs.readFileSync(path.join(sourceRoot,'admin/admin.js'),'utf8'));
  w.document.querySelector('#token').value='test-only-not-a-real-token';await run('connect()');
  await run("show('content')");
  const button=name=>[...w.document.querySelectorAll('button')].find(b=>b.textContent===name);
  const select=w.document.querySelector('#main select');
  async function upload(files){const input=w.document.querySelector('#main input[type=file]');Object.defineProperty(input,'files',{value:files,configurable:true});await input.onchange();}
  async function publish(){w.document.querySelector('#publish').click();assert.ok(w.document.querySelector('#confirm').open);w.document.querySelector('#confirm').close('publish');await wait(()=>!run('busy'));assert.equal(run('staged.size'),0);}
  const exts=['pdf','hwp','hwpx','doc','docx','xls','xlsx','ppt','pptx','txt'];
  const tinyPNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');
  for(const kind of ['notice','portfolio']){
    select.value=kind;select.onchange();button('새 자료 추가').click();await wait(()=>run(`content.${kind}.length`)===initial[kind].length+1);
    const title=[...w.document.querySelectorAll('.split > .card label')].find(l=>l.firstChild.textContent==='제목').querySelector('input');title.value='첨부 검증 '+kind;title.dispatchEvent(new w.Event('input'));
    await upload(exts.map(ext=>file('문서 검증.'+ext)));
    assert.equal(run(`content.${kind}[0].attachments.length`),10);
    assert.equal(published[kind].length,initial[kind].length,'draft stays private');
    for(const bad of [file('실행.exe'),file('empty.txt',Buffer.alloc(0)),file('large.pdf',Buffer.alloc(5*1024*1024+1)),{name:'unreadable.txt',size:8,arrayBuffer:async()=>{throw Error('read failed');}}]){
      const before=run('JSON.stringify([...staged])');await upload([file('first.txt'),bad,file('last.txt')]);
      assert.equal(run('JSON.stringify([...staged])'),before,'failed selection must be atomic');
    }
    await upload([file('정확히5MB.PDF',Buffer.alloc(5*1024*1024,65)),file('이미지.png',tinyPNG)]);
    assert.equal(run(`content.${kind}[0].attachments.length`),11);
    const input=w.document.querySelector('#main input[type=file]');let release;
    Object.defineProperty(input,'files',{value:[{name:'race.txt',size:8,arrayBuffer:()=>new Promise(r=>release=r)}],configurable:true});
    const pending=input.onchange();assert.equal(w.document.querySelector('#publish').disabled,true,'publish blocked during read');
    assert.equal(w.document.querySelector('#main').inert,true);
    release(Buffer.from('첨부 문서 무결성 검증\n'));await pending;await publish();
    assert.equal(published[kind][0].attachments.length,12);
    assert.deepEqual(published[kind].slice(1),initial[kind],'existing posts preserved');
    const publicHTML=fs.readFileSync(path.join(root,kind+'.html'),'utf8');
    const pub=makeDOM(publicHTML,origin+'/'+kind+'.html');pub.w.fetch=(url,opts)=>fetch(new URL(url,origin),opts);
    pub.run(fs.readFileSync(path.join(sourceRoot,'assets/js/api.js'),'utf8'));
    if(kind==='notice')await pub.run("renderNotices(document.querySelector('#noticeList'))");
    else {await pub.run('initPortfolioArchive()');const s=pub.w.document.querySelector('#portfolioSearch');s.value='첨부 검증 portfolio';s.dispatchEvent(new pub.w.Event('input'));}
    const links=[...pub.w.document.querySelectorAll('.content-attachments a')];assert.equal(links.length,12);
    if(kind==='notice'){
      const row=pub.w.document.querySelector('[data-content-detail]');row.click();assert.ok(row.classList.contains('open'));links[0].dispatchEvent(new pub.w.MouseEvent('click',{bubbles:true,cancelable:true}));assert.ok(row.classList.contains('open'),'download click does not collapse notice');
    }
    for(let i=0;i<links.length;i++){
      assert.equal(links[i].download,links[i].textContent,'original filename supplied to browser');
      const response=await fetch(links[i].href);assert.equal(response.status,200);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()),i===10?Buffer.alloc(5*1024*1024,65):Buffer.from('첨부 문서 무결성 검증\n'));
    }
    const uploadedImage=published[kind][0].media[0];assert.deepEqual(Buffer.from(await (await fetch(uploadedImage.url)).arrayBuffer()),tinyPNG);
    pub.dom.window.close();
    // Re-read published JSON using the same admin connection flow, then unlink.
    run('files.clear()');w.document.querySelector('#token').value='test-only';await run('connect()');
    assert.equal(run(`content.${kind}[0].attachments.length`),12,'published attachments reload');
    button('첨부 삭제').click();await wait(()=>run(`content.${kind}[0].attachments.length`)===11);
    assert.equal(published[kind][0].attachments.length,12,'unlink stays private until publish');
    await publish();assert.equal(published[kind][0].attachments.length,11);assert.deepEqual(published[kind].slice(1),initial[kind]);
    assert.ok(assets.size>0,'unlink preserves stored assets for history');
    const after=makeDOM('',origin+'/'+kind+'.html');after.run(fs.readFileSync(path.join(sourceRoot,'assets/js/api.js'),'utf8'));
    const rendered=after.run('renderAttachmentLinks('+JSON.stringify(published[kind][0])+')');
    assert.equal((rendered.match(/<li>/g)||[]).length,11);assert.ok(!rendered.includes('문서 검증.pdf'));after.dom.window.close();
    console.log('PASS',kind,': extensions, 5MiB boundary, invalid/failed batch rollback, upload lock, publish/reload, HTTP byte integrity, unlink, preservation');
  }
  assert.equal(commits,4);assert.deepEqual(published.business,initial.business);assert.deepEqual(published.about,initial.about);
  dom.window.close();console.log('PASS: 24 document + 2 image HTTP retrievals; 4 mock commits; no production writes');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
