/*!
  Tinycon - A small library for manipulating the Favicon
  Tom Moor, http://tommoor.com
  Copyright (c) 2012 Tom Moor
  MIT Licensed
  @version 0.5
*/
(function(){var Tinycon={};var currentFavicon=null;var originalFavicon=null;var originalTitle=document.title;var faviconImage=null;var canvas=null;var options={};var defaults={width:7,height:9,font:'10px arial',colour:'#ffffff',background:'#F03D25',fallback:true,abbreviate:true};var ua=(function(){var agent=navigator.userAgent.toLowerCase();return function(browser){return agent.indexOf(browser)!==-1}}());var browser={ie:ua('msie'),chrome:ua('chrome'),webkit:ua('chrome')||ua('safari'),safari:ua('safari')&&!ua('chrome'),mozilla:ua('mozilla')&&!ua('chrome')&&!ua('safari')};var getFaviconTag=function(){var links=document.getElementsByTagName('link');for(var i=0,len=links.length;i<len;i++){if((links[i].getAttribute('rel')||'').match(/\bicon\b/)){return links[i]}}return false};var removeFaviconTag=function(){var links=document.getElementsByTagName('link');var head=document.getElementsByTagName('head')[0];for(var i=0,len=links.length;i<len;i++){var exists=(typeof(links[i])!=='undefined');if(exists&&(links[i].getAttribute('rel')||'').match(/\bicon\b/)){head.removeChild(links[i])}}};var getCurrentFavicon=function(){if(!originalFavicon||!currentFavicon){var tag=getFaviconTag();originalFavicon=currentFavicon=tag?tag.getAttribute('href'):'/favicon.ico'}return currentFavicon};var getCanvas=function(){if(!canvas){canvas=document.createElement("canvas");canvas.width=16;canvas.height=16}return canvas};var setFaviconTag=function(url){removeFaviconTag();var link=document.createElement('link');link.type='image/x-icon';link.rel='icon';link.href=url;document.getElementsByTagName('head')[0].appendChild(link)};var log=function(message){if(window.console)window.console.log(message)};var drawFavicon=function(label,colour){if(!getCanvas().getContext||browser.ie||browser.safari||options.fallback==='force'){return updateTitle(label)}var context=getCanvas().getContext("2d");var colour=colour||'#000000';var src=getCurrentFavicon();faviconImage=new Image();faviconImage.onload=function(){context.clearRect(0,0,16,16);context.drawImage(faviconImage,0,0,faviconImage.width,faviconImage.height,0,0,16,16);if((label+'').length>0)drawBubble(context,label,colour);refreshFavicon()};if(!src.match(/^data/)){faviconImage.crossOrigin='anonymous'}faviconImage.src=src};var updateTitle=function(label){if(options.fallback){if((label+'').length>0){document.title='('+label+') '+originalTitle}else{document.title=originalTitle}}};var drawBubble=function(context,label,colour){if(typeof label=='number'&&label>99&&options.abbreviate){label=abbreviateNumber(label)}var len=(label+'').length-1;var width=options.width+(6*len);var w=16-width;var h=16-options.height;context.font=(browser.webkit?'bold ':'')+options.font;context.fillStyle=options.background;context.strokeStyle=options.background;context.lineWidth=1;context.fillRect(w,h,width-1,options.height);context.beginPath();context.moveTo(w-0.5,h+1);context.lineTo(w-0.5,15);context.stroke();context.beginPath();context.moveTo(15.5,h+1);context.lineTo(15.5,15);context.stroke();context.beginPath();context.strokeStyle="rgba(0,0,0,0.3)";context.moveTo(w,16);context.lineTo(15,16);context.stroke();context.fillStyle=options.colour;context.textAlign="right";context.textBaseline="top";context.fillText(label,15,browser.mozilla?7:6)};var refreshFavicon=function(){if(!getCanvas().getContext)return;setFaviconTag(getCanvas().toDataURL())};var abbreviateNumber=function(label){var metricPrefixes=[['G',1000000000],['M',1000000],['k',1000]];for(var i=0;i<metricPrefixes.length;++i){if(label>=metricPrefixes[i][1]){label=round(label/metricPrefixes[i][1])+metricPrefixes[i][0];break}}return label};var round=function(value,precision){var number=new Number(value);return number.toFixed(precision)};Tinycon.setOptions=function(custom){options={};for(var key in defaults){options[key]=custom.hasOwnProperty(key)?custom[key]:defaults[key]}return this};Tinycon.setImage=function(url){currentFavicon=url;refreshFavicon();return this};Tinycon.setBubble=function(label,colour){label=label||'';drawFavicon(label,colour);return this};Tinycon.reset=function(){setFaviconTag(originalFavicon)};Tinycon.setOptions(defaults);window.Tinycon=Tinycon})();
;
(function ($) {

  Drupal.behaviors.environment_indicatorToolbar = {
    attach: function (context, settings) {
      if (typeof(settings.environment_indicator) != 'undefined' && typeof(settings.environment_indicator['toolbar-color']) != 'undefined') {
        var environment_name = settings.environment_indicator['environment-indicator-name'],
          environment_color = settings.environment_indicator['toolbar-color'],
          environment_text_color = settings.environment_indicator['toolbar-text-color'],
          $name = $('<div>').addClass('environment-indicator-name-wrapper').html(environment_name),
          $toolbar = $('#toolbar, #navbar-bar', context);
        $('div.toolbar-menu', $toolbar).once('environment_indicator').prepend($name);
        $('div.toolbar-menu', $toolbar).css('background-color', environment_color);
        $('div.toolbar-menu .item-list', $toolbar).css('background-color', changeColor(environment_color, 0.15, true));
        $('div.toolbar-menu ul li:not(.environment-switcher) a', $toolbar).css('background-color', environment_color).css('color', environment_text_color);
        $('div.toolbar-drawer', $toolbar).css('background-color', changeColor(environment_color, 0.25)).find('ul li a').css('color', changeColor(environment_text_color, 0.25));
        $('div.toolbar-menu ul li a', $toolbar).hover(function () {
          $(this).css('background-color', changeColor(environment_color, 0.1)).css('color', changeColor(environment_text_color, 0.1));
        }, function () {
          $(this).css('background-color', environment_color).css('color', environment_text_color);
          $('div.toolbar-menu ul li.active-trail a', $toolbar).css('background-color', changeColor(environment_color, 0.1)).css('color', changeColor(environment_text_color, 0.1));
        });
        $('div.toolbar-menu ul li.active-trail a', $toolbar).css('background-image', 'none').css('background-color', changeColor(environment_color, 0.1)).css('color', changeColor(environment_text_color, 0.1));
        $('div.toolbar-drawer ul li a', $toolbar).hover(function () {
          $(this).css('background-color', changeColor(environment_color, 0.1, true)).css('color', changeColor(environment_text_color, 0.1, true));
        }, function () {
          $(this).css('background-color', changeColor(environment_color, 0.25)).css('color', changeColor(environment_text_color, 0.25));
          $('div.toolbar-drawer ul li.active-trail a', $toolbar).css('background-color', changeColor(environment_color, 0.1, true)).css('color', changeColor(environment_text_color, 0.1, true));
        });
        $('div.toolbar-drawer ul li.active-trail a', $toolbar).css('background-image', 'none').css('background-color', changeColor(environment_color, 0.1, true)).css('color', changeColor(environment_text_color, 0.1, true));
        // Move switcher bar to the top
        var $switcher_container = $('.environment-switcher-container', $toolbar);
        var $switcher = $switcher_container.parent().clone();
        $switcher_container.parent().remove();
        $toolbar.prepend($switcher);
        // Add a margin if the Shortcut module toggle button is present.
        if ($('div.toolbar-menu a.toggle', $toolbar).length > 0) {
          $('div.toolbar-menu', $toolbar).css('padding-right', 40);
        }
      };
    }
  };

  Drupal.behaviors.environment_indicatorTinycon = {
    attach: function (context, settings) {
      if (typeof(settings.environment_indicator) != 'undefined' &&
          typeof(settings.environment_indicator.addFavicon) != 'undefined' &&
          settings.environment_indicator.addFavicon) {
        //Draw favicon label
        Tinycon.setBubble(settings.environment_indicator.faviconLabel);
        Tinycon.setOptions({
          background: settings.environment_indicator.faviconColor,
          colour: settings.environment_indicator.faviconTextColor
        });
      }
    }
  }

  Drupal.behaviors.environment_indicatorAdminMenu = {
    attach: function (context, settings) {
      if (typeof(Drupal.admin) != 'undefined' && typeof(settings.environment_indicator) != 'undefined' && typeof(settings.environment_indicator['toolbar-color']) != 'undefined') {
        // Add the restyling behavior to the admin menu behaviors.
        Drupal.admin.behaviors['environment_indicator'] = function (context, settings) {
          $('#admin-menu, #admin-menu-wrapper', context).css('background-color', settings.environment_indicator['toolbar-color']);
          $('#admin-menu, #admin-menu-wrapper > ul > li:not(.admin-menu-account) > a', context).css('color', settings.environment_indicator['toolbar-text-color']);
          $('#admin-menu .item-list', context).css('background-color', changeColor(settings.environment_indicator['toolbar-color'], 0.15, true));
          $('#admin-menu .item-list ul li:not(.environment-switcher) a', context).css('background-color', settings.environment_indicator['toolbar-color']).css('color', settings.environment_indicator['toolbar-text-color']);
        };
      };
    }
  };

  Drupal.behaviors.environment_indicatorNavbar = {
    attach: function (context, settings) {
      if (typeof(settings.navbar) != 'undefined' && typeof(settings.environment_indicator) != 'undefined' && typeof(settings.environment_indicator['toolbar-color']) != 'undefined') {
        $('#navbar-administration .navbar-bar', context).css('background-color', settings.environment_indicator['toolbar-color']);
        $('#navbar-administration .navbar-tab *:not(select)', context).css('color', settings.environment_indicator['toolbar-text-color']);
      }
    }
  };

  Drupal.behaviors.environment_indicatorSwitcher = {
    attach: function (context, settings) {
      // Check that the links actually point to the current path, if not, fix them
      $('.environment-switcher a', context).click(function (e) {
        e.preventDefault();
        var current_location = window.location;
        window.location.href = current_location.protocol + '//' + e.currentTarget.host + current_location.pathname + current_location.search + current_location.hash;
      });
      $('#environment-indicator .environment-indicator-name, #toolbar .environment-indicator-name-wrapper, #navbar-bar .environment-indicator-name-wrapper', context).click(function () {
        $('#environment-indicator .item-list, #toolbar .item-list, #navbar-bar .item-list', context).slideToggle('fast');
      });
      $('#environment-indicator.position-top.fixed-yes').once('environment_indicator_top', function () {
        $('body').css('margin-top', $('#environment-indicator.position-top.fixed-yes').height() + 'px');
      });
      $('#environment-indicator.position-bottom.fixed-yes').once('environment_indicator_bottom', function () {
        $('body').css('margin-bottom', $('#environment-indicator.position-bottom.fixed-yes').height() + 'px');
      });
    }
  }

  Drupal.behaviors.environment_indicator_admin = {
    attach: function(context, settings) {
      var $picker = $('#environment-indicator-color-picker');
      // Add the farbtastic tie-in
      if ($.isFunction($.farbtastic) && $picker.length > 0) {
        settings.environment_indicator_color_picker = $picker.farbtastic('#ctools-export-ui-edit-item-form #edit-color');
        settings.environment_indicator_text_color_picker = $('#environment-indicator-text-color-picker').farbtastic('#ctools-export-ui-edit-item-form #edit-text-color');
      }
    }
  }

})(jQuery);
;
var pad = function(num, totalChars) {
    var pad = '0';
    num = num + '';
    while (num.length < totalChars) {
        num = pad + num;
    }
    return num;
};

// Ratio is between 0 and 1
var changeColor = function(color, ratio, darker) {
    // Trim trailing/leading whitespace
    color = color.replace(/^\s*|\s*$/, '');

    // Expand three-digit hex
    color = color.replace(
        /^#?([a-f0-9])([a-f0-9])([a-f0-9])$/i,
        '#$1$1$2$2$3$3'
    );

    // Calculate ratio
    var difference = Math.round(ratio * 256) * (darker ? -1 : 1),
        // Determine if input is RGB(A)
        rgb = color.match(new RegExp('^rgba?\\(\\s*' +
            '(\\d|[1-9]\\d|1\\d{2}|2[0-4][0-9]|25[0-5])' +
            '\\s*,\\s*' +
            '(\\d|[1-9]\\d|1\\d{2}|2[0-4][0-9]|25[0-5])' +
            '\\s*,\\s*' +
            '(\\d|[1-9]\\d|1\\d{2}|2[0-4][0-9]|25[0-5])' +
            '(?:\\s*,\\s*' +
            '(0|1|0?\\.\\d+))?' +
            '\\s*\\)$'
        , 'i')),
        alpha = !!rgb && rgb[4] != null ? rgb[4] : null,

        // Convert hex to decimal
        decimal = !!rgb? [rgb[1], rgb[2], rgb[3]] : color.replace(
            /^#?([a-f0-9][a-f0-9])([a-f0-9][a-f0-9])([a-f0-9][a-f0-9])/i,
            function() {
                return parseInt(arguments[1], 16) + ',' +
                    parseInt(arguments[2], 16) + ',' +
                    parseInt(arguments[3], 16);
            }
        ).split(/,/),
        returnValue;

    // Return RGB(A)
    return !!rgb ?
        'rgb' + (alpha !== null ? 'a' : '') + '(' +
            Math[darker ? 'max' : 'min'](
                parseInt(decimal[0], 10) + difference, darker ? 0 : 255
            ) + ', ' +
            Math[darker ? 'max' : 'min'](
                parseInt(decimal[1], 10) + difference, darker ? 0 : 255
            ) + ', ' +
            Math[darker ? 'max' : 'min'](
                parseInt(decimal[2], 10) + difference, darker ? 0 : 255
            ) +
            (alpha !== null ? ', ' + alpha : '') +
            ')' :
        // Return hex
        [
            '#',
            pad(Math[darker ? 'max' : 'min'](
                parseInt(decimal[0], 10) + difference, darker ? 0 : 255
            ).toString(16), 2),
            pad(Math[darker ? 'max' : 'min'](
                parseInt(decimal[1], 10) + difference, darker ? 0 : 255
            ).toString(16), 2),
            pad(Math[darker ? 'max' : 'min'](
                parseInt(decimal[2], 10) + difference, darker ? 0 : 255
            ).toString(16), 2)
        ].join('');
};
var lighterColor = function(color, ratio) {
    return changeColor(color, ratio, false);
};
var darkerColor = function(color, ratio) {
    return changeColor(color, ratio, true);
};
;
/**
 * @file
 */

(function ($) {

Drupal.admin = Drupal.admin || {};
Drupal.admin.behaviors = Drupal.admin.behaviors || {};
Drupal.admin.hashes = Drupal.admin.hashes || {};

/**
 * Core behavior for Administration menu.
 *
 * Test whether there is an administration menu is in the output and execute all
 * registered behaviors.
 */
Drupal.behaviors.adminMenu = {
  attach: function (context, settings) {
    // Initialize settings.
    settings.admin_menu = $.extend({
      suppress: false,
      margin_top: false,
      position_fixed: false,
      tweak_modules: false,
      tweak_permissions: false,
      tweak_tabs: false,
      destination: '',
      basePath: settings.basePath,
      hash: 0,
      replacements: {}
    }, settings.admin_menu || {});
    // Check whether administration menu should be suppressed.
    if (settings.admin_menu.suppress) {
      return;
    }
    var $adminMenu = $('#admin-menu:not(.admin-menu-processed)', context);
    // Client-side caching; if administration menu is not in the output, it is
    // fetched from the server and cached in the browser.
    if (!$adminMenu.length && settings.admin_menu.hash) {
      Drupal.admin.getCache(settings.admin_menu.hash, function (response) {
          if (typeof response == 'string' && response.length > 0) {
            $('body', context).append(response);
          }
          var $adminMenu = $('#admin-menu:not(.admin-menu-processed)', context);
          // Apply our behaviors.
          Drupal.admin.attachBehaviors(context, settings, $adminMenu);
          // Allow resize event handlers to recalculate sizes/positions.
          $(window).triggerHandler('resize');
      });
    }
    // If the menu is in the output already, this means there is a new version.
    else {
      // Apply our behaviors.
      Drupal.admin.attachBehaviors(context, settings, $adminMenu);
    }
  }
};

/**
 * Collapse fieldsets on Modules page.
 */
Drupal.behaviors.adminMenuCollapseModules = {
  attach: function (context, settings) {
    if (settings.admin_menu.tweak_modules) {
      $('#system-modules fieldset:not(.collapsed)', context).addClass('collapsed');
    }
  }
};

/**
 * Collapse modules on Permissions page.
 */
Drupal.behaviors.adminMenuCollapsePermissions = {
  attach: function (context, settings) {
    if (settings.admin_menu.tweak_permissions) {
      // Freeze width of first column to prevent jumping.
      $('#permissions th:first', context).css({ width: $('#permissions th:first', context).width() });
      // Attach click handler.
      $modules = $('#permissions tr:has(td.module)', context).once('admin-menu-tweak-permissions', function () {
        var $module = $(this);
        $module.bind('click.admin-menu', function () {
          // @todo Replace with .nextUntil() in jQuery 1.4.
          $module.nextAll().each(function () {
            var $row = $(this);
            if ($row.is(':has(td.module)')) {
              return false;
            }
            $row.toggleClass('element-hidden');
          });
        });
      });
      // Collapse all but the targeted permission rows set.
      if (window.location.hash.length) {
        $modules = $modules.not(':has(' + window.location.hash + ')');
      }
      $modules.trigger('click.admin-menu');
    }
  }
};

/**
 * Apply margin to page.
 *
 * Note that directly applying marginTop does not work in IE. To prevent
 * flickering/jumping page content with client-side caching, this is a regular
 * Drupal behavior.
 */
Drupal.behaviors.adminMenuMarginTop = {
  attach: function (context, settings) {
    if (!settings.admin_menu.suppress && settings.admin_menu.margin_top) {
      $('body:not(.admin-menu)', context).addClass('admin-menu');
    }
  }
};

/**
 * Retrieve content from client-side cache.
 *
 * @param hash
 *   The md5 hash of the content to retrieve.
 * @param onSuccess
 *   A callback function invoked when the cache request was successful.
 */
Drupal.admin.getCache = function (hash, onSuccess) {
  if (Drupal.admin.hashes.hash !== undefined) {
    return Drupal.admin.hashes.hash;
  }
  $.ajax({
    cache: true,
    type: 'GET',
    dataType: 'text', // Prevent auto-evaluation of response.
    global: false, // Do not trigger global AJAX events.
    url: Drupal.settings.admin_menu.basePath.replace(/admin_menu/, 'js/admin_menu/cache/' + hash),
    success: onSuccess,
    complete: function (XMLHttpRequest, status) {
      Drupal.admin.hashes.hash = status;
    }
  });
};

/**
 * TableHeader callback to determine top viewport offset.
 *
 * @see toolbar.js
 */
Drupal.admin.height = function () {
  var $adminMenu = $('#admin-menu');
  var height = $adminMenu.outerHeight();
  // In IE, Shadow filter adds some extra height, so we need to remove it from
  // the returned height.
  if ($adminMenu.css('filter') && $adminMenu.css('filter').match(/DXImageTransform\.Microsoft\.Shadow/)) {
    height -= $adminMenu.get(0).filters.item("DXImageTransform.Microsoft.Shadow").strength;
  }
  return height;
};

/**
 * @defgroup admin_behaviors Administration behaviors.
 * @{
 */

/**
 * Attach administrative behaviors.
 */
Drupal.admin.attachBehaviors = function (context, settings, $adminMenu) {
  if ($adminMenu.length) {
    $adminMenu.addClass('admin-menu-processed');
    $.each(Drupal.admin.behaviors, function () {
      this(context, settings, $adminMenu);
    });
  }
};

/**
 * Apply 'position: fixed'.
 */
Drupal.admin.behaviors.positionFixed = function (context, settings, $adminMenu) {
  if (settings.admin_menu.position_fixed) {
    $adminMenu.addClass('admin-menu-position-fixed');
    $adminMenu.css('position', 'fixed');
  }
};

/**
 * Move page tabs into administration menu.
 */
Drupal.admin.behaviors.pageTabs = function (context, settings, $adminMenu) {
  if (settings.admin_menu.tweak_tabs) {
    var $tabs = $(context).find('ul.tabs.primary');
    $adminMenu.find('#admin-menu-wrapper > ul').eq(1)
      .append($tabs.find('li').addClass('admin-menu-tab'));
    $(context).find('ul.tabs.secondary')
      .appendTo('#admin-menu-wrapper > ul > li.admin-menu-tab.active')
      .removeClass('secondary');
    $tabs.remove();
  }
};

/**
 * Perform dynamic replacements in cached menu.
 */
Drupal.admin.behaviors.replacements = function (context, settings, $adminMenu) {
  for (var item in settings.admin_menu.replacements) {
    $(item, $adminMenu).html(settings.admin_menu.replacements[item]);
  }
};

/**
 * Inject destination query strings for current page.
 */
Drupal.admin.behaviors.destination = function (context, settings, $adminMenu) {
  if (settings.admin_menu.destination) {
    $('a.admin-menu-destination', $adminMenu).each(function () {
      this.search += (!this.search.length ? '?' : '&') + Drupal.settings.admin_menu.destination;
    });
  }
};

/**
 * Apply JavaScript-based hovering behaviors.
 *
 * @todo This has to run last.  If another script registers additional behaviors
 *   it will not run last.
 */
Drupal.admin.behaviors.hover = function (context, settings, $adminMenu) {
  // Delayed mouseout.
  $('li.expandable', $adminMenu).hover(
    function () {
      // Stop the timer.
      clearTimeout(this.sfTimer);
      // Display child lists.
      $('> ul', this)
        .css({left: 'auto', display: 'block'})
        // Immediately hide nephew lists.
        .parent().siblings('li').children('ul').css({left: '-999em', display: 'none'});
    },
    function () {
      // Start the timer.
      var uls = $('> ul', this);
      this.sfTimer = setTimeout(function () {
        uls.css({left: '-999em', display: 'none'});
      }, 400);
    }
  );
};

/**
 * Apply the search bar functionality.
 */
Drupal.admin.behaviors.search = function (context, settings, $adminMenu) {
  // @todo Add a HTML ID.
  var $input = $('input.admin-menu-search', $adminMenu);
  // Initialize the current search needle.
  var needle = $input.val();
  // Cache of all links that can be matched in the menu.
  var links;
  // Minimum search needle length.
  var needleMinLength = 2;
  // Append the results container.
  var $results = $('<div />').insertAfter($input);

  /**
   * Executes the search upon user input.
   */
  function keyupHandler() {
    var matches, $html, value = $(this).val();
    // Only proceed if the search needle has changed.
    if (value !== needle) {
      needle = value;
      // Initialize the cache of menu links upon first search.
      if (!links && needle.length >= needleMinLength) {
        // @todo Limit to links in dropdown menus; i.e., skip menu additions.
        links = buildSearchIndex($adminMenu.find('li:not(.admin-menu-action, .admin-menu-action li) > a'));
      }
      // Empty results container when deleting search text.
      if (needle.length < needleMinLength) {
        $results.empty();
      }
      // Only search if the needle is long enough.
      if (needle.length >= needleMinLength && links) {
        matches = findMatches(needle, links);
        // Build the list in a detached DOM node.
        $html = buildResultsList(matches);
        // Display results.
        $results.empty().append($html);
      }
    }
  }

  /**
   * Builds the search index.
   */
  function buildSearchIndex($links) {
    return $links
      .map(function () {
        var text = (this.textContent || this.innerText);
        // Skip menu entries that do not contain any text (e.g., the icon).
        if (typeof text === 'undefined') {
          return;
        }
        return {
          text: text,
          textMatch: text.toLowerCase(),
          element: this
        };
      });
  }

  /**
   * Searches the index for a given needle and returns matching entries.
   */
  function findMatches(needle, links) {
    var needleMatch = needle.toLowerCase();
    // Select matching links from the cache.
    return $.grep(links, function (link) {
      return link.textMatch.indexOf(needleMatch) !== -1;
    });
  }

  /**
   * Builds the search result list in a detached DOM node.
   */
  function buildResultsList(matches) {
    var $html = $('<ul class="dropdown admin-menu-search-results" />');
    $.each(matches, function () {
      var result = this.text;
      var $element = $(this.element);

      // Check whether there is a top-level category that can be prepended.
      var $category = $element.closest('#admin-menu-wrapper > ul > li');
      var categoryText = $category.find('> a').text()
      if ($category.length && categoryText) {
        result = categoryText + ': ' + result;
      }

      var $result = $('<li><a href="' + $element.attr('href') + '">' + result + '</a></li>');
      $result.data('original-link', $(this.element).parent());
      $html.append($result);
    });
    return $html;
  }

  /**
   * Highlights selected result.
   */
  function resultsHandler(e) {
    var $this = $(this);
    var show = e.type === 'mouseenter' || e.type === 'focusin';
    $this.trigger(show ? 'showPath' : 'hidePath', [this]);
  }

  /**
   * Closes the search results and clears the search input.
   */
  function resultsClickHandler(e, link) {
    var $original = $(this).data('original-link');
    $original.trigger('mouseleave');
    $input.val('').trigger('keyup');
  }

  /**
   * Shows the link in the menu that corresponds to a search result.
   */
  function highlightPathHandler(e, link) {
    if (link) {
      var $original = $(link).data('original-link');
      var show = e.type === 'showPath';
      // Toggle an additional CSS class to visually highlight the matching link.
      // @todo Consider using same visual appearance as regular hover.
      $original.toggleClass('highlight', show);
      $original.trigger(show ? 'mouseenter' : 'mouseleave');
    }
  }

  // Attach showPath/hidePath handler to search result entries.
  $results.delegate('li', 'mouseenter mouseleave focus blur', resultsHandler);
  // Hide the result list after a link has been clicked, useful for overlay.
  $results.delegate('li', 'click', resultsClickHandler);
  // Attach hover/active highlight behavior to search result entries.
  $adminMenu.delegate('.admin-menu-search-results li', 'showPath hidePath', highlightPathHandler);
  // Attach the search input event handler.
  $input.bind('keyup search', keyupHandler);
};

/**
 * @} End of "defgroup admin_behaviors".
 */

})(jQuery);
;
(function($) {

Drupal.admin = Drupal.admin || {};
Drupal.admin.behaviors = Drupal.admin.behaviors || {};

/**
 * @ingroup admin_behaviors
 * @{
 */

/**
 * Apply active trail highlighting based on current path.
 *
 * @todo Not limited to toolbar; move into core?
 */
Drupal.admin.behaviors.toolbarActiveTrail = function (context, settings, $adminMenu) {
  if (settings.admin_menu.toolbar && settings.admin_menu.toolbar.activeTrail) {
    $adminMenu.find('> div > ul > li > a[href="' + settings.admin_menu.toolbar.activeTrail + '"]').addClass('active-trail');
  }
};

/**
 * Toggles the shortcuts bar.
 */
Drupal.admin.behaviors.shortcutToggle = function (context, settings, $adminMenu) {
  var $shortcuts = $adminMenu.find('.shortcut-toolbar');
  if (!$shortcuts.length) {
    return;
  }
  var storage = window.localStorage || false;
  var storageKey = 'Drupal.admin_menu.shortcut';
  var $body = $(context).find('body');
  var $toggle = $adminMenu.find('.shortcut-toggle');
  $toggle.click(function () {
    var enable = !$shortcuts.hasClass('active');
    $shortcuts.toggleClass('active', enable);
    $toggle.toggleClass('active', enable);
    if (settings.admin_menu.margin_top) {
      $body.toggleClass('admin-menu-with-shortcuts', enable);
    }
    // Persist toggle state across requests.
    storage && enable ? storage.setItem(storageKey, 1) : storage.removeItem(storageKey);
    this.blur();
    return false;
  });

  if (!storage || storage.getItem(storageKey)) {
    $toggle.trigger('click');
  }
};

/**
 * @} End of "ingroup admin_behaviors".
 */

})(jQuery);
;
