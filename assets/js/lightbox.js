(function(){
      var box=document.getElementById("lightbox");var full=document.getElementById("lightboxImage");var close=document.getElementById("closeLightbox");
      document.querySelectorAll(".zoom-button").forEach(function(button){button.addEventListener("click",function(){var image=button.querySelector("img");full.src=image.dataset.gifSource||image.src;full.alt=image.alt;box.classList.add("open");close.focus();});});
      function closeBox(){box.classList.remove("open");full.src="";}
      close.addEventListener("click",closeBox);box.addEventListener("click",function(event){if(event.target===box)closeBox();});document.addEventListener("keydown",function(event){if(event.key==="Escape")closeBox();});
    }());
