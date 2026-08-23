const KIJ_API_ROOT='https://mrdindoin.ddns.net/kij/';
const KIJ_API=`${KIJ_API_ROOT}api/content`;

const escapeHTML=(value='')=>String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const mediaURL=(value='')=>new URL(value.replace(/^\//,''),KIJ_API_ROOT).href;
const plainText=body=>typeof body==='string'?body:(body?.content||'');

async function requestContent(type,slug=''){
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
      const image=item.media?.[0];
      return `<article class="content-row" data-content-detail>
        <span>${item.pinned?'공지':String(index+1).padStart(2,'0')}</span>
        <div><strong>${escapeHTML(item.title)}</strong>${item.summary?`<p>${escapeHTML(item.summary)}</p>`:''}${text||image?`<div class="content-detail">${escapeHTML(text).replace(/\n/g,'<br>')}${image?`<img src="${mediaURL(image.url)}" alt="${escapeHTML(image.alt)}">`:''}</div>`:''}</div>
        <time>${escapeHTML(date)}</time>
      </article>`;
    }).join(''):'<div class="empty">등록된 공지사항이 없습니다.</div>';
    target.querySelectorAll('[data-content-detail]').forEach(row=>row.addEventListener('click',()=>row.classList.toggle('open')));
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
        <p>${escapeHTML(item.summary||plainText(item.body))}</p><dl>${item.client?`<div><dt>CLIENT</dt><dd>${escapeHTML(item.client)}</dd></div>`:''}${item.year?`<div><dt>YEAR</dt><dd>${escapeHTML(item.year)}</dd></div>`:''}</dl></div>
      </article>`;
    }).join(''):'<div class="empty">등록된 실적이 없습니다.</div>';
  }catch(error){showAPIError(target,'실적 자료 준비 중입니다.')}
}

async function renderMainBusinesses(target,limit=3){
  try{
    const rows=(await requestContent('business')).slice(0,limit);
    const fallback=[
      'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=900&q=84',
      'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=900&q=84',
      'https://images.unsplash.com/photo-1531053326607-9d349096d887?auto=format&fit=crop&w=900&q=84'
    ];
    target.innerHTML=rows.map((item,index)=>{const cover=item.media?.[0];return `<a class="card" href="business.html?section=${encodeURIComponent(item.slug)}" style="--image:url('${cover?mediaURL(cover.url):fallback[index%fallback.length]}')"><small>${String(index+1).padStart(2,'0')} / ENGINEERING</small><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.summary)}</p></a>`}).join('');
  }catch(error){showAPIError(target,'사업분야 준비 중입니다.')}
}

async function hydrateAboutPage(){
  try{
    const [item]=await requestContent('about'); if(!item) return;
    const body=item.body||{};
    const title=document.querySelector('[data-about-title]'); if(title&&body.greeting_title) title.textContent=body.greeting_title;
    const paragraphs=document.querySelector('[data-about-paragraphs]'); if(paragraphs&&Array.isArray(body.greeting_paragraphs)) paragraphs.innerHTML=body.greeting_paragraphs.map(text=>`<p>${escapeHTML(text)}</p>`).join('');
    const ceo=document.querySelector('[data-about-ceo]'); if(ceo&&body.ceo) ceo.textContent=body.ceo;
    const facts={founded:body.founded,capital:body.capital,address:body.address};
    Object.entries(facts).forEach(([key,value])=>{const node=document.querySelector(`[data-about-${key}]`);if(node&&value)node.textContent=value});
    const grouped=Object.groupBy?Object.groupBy(item.media||[],x=>x.section):(item.media||[]).reduce((all,x)=>((all[x.section]||=[]).push(x),all),{});
    Object.entries(grouped).forEach(([section,media])=>{
      const fallbackSelector={organization:'#organization .image-card',people:'#people .image-grid',licenses:'#licenses .image-grid',equipment:'#equipment .image-grid',location_desktop:'#location',location_mobile:'#location'}[section];
      const node=document.querySelector(`[data-about-media="${section}"]`)||document.querySelector(fallbackSelector); if(!node||!media.length)return;
      node.innerHTML=media.map(image=>`<div class="image-card"><img src="${mediaURL(image.url)}" alt="${escapeHTML(image.alt)}"></div>`).join('');
    });
  }catch(error){console.warn('About API unavailable',error)}
}

async function hydrateBusinessPage(){
  try{
    const rows=await requestContent('business');
    rows.forEach((item,index)=>{
      const tab=document.querySelector(`.business-tab[data-target="${CSS.escape(item.slug)}"]`);
      const panel=document.getElementById(item.slug);
      if(tab){tab.querySelector('small').textContent=`${String(index+1).padStart(2,'0')} / ENGINEERING`;tab.querySelector('strong').textContent=item.title}
      if(!panel)return;
      const heading=panel.querySelector('h2');if(heading)heading.textContent=item.title;
      const summary=panel.querySelector('.business-panel-head p');if(summary&&item.summary)summary.textContent=item.summary;
      const content=plainText(item.body);
      if(content){let managed=panel.querySelector('.managed-content');if(!managed){managed=document.createElement('div');managed.className='managed-content';panel.append(managed)}managed.innerHTML=escapeHTML(content).replace(/\n/g,'<br>')}
      if(item.media?.length){let gallery=panel.querySelector('.managed-gallery');if(!gallery){gallery=document.createElement('div');gallery.className='business-images managed-gallery';panel.append(gallery)}gallery.innerHTML=item.media.map(image=>`<img src="${mediaURL(image.url)}" alt="${escapeHTML(image.alt)}">`).join('')}
    });
  }catch(error){console.warn('Business API unavailable',error)}
}
