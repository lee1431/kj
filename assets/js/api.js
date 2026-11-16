const KIJ_API_ROOT='https://mrdindoin.ddns.net/kij/';
const KIJ_API=`${KIJ_API_ROOT}api/content`;

const escapeHTML=(value='')=>String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const mediaURL=(value='')=>new URL(value, /^(?:assets|data)\//.test(value)?document.baseURI:KIJ_API_ROOT).href;
const plainText=body=>typeof body==='string'?body:(body?.content||'');
function renderAttachmentLinks(item){
  const files=Array.isArray(item.attachments)?item.attachments:[];
  const links=files.map(file=>{
    if(!file||!file.url)return '';
    let url;
    try{url=mediaURL(file.url);if(!['http:','https:'].includes(new URL(url).protocol))return '';}catch{return '';}
    return '<li><a href="'+escapeHTML(url)+'" target="_blank" rel="noopener noreferrer" download="'+escapeHTML(file.name||'첨부파일')+'">'+escapeHTML(file.name||'첨부파일')+'</a></li>';
  }).filter(Boolean);
  return links.length?'<div class="content-attachments"><strong>첨부파일</strong><ul>'+links.join('')+'</ul></div>':'';
}


// Repository-managed content is the primary source; retain the legacy API fallback.
let managedContentPromise;
async function requestContent(type,slug=''){
  managedContentPromise??=fetch(new URL('data/content.json',document.baseURI),{cache:'no-cache'})
    .then(response=>{if(!response.ok)throw Error('Managed content unavailable');return response.json()})
    .catch(()=>null);
  const managed=await managedContentPromise;
  if(managed&&Array.isArray(managed[type])){let rows=managed[type].filter(item=>item.published!==false);if(type==='notice')rows=[...rows].sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned));return slug?rows.filter(item=>item.slug===slug):rows;}
  const response=await fetch(`${KIJ_API}/${encodeURIComponent(type)}${slug?`/${encodeURIComponent(slug)}`:''}`,{headers:{Accept:'application/json'}});
  if(!response.ok) throw new Error(`API ${response.status}`);
  return response.json();
}

function showAPIError(target,message='자료를 불러오지 못했습니다.'){
  if(target) target.innerHTML=`<div class="empty">${escapeHTML(message)}</div>`;
}

async function renderNotices(target,limit){
  try{
    const rows=await requestContent('notice');
    const items=(limit?rows.slice(0,limit):rows);
    target.innerHTML=items.length?items.map((item,index)=>{
      const date=(item.year||item.created_at||'').slice(0,10);
      const text=plainText(item.body);
      const images=(item.media||[]).filter(image=>image.url).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map(image=>'<img src="'+escapeHTML(mediaURL(image.url))+'" alt="'+escapeHTML(image.alt)+'">').join('');
      const attachments=renderAttachmentLinks(item);
      return `<article class="content-row" data-content-detail>
        <span>${item.pinned?'공지':String(index+1).padStart(2,'0')}</span>
        <div><strong>${escapeHTML(item.title)}</strong>${item.summary?`<p>${escapeHTML(item.summary)}</p>`:''}${text||images||attachments?`<div class="content-detail">${escapeHTML(text).replace(/\n/g,'<br>')}${images}${attachments}</div>`:''}</div>
        <time>${escapeHTML(date)}</time>
      </article>`;
    }).join(''):'<div class="empty">등록된 공지사항이 없습니다.</div>';
    target.querySelectorAll('[data-content-detail]').forEach(row=>row.addEventListener('click',event=>{if(event.target.closest('a'))return;row.classList.toggle('open')}));
  }catch(error){showAPIError(target,'공지사항 준비 중입니다.')}
}

async function renderProjects(target){
  try{
    const rows=await requestContent('portfolio');
    target.innerHTML=rows.length?rows.map(item=>{
      const cover=item.media?.[0];
      return `<article class="project-card">
        ${cover?`<img src="${mediaURL(cover.url)}" alt="${escapeHTML(cover.alt)}">`:''}
        <div><span class="eyebrow">${escapeHTML(item.category||'Project')}</span><h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.summary||plainText(item.body))}</p>${renderAttachmentLinks(item)}<dl>${item.client?`<div><dt>CLIENT</dt><dd>${escapeHTML(item.client)}</dd></div>`:''}${item.year?`<div><dt>YEAR</dt><dd>${escapeHTML(item.year)}</dd></div>`:''}</dl></div>
      </article>`;
    }).join(''):'<div class="empty">등록된 실적이 없습니다.</div>';
  }catch(error){showAPIError(target,'실적 자료 준비 중입니다.')}
}

async function initPortfolioArchive(){
  const target=document.querySelector('#projectList');if(!target)return;
  const search=document.querySelector('#portfolioSearch'),category=document.querySelector('#portfolioCategory'),year=document.querySelector('#portfolioYear'),sort=document.querySelector('#portfolioSort'),count=document.querySelector('#portfolioCount'),pagination=document.querySelector('#portfolioPagination');
  const state={rows:[],page:1,pageSize:25};
  const bodyValue=(item,key)=>item.body&&typeof item.body==='object'?(item.body[key]||''):'';
  const draw=()=>{
    const q=search.value.trim().toLowerCase();
    let rows=state.rows.filter(item=>(!category.value||item.category===category.value)&&(!year.value||String(item.year)===year.value)&&(!q||`${item.title} ${item.client} ${item.category} ${bodyValue(item,'region')} ${bodyValue(item,'note')}`.toLowerCase().includes(q)));
    rows.sort((a,b)=>{if(sort.value==='year-asc')return(+a.year||0)-(+b.year||0)||a.title.localeCompare(b.title,'ko');if(sort.value==='category')return(a.category||'').localeCompare(b.category||'','ko')||(+b.year||0)-(+a.year||0);if(sort.value==='title')return a.title.localeCompare(b.title,'ko');return(+b.year||0)-(+a.year||0)||a.title.localeCompare(b.title,'ko')});
    count.textContent=rows.length.toLocaleString('ko-KR');
    const pages=Math.max(1,Math.ceil(rows.length/state.pageSize));state.page=Math.min(state.page,pages);
    const visible=rows.slice((state.page-1)*state.pageSize,state.page*state.pageSize);
    target.innerHTML=visible.length?visible.map(item=>{const extra=[bodyValue(item,'region'),bodyValue(item,'diagnosis_grade'),bodyValue(item,'note')].filter(Boolean).join(' · ');return `<tr><td data-label="연도"><strong>${escapeHTML(item.year||'-')}</strong></td><td data-label="사업 분야"><span class="portfolio-category">${escapeHTML(item.category||'-')}</span></td><td data-label="용역명"><strong class="portfolio-project">${escapeHTML(item.title)}</strong>${item.summary?`<small>${escapeHTML(item.summary)}</small>`:''}${renderAttachmentLinks(item)}</td><td data-label="발주기관">${escapeHTML(item.client||'-')}</td><td data-label="지역·비고">${escapeHTML(extra||'-')}</td></tr>`}).join(''):'<tr><td colspan="5" class="empty">조건에 맞는 실적이 없습니다.</td></tr>';
    const from=Math.max(1,Math.min(state.page-2,pages-4)),to=Math.min(pages,from+4);let buttons=`<button type="button" data-page="${state.page-1}" ${state.page===1?'disabled':''}>이전</button>`;for(let p=from;p<=to;p++)buttons+=`<button type="button" data-page="${p}" class="${p===state.page?'active':''}">${p}</button>`;buttons+=`<button type="button" data-page="${state.page+1}" ${state.page===pages?'disabled':''}>다음</button>`;pagination.innerHTML=buttons;
  };
  try{
    state.rows=await requestContent('portfolio');
    [...new Set(state.rows.map(x=>x.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko')).forEach(x=>category.insertAdjacentHTML('beforeend',`<option value="${escapeHTML(x)}">${escapeHTML(x)}</option>`));
    [...new Set(state.rows.map(x=>String(x.year)).filter(Boolean))].sort((a,b)=>+b-+a).forEach(x=>year.insertAdjacentHTML('beforeend',`<option value="${escapeHTML(x)}">${escapeHTML(x)}년</option>`));draw();
  }catch(error){target.innerHTML='<tr><td colspan="5" class="empty">실적 자료를 불러오지 못했습니다.</td></tr>'}
  [search,category,year,sort].forEach(control=>control.addEventListener(control===search?'input':'change',()=>{state.page=1;draw()}));
  pagination.addEventListener('click',event=>{const button=event.target.closest('[data-page]');if(!button||button.disabled)return;state.page=+button.dataset.page;draw();document.querySelector('.portfolio-toolbar')?.scrollIntoView({behavior:'smooth',block:'start'})});
  document.querySelector('#portfolioReset')?.addEventListener('click',()=>{search.value='';category.value='';year.value='';sort.value='year-desc';state.page=1;draw()});
}

async function renderMainBusinesses(target,limit=3){
  try{
    const rows=(await requestContent('business')).slice(0,limit);
    const fallback=[
      'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=900&q=84',
      'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=900&q=84',
      'https://images.unsplash.com/photo-1531053326607-9d349096d887?auto=format&fit=crop&w=900&q=84'
    ];
    const emptyVisuals=['linear-gradient(135deg,#31546a,#132c3a)','linear-gradient(135deg,#3d5060,#172a35)','linear-gradient(135deg,#385d65,#19343a)'];
    target.innerHTML=rows.map((item,index)=>{
      const cover=(item.media||[]).filter(media=>media.section==='gallery').sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))[0];
      const managed=item.body?.media_sections_managed?.includes('gallery');
      const visual=cover?`url("${mediaURL(cover.url).replace(/"/g,'%22')}")`:managed?emptyVisuals[index%emptyVisuals.length]:`url("${fallback[index%fallback.length]}")`;
      return `<a class="card" href="business.html?section=${encodeURIComponent(item.slug)}" style="--image:${escapeHTML(visual)}"><small>${String(index+1).padStart(2,'0')} / ENGINEERING</small><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.summary)}</p></a>`
    }).join('');
  }catch(error){showAPIError(target,'사업분야 준비 중입니다.')}
}

async function hydrateHomePage(){
  try{
    const [item]=await requestContent('about');if(!item)return;
    const body=item.body||{};
    const fields={
      'home-hero-kicker':body.home_hero_kicker,
      'home-hero-title':body.home_hero_title,
      'home-hero-emphasis':body.home_hero_emphasis,
      'home-hero-summary':body.home_hero_summary,
      'home-intro-summary':body.home_intro_summary
    };
    Object.entries(fields).forEach(([name,value])=>{const node=document.querySelector(`[data-${name}]`);if(node&&value)node.textContent=value});
    const introTitle=document.querySelector('[data-home-intro-title]');
    if(introTitle&&body.home_intro_title)introTitle.innerHTML=escapeHTML(body.home_intro_title).replace(/\n/g,'<br>');

    const mediaBySection=(item.media||[]).reduce((all,media)=>((all[media.section]||=[]).push(media),all),{});
    Object.values(mediaBySection).forEach(media=>media.sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)));
    const managed=new Set(body.media_sections_managed||[]);
    const hero=document.querySelector('[data-home-media="home_hero"]'),heroMedia=mediaBySection.home_hero?.[0];
    if(heroMedia)hero?.style.setProperty('--hero-image',`url("${mediaURL(heroMedia.url).replace(/"/g,'%22')}")`);
    else if(managed.has('home_hero'))hero?.style.setProperty('--hero-image','linear-gradient(135deg,#0b2839,#173f54)');

    const intro=document.querySelector('[data-home-media="home_intro"]'),introGrid=document.querySelector('[data-home-intro-grid]'),introMedia=mediaBySection.home_intro?.[0];
    if(introMedia&&intro){intro.hidden=false;intro.src=mediaURL(introMedia.url);intro.alt=introMedia.alt||intro.alt;introGrid?.classList.remove('no-image')}
    else if(managed.has('home_intro')&&intro){intro.hidden=true;introGrid?.classList.add('no-image')}
  }catch(error){console.warn('Home API unavailable',error)}
}

async function hydrateAboutPage(){
  try{
    const [item]=await requestContent('about'); if(!item) return;
    const body=item.body||{};
    const title=document.querySelector('[data-about-title]'); if(title&&body.greeting_title) title.textContent=body.greeting_title;
    const paragraphs=document.querySelector('[data-about-paragraphs]'); if(paragraphs&&Array.isArray(body.greeting_paragraphs)) paragraphs.innerHTML=body.greeting_paragraphs.map(text=>`<p>${escapeHTML(text)}</p>`).join('');
    const ceo=document.querySelector('[data-about-ceo]'); if(ceo&&body.ceo) ceo.textContent=body.ceo;
    // The administrator publishes company facts through repository-managed content.
    const facts={founded:body.founded,capital:body.capital,address:body.address};
    Object.entries(facts).forEach(([key,value])=>{const node=document.querySelector(`[data-about-${key}]`);if(node&&value)node.textContent=value});
    const grouped=Object.groupBy?Object.groupBy(item.media||[],x=>x.section):(item.media||[]).reduce((all,x)=>((all[x.section]||=[]).push(x),all),{});
    (body.media_sections_managed||[]).forEach(section=>{
      if(grouped[section]?.length)return;
      const node=document.querySelector(`[data-about-media="${section}"]`);if(!node)return;
      if(node.tagName==='IMG')node.hidden=true;else node.innerHTML='';
    });
    Object.entries(grouped).forEach(([section,media])=>{
      const node=document.querySelector(`[data-about-media="${section}"]`);if(!node||!media.length)return;
      media.sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
      if(node.tagName==='IMG'){
        node.hidden=false;node.src=mediaURL(media[0].url);node.alt=media[0].alt||node.alt;return;
      }
      node.innerHTML=media.map(image=>`<div class="image-card"><img src="${mediaURL(image.url)}" alt="${escapeHTML(image.alt)}"></div>`).join('');
    });
  }catch(error){console.warn('About API unavailable',error)}
}

async function hydrateBusinessPage(){
  try{
    const rows=await requestContent('business');
    const slugs=new Set(rows.map(item=>item.slug));
    document.querySelectorAll('.business-tab').forEach(tab=>{if(!slugs.has(tab.dataset.target)){document.getElementById(tab.dataset.target)?.remove();tab.remove()}});
    rows.forEach((item,index)=>{
      if(!document.getElementById(item.slug)){
        const panel=document.createElement('section');panel.id=item.slug;panel.className='business-panel';panel.innerHTML='<div class="business-panel-head"><div class="number"></div><div><h2></h2><p></p></div></div>';
        (document.querySelector('.business-panel')?.parentElement||document.querySelector('main .container')).append(panel);
        const button=document.createElement('button');button.className='business-tab';button.dataset.target=item.slug;button.innerHTML='<small></small><strong></strong>';button.addEventListener('click',()=>{document.querySelectorAll('.business-tab').forEach(t=>t.classList.toggle('active',t===button));document.querySelectorAll('.business-panel').forEach(p=>p.classList.toggle('active',p===panel))});document.querySelector('.business-tabs')?.append(button);
      }
      const tab=document.querySelector(`.business-tab[data-target="${CSS.escape(item.slug)}"]`);
      const panel=document.getElementById(item.slug);
      if(tab){tab.querySelector('small').textContent=`${String(index+1).padStart(2,'0')} / ENGINEERING`;tab.querySelector('strong').textContent=item.title}
      if(!panel)return;
      const heading=panel.querySelector('h2');if(heading)heading.textContent=item.title;
      const summary=panel.querySelector('.business-panel-head p');if(summary&&item.summary)summary.textContent=item.summary;
      const content=plainText(item.body);
      if(content){let managed=panel.querySelector('.managed-content');if(!managed){managed=document.createElement('div');managed.className='managed-content';panel.append(managed)}managed.innerHTML=escapeHTML(content).replace(/\n/g,'<br>')}
      const managedGallery=item.body?.media_sections_managed?.includes('gallery');
      if(managedGallery)panel.querySelectorAll('.business-images').forEach(gallery=>gallery.remove());
      if(item.media?.length){let gallery=panel.querySelector('.managed-gallery');if(!gallery){gallery=document.createElement('div');gallery.className='business-images managed-gallery';panel.append(gallery)}gallery.innerHTML=item.media.sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map(image=>`<img src="${mediaURL(image.url)}" alt="${escapeHTML(image.alt)}">`).join('')}
    });
    const preferred=new URLSearchParams(location.search).get('section');
    const first=(preferred&&slugs.has(preferred)?document.getElementById(preferred):document.querySelector('.business-panel.active'))||document.querySelector('.business-panel');
    if(first){document.querySelectorAll('.business-panel').forEach(p=>p.classList.toggle('active',p===first));document.querySelectorAll('.business-tab').forEach(t=>t.classList.toggle('active',t.dataset.target===first.id))}
  }catch(error){console.warn('Business API unavailable',error)}
}
