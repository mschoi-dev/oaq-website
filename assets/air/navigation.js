(()=>{'use strict';
const header=document.querySelector('header.nav'),button=header?.querySelector('.site-menu-toggle'),menu=header?.querySelector('nav.menu');
if(!button||!menu)return;
function setOpen(open){header.dataset.open=String(open);button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Close navigation':'Open navigation');}
button.addEventListener('click',()=>setOpen(header.dataset.open!=='true'));
menu.addEventListener('click',e=>{if(e.target.closest('a'))setOpen(false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&header.dataset.open==='true'){setOpen(false);button.focus();}});
document.addEventListener('click',e=>{if(!header.contains(e.target))setOpen(false);});
header.addEventListener('focusout',()=>requestAnimationFrame(()=>{if(!header.contains(document.activeElement))setOpen(false);}));
matchMedia('(min-width:761px)').addEventListener('change',e=>{if(e.matches)setOpen(false);});
setOpen(false);
})();
