function scrolldown() {
  scroller = document.getElementById("scroller");
  scroller.scrollTop = scroller.scrollHeight;
}

window.onload = function(){scrolldown();};

