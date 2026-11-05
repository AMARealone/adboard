/* Protection des créatives (page de vente, études de cas, blog, offres…) : pas de clic droit « enregistrer l'image / la vidéo »,
   pas de glisser-déposer, pas d'appui long iOS/Android, pas de bouton télécharger ni d'image dans l'image sur les vidéos.
   Limite honnête : une capture d'écran ou les outils du navigateur restent possibles. Ce script supprime seulement les gestes simples. */
(function(){
  var css=document.createElement('style');
  css.textContent='img,video,picture,canvas{-webkit-user-drag:none;user-drag:none;-webkit-touch-callout:none}img,video{-webkit-user-select:none;user-select:none}';
  (document.head||document.documentElement).appendChild(css);
  function media(t){return t&&t.closest&&t.closest('img,video,picture,canvas,.exemple-card,.edc-vis,.idx-v,.gal,.win,.prods,.cvr-item-img,.pr-visual');}
  document.addEventListener('contextmenu',function(e){if(media(e.target))e.preventDefault();},true);
  document.addEventListener('dragstart',function(e){if(e.target&&(e.target.tagName==='IMG'||e.target.tagName==='VIDEO'))e.preventDefault();},true);
  function lock(root){
    (root.querySelectorAll?root.querySelectorAll('img'):[]).forEach(function(i){i.setAttribute('draggable','false');});
    (root.querySelectorAll?root.querySelectorAll('video'):[]).forEach(function(v){v.setAttribute('controlsList','nodownload noremoteplayback noplaybackrate');v.disablePictureInPicture=true;v.setAttribute('disablePictureInPicture','');v.removeAttribute('controls');});
  }
  function start(){lock(document);try{new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeType===1){if(n.tagName==='IMG'||n.tagName==='VIDEO')lock({querySelectorAll:function(s){return n.matches(s)?[n]:[];}});lock(n);}});});}).observe(document.body,{childList:true,subtree:true});}catch(x){}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
