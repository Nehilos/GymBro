
    (function(){
      try{
        var t=localStorage.getItem('thalys_theme')==='light'?'light':'dark';
        document.documentElement.dataset.thalysTheme=t;
        document.documentElement.style.colorScheme=t;
      }catch(_){}
    })();
  