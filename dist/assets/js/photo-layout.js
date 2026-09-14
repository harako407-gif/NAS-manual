(function(){
  const grids=Array.from(document.querySelectorAll('.steps'));
  let pending=0;
  function align(){
    pending=0;
    const groups=grids.map(grid=>({grid,cards:Array.from(grid.children).filter(el=>el.classList.contains('step-card'))}));
    groups.forEach(({cards})=>cards.forEach(card=>card.querySelector('.card-intro').style.minHeight='0px'));
    const sizes=[];
    groups.forEach(({grid,cards})=>{
      const columns=getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length;
      for(let i=0;i<cards.length;i+=Math.max(1,columns)){
        const row=cards.slice(i,i+Math.max(1,columns)).map(card=>card.querySelector('.card-intro'));
        const height=Math.ceil(Math.max(...row.map(el=>el.getBoundingClientRect().height)));
        sizes.push({row,height});
      }
    });
    sizes.forEach(({row,height})=>row.forEach(el=>el.style.minHeight=height+'px'));
  }
  function schedule(){if(!pending)pending=requestAnimationFrame(align);}
  window.addEventListener('resize',schedule);
  window.addEventListener('load',schedule);
  window.addEventListener('afterprint',schedule);
  if(document.fonts)document.fonts.ready.then(schedule);
  if(window.ResizeObserver){
    const widths=new WeakMap();
    const observer=new ResizeObserver(entries=>{
      let changed=false;
      entries.forEach(entry=>{const width=entry.contentRect.width;if(widths.get(entry.target)!==width){widths.set(entry.target,width);changed=true;}});
      if(changed)schedule();
    });
    grids.forEach(grid=>observer.observe(grid));
  }
  align();
})();
