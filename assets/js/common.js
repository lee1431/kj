document.querySelectorAll('.menu').forEach((button)=>{
  button.addEventListener('click',()=>{
    const nav=document.querySelector('.nav-links');
    const open=nav.classList.toggle('open');
    button.setAttribute('aria-expanded',String(open));
    button.textContent=open?'×':'☰';
  });
});

// Keep the sticky in-page tabs synchronized with the section currently in view.
document.querySelectorAll('.page-tabs').forEach((tabBar)=>{
  const links=[...tabBar.querySelectorAll('a[href^="#"]')];
  const entries=links
    .map((link)=>({link,section:document.querySelector(link.hash)}))
    .filter(({section})=>section);

  if(!entries.length) return;

  const activate=(activeLink)=>{
    links.forEach((link)=>{
      const active=link===activeLink;
      link.classList.toggle('active',active);
      if(active) link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    });
  };

  const syncTabs=()=>{
    const header=document.querySelector('.site-header');
    const marker=window.scrollY+(header?.offsetHeight||0)+tabBar.offsetHeight+32;
    let current=entries[0];

    entries.forEach((entry)=>{
      if(entry.section.offsetTop<=marker) current=entry;
    });

    activate(current.link);
  };

  let scheduled=false;
  const scheduleSync=()=>{
    if(scheduled) return;
    scheduled=true;
    requestAnimationFrame(()=>{syncTabs();scheduled=false});
  };

  links.forEach((link)=>link.addEventListener('click',()=>activate(link)));
  window.addEventListener('scroll',scheduleSync,{passive:true});
  window.addEventListener('resize',scheduleSync);
  window.addEventListener('hashchange',scheduleSync);
  syncTabs();
});
