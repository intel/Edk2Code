$(document).ready(function() {

    function checkHidePanel() {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('hidepanel') === 'TRUE') {
        document.querySelector('.wy-nav-side').style.display = 'none';
        document.querySelector('.rst-content').style.display = 'block';
      }
    }

    checkHidePanel();    

    // Section copy button
    var headers = document.querySelectorAll('h1, h2, h3, h4');
    headers.forEach(function(header) {
        header.classList.add('header-link'); // Add this line to add a class
        var copyButton = '<span class="btn-clipboard-link codicon codicon-link" title="Copy to clipboard"></span>';
        console.log("copied");
        header.insertAdjacentHTML('beforeend', copyButton);
      });

    var clipboardLink = new ClipboardJS('.btn-clipboard-link', {
      text: function (trigger) {
        var url = window.location.href.split("#")[0] + '#' + trigger.parentElement.id;
        return url;
      }
    });

    clipboardLink.on('success', function (e) {
      e.clearSelection();
  
      // https://atomiks.github.io/tippyjs/v6/all-props/
      var tippyInstance = tippy(
        e.trigger,
        {
          content: 'Copied',
          showOnCreate: true,
          trigger: 'manual',
        },
      );
      setTimeout(function() { tippyInstance.hide(); }, 1000);
    });

    // https://clipboardjs.com/
    var selectors = document.querySelectorAll('pre code');
    var copyButton = '<div class="clipboard"><span class="btn-clipboard codicon codicon-copy" title="Copy to clipboard"></div>';
    Array.prototype.forEach.call(selectors, function(selector){
      selector.insertAdjacentHTML('beforebegin', copyButton);
    });
    var clipboard = new ClipboardJS('.btn-clipboard', {
      target: function (trigger) {
        return trigger.parentNode.nextElementSibling;
      }
    });
  
    clipboard.on('success', function (e) {
      e.clearSelection();
  
      // https://atomiks.github.io/tippyjs/v6/all-props/
      var tippyInstance = tippy(
        e.trigger,
        {
          content: 'Copied',
          showOnCreate: true,
          trigger: 'manual',
        },
      );
      setTimeout(function() { tippyInstance.hide(); }, 1000);
    });
  });