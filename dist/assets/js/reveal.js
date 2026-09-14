
    (function(){
      var sections=Array.prototype.slice.call(document.querySelectorAll("[data-searchable]"));
      var reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.body.classList.add("motion-ready");
      if(reducedMotion||!("IntersectionObserver" in window)){sections.forEach(function(section){section.classList.add("is-visible");});}else{
        var revealObserver=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){entry.target.classList.add("is-visible");revealObserver.unobserve(entry.target);}});},{threshold:.06,rootMargin:"0px 0px -8% 0px"});
        sections.forEach(function(section){revealObserver.observe(section);});
      }

    }());
