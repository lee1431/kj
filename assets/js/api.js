const API_BASE='https://mrdindoin.ddns.net/kij/api';

async function request(path){
  const response=await fetch(`${API_BASE}${path}`);
  if(!response.ok) throw new Error(`API ${response.status}`);
  return response.json();
}

async function renderNotices(target,limit){
  try{
    const rows=await request('/notices');
    const items=limit?rows.slice(0,limit):rows;
    target.innerHTML=items.length?items.map((item,index)=>`<article><span>${String(index+1).padStart(2,'0')}</span><strong>${item.title}</strong><time>${item.created_at||''}</time></article>`).join(''):'<div class="empty">등록된 공지사항이 없습니다.</div>';
  }catch(error){target.innerHTML='<div class="empty">공지사항 준비 중입니다.</div>'}
}

async function renderProjects(target){
  try{
    const rows=await request('/projects');
    target.innerHTML=rows.length?rows.map(item=>`<article><span class="eyebrow">Project</span><h3>${item.title}</h3><p>${item.description||''}</p></article>`).join(''):'<div class="empty">등록된 실적이 없습니다.</div>';
  }catch(error){target.innerHTML='<div class="empty">실적 자료 준비 중입니다.</div>'}
}

async function renderOrganization(target){
  try{
    const data=await request('/organization');
    target.innerHTML=data.image_url?`<img src="${data.image_url}" alt="기장엔지니어링 조직도">`:'<div class="empty">조직도 준비 중입니다.</div>';
  }catch(error){target.innerHTML='<div class="empty">조직도 준비 중입니다.</div>'}
}
