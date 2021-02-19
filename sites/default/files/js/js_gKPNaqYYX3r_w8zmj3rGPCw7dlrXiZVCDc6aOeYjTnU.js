/**
 * @file
 * JavaScript file for the Coffee module.
 */

(function($) {
  // Remap the filter functions for autocomplete to recognise the
  // extra value "command".
  var proto = $.ui.autocomplete.prototype,
    initSource = proto._initSource;

  function filter(array, term) {
    var matcher = new RegExp($.ui.autocomplete.escapeRegex(term), 'i');
    return $.grep(array, function(value) {
                return matcher.test(value.command) || matcher.test(value.label) || matcher.test(value.value);
    });
  }

  $.extend(proto, {
    _initSource: function() {
      if ($.isArray(this.options.source)) {
        this.source = function(request, response) {
          response(filter(this.options.source, request.term));
        };
      }
      else {
        initSource.call(this);
      }
    }
  });

  Drupal.coffee = Drupal.coffee || {};

  Drupal.behaviors.coffee = {
    attach: function() {
      $('body').once('coffee', function() {
        var body = $(this);

        Drupal.coffee.bg.appendTo(body).hide();

        Drupal.coffee.form
        .append(Drupal.coffee.label)
        .append(Drupal.coffee.field)
        .append(Drupal.coffee.results)
        .wrapInner('<div id="coffee-form-inner" />')
        .addClass('hide-form')
        .appendTo(body);

        // Load autocomplete data set, consider implementing
        // caching with local storage.
        Drupal.coffee.dataset = [];
        Drupal.coffee.isItemSelected = false;

        var jquery_ui_version = $.ui.version.split('.');
        var jquery_ui_newer_1_9 = parseInt(jquery_ui_version[0]) >= 1 && parseInt(jquery_ui_version[1]) > 9;
        var autocomplete_data_element = (jquery_ui_newer_1_9) ? 'ui-autocomplete' : 'autocomplete';

        $.ajax({
          url: Drupal.settings.basePath + '?q=admin/coffee/menu',
          dataType: 'json',
          success: function(data) {
            Drupal.coffee.dataset = data;

            // Apply autocomplete plugin on show
            var $autocomplete = $(Drupal.coffee.field).autocomplete({
              source: Drupal.coffee.dataset,
              focus: function(event, ui) {
                  Drupal.coffee.isItemSelected = true;
                  // Prevents replacing the value of the input field
                  event.preventDefault();
              },
              change: function(event, ui) {
                  Drupal.coffee.isItemSelected = false;
              },
              select: function(event, ui) {
                Drupal.coffee.redirect(ui.item.value, event.metaKey);
                event.preventDefault();
                return false;
              },
              delay: 0,
              appendTo: Drupal.coffee.results
           });

           $autocomplete.data(autocomplete_data_element)._renderItem = function(ul, item) {
              return  $('<li></li>')
                      .data('item.autocomplete', item)
                      .append(
                        '<a href="' + item.value + '">' + (item.parent ? item.parent + ' &raquo; ' : '') + item.label +
                        '<small class="description">' + item.value + '</small>' +
                        '</a>')
                      .appendTo(ul);
            };

            // This isn't very nice, there are methods within that we need
            // to alter, so here comes a big wodge of text...
            var self = Drupal.coffee.field;
            if (!jquery_ui_newer_1_9){
                $(Drupal.coffee.field).data(autocomplete_data_element).menu = $('<ol></ol>')
                    .addClass('ui-autocomplete')
                    .appendTo(Drupal.coffee.results)
                    // prevent the close-on-blur in case of a "slow" click on the menu (long mousedown).
                    .mousedown(function(event) {
                        event.preventDefault();
                    })
                    .menu({
                        selected: function(event, ui) {
                            var item = ui.item.data('item.autocomplete');
                            Drupal.coffee.redirect(item.value, event.metaKey);
                            event.preventDefault();
                        },
                        focus: function(event, ui) {
                            Drupal.coffee.isItemSelected = true;
                        }
                    })

                    .hide()
                    .data('menu');
            }

            // We want to limit the number of results.
            $(Drupal.coffee.field).data(autocomplete_data_element)._renderMenu = function(ul, items) {
              var self = this;
              //@todo: max should be in Drupal.settings var.
              items = items.slice(0, 7);
              $.each(items, function(index, item) {
                    if (typeof(self._renderItemData) === "undefined"){
                        self._renderItem(ul, item);
                    }
                    else {
                        self._renderItemData(ul, item);
                    }

              });
            };

            Drupal.coffee.form.keydown(function(event) {
              if (event.keyCode == 13) {
                var openInNewWindow = false;

                if (event.metaKey) {
                  openInNewWindow = true;
                }
                if (!Drupal.coffee.isItemSelected) {
                    var $firstItem = jQuery(Drupal.coffee.results).find('li:first').data('item.autocomplete');
                    if (typeof $firstItem === 'object') {
                        Drupal.coffee.redirect($firstItem.value, openInNewWindow);
                        event.preventDefault();
                    }
                }
              }
            });
          },
          error: function() {
            Drupal.coffee.field.val('Could not load data, please refresh the page');
          }
        });

        $('.navbar-icon-coffee').click(function (event) {
          event.preventDefault();
          if (!Drupal.coffee.form.hasClass('hide-form')) {
            Drupal.coffee.coffee_close();
          } else {
            Drupal.coffee.coffee_show();
          }
        });

        // Key events
        $(document).keydown(function(event) {
          var activeElement = $(document.activeElement);

          // Show the form with alt + D. Use 2 keycodes as 'D' can be uppercase or lowercase.
          if (Drupal.coffee.form.hasClass('hide-form') &&
              event.altKey === true &&
              // 68/206 = d/D, 75 = k.
              (event.keyCode === 68 || event.keyCode === 206  || event.keyCode === 75)) {
            Drupal.coffee.coffee_show();
            event.preventDefault();
          }
          // Close the form with esc or alt + D.
          else if (!Drupal.coffee.form.hasClass('hide-form') && (event.keyCode === 27 || (event.altKey === true && (event.keyCode === 68 || event.keyCode === 206)))) {
            Drupal.coffee.coffee_close();
            event.preventDefault();
          }
        });
      });
    }
  };

  // Prefix the open and close functions to avoid
  // conflicts with autocomplete plugin.

  /**
   * Open the form and focus on the search field.
   */
  Drupal.coffee.coffee_show = function() {
    Drupal.coffee.form.removeClass('hide-form');
    Drupal.coffee.bg.show();
    Drupal.coffee.field.focus();
    $(Drupal.coffee.field).autocomplete({enable: true});
  };

  /**
   * Close the form and destroy all data.
   */
  Drupal.coffee.coffee_close = function() {
    Drupal.coffee.field.val('');
    //Drupal.coffee.results.empty();
    Drupal.coffee.form.addClass('hide-form');
    Drupal.coffee.bg.hide();
    $(Drupal.coffee.field).autocomplete({enable: false});
  };

  /**
   * Close the Coffee form and redirect.
   * Todo: make it work with the overlay module.
   */
  Drupal.coffee.redirect = function(path, openInNewWindow) {
    Drupal.coffee.coffee_close();

    if (openInNewWindow) {
      window.open(Drupal.settings.basePath + Drupal.settings.pathPrefix + path);
    }
    else {
      document.location = Drupal.settings.basePath + Drupal.settings.pathPrefix + path;
    }
  };

  /**
   * The HTML elements.
   */
  Drupal.coffee.label = $('<label for="coffee-q" class="element-invisible" />').text(Drupal.t('Query'));

  Drupal.coffee.results = $('<div id="coffee-results" />');

  // Instead of appending results one by one, we put them in a placeholder element
  // first and then append them all at once to prevent flickering while typing.
  Drupal.coffee.resultsPlaceholder = $('<ol />');

  Drupal.coffee.form = $('<form id="coffee-form" action="#" />');

  Drupal.coffee.bg = $('<div id="coffee-bg" />').click(function() {
    Drupal.coffee.coffee_close();
  });

  Drupal.coffee.field = $('<input id="coffee-q" type="text" autocomplete="off" />');

}(jQuery));
;
/**
 * @file
 * Provides default functions for the media browser
 */

(function ($) {
namespace('Drupal.media.browser');

Drupal.media.browser.selectedMedia = [];
Drupal.media.browser.mediaAdded = function () {};
Drupal.media.browser.selectionFinalized = function (selectedMedia) {
  // This is intended to be overridden if a callee wants to be triggered
  // when the media selection is finalized from inside the browser.
  // This is used for the file upload form for instance.
};

Drupal.behaviors.MediaBrowser = {
  attach: function (context) {
    if (Drupal.settings.media && Drupal.settings.media.selectedMedia) {
      Drupal.media.browser.selectMedia(Drupal.settings.media.selectedMedia);
      // Fire a confirmation of some sort.
      Drupal.media.browser.finalizeSelection();
    }

    // Instantiate the tabs.
    var showFunc = function(event, ui) {
      // Store index of the tab being activated.
      if (parent_iframe = Drupal.media.browser.getParentIframe(window)) {
        $(parent_iframe).attr('current_tab', $('#media-tabs-wrapper > ul > li.ui-state-active').index());
      }
    };

    var activeTab = Drupal.media.browser.tabFromHash();

    $('#media-browser-tabset').once('MediaBrowser').tabs({
      selected: activeTab, // jquery < 1.9
      active: activeTab, // jquery >= 1.9
      show: showFunc, // jquery ui < 1.8
      activate: showFunc // jquery ui >= 1.8
    });

    $('.media-browser-tab').each( Drupal.media.browser.validateButtons );

    // Keep keyboard focus from going to the browser chrome.
    $('body', context).once(function () {
      $(window).bind('keydown', function (event) {
        if (event.keyCode === 9) {
          var tabbables = $(':tabbable'),
              first = tabbables.filter(':first'),
              last = tabbables.filter(':last'),
              new_event;
          if ((event.target === last[0] && !event.shiftKey) || (event.target === first[0] && event.shiftKey)) {
            // If we're at the end of the tab list, then send a keyboard event
            // to the parent iframe.
            if (parent_iframe = Drupal.media.browser.getParentIframe(window)) {
              $('.ui-dialog-titlebar-close', $(parent_iframe).closest('.ui-dialog')).focus();
              event.preventDefault();
              return false;
            }
          }
        }
      });
    });
  }
  // Wait for additional params to be passed in.
};

Drupal.media.browser.getParentIframe = function (window) {
  var arrFrames = parent.document.getElementsByTagName("IFRAME");

  for (var i = 0; i < arrFrames.length; i++) {
    if (arrFrames[i].contentWindow === window) {
      return arrFrames[i];
    }
  }
}

/**
 * Get index of the active tab from window.location.hash
 */
Drupal.media.browser.tabFromHash = function () {
  if (parent_iframe = Drupal.media.browser.getParentIframe(window)) {
    return $(parent_iframe).attr('current_tab');
  }

  return 0;
};

Drupal.media.browser.launch = function () {

};

Drupal.media.browser.validateButtons = function() {
  // The media browser runs in an IFRAME. The Drupal.media.popups.mediaBrowser()
  // function sets up the IFRAME and an "OK" button that is outside of the
  // IFRAME, so that its click handlers can destroy the IFRAME while retaining
  // information about what media items were selected. However, Drupal UI
  // convention is to place all action buttons on the same "line" at the bottom
  // of the form, so if the form within the IFRAME contains a "Submit" button or
  // other action buttons, then the "OK" button will appear below the IFRAME
  // which breaks this convention and is confusing to the user. Therefore, we
  // add a "Submit" button inside the IFRAME, and have its click action trigger
  // the click action of the corresponding "OK" button that is outside the
  // IFRAME. media.css contains CSS rules that hide the outside buttons.

  // If a submit button is present, another round-trip to the server is needed
  // before the user's selection is finalized. For these cases, when the form's
  // real Submit button is clicked, the server either returns another form for
  // the user to fill out, or else a completion page that contains or sets the
  // Drupal.media.browser.selectedMedia variable. If the latter, then
  // Drupal.media.popups.mediaBrowser.mediaBrowserOnLoad() auto-triggers the
  // "OK" button action to finalize the selection and remove the IFRAME.

  // We need to check for the fake submit button that is used on non-form based
  // pane content. On these items we need to bind the clicks so that media can
  // be selected or the window can be closed. This is still a hacky approach,
  // but it is a step in the right direction.

  $('a.button.fake-submit', this).once().bind('click', Drupal.media.browser.submit);
};

Drupal.media.browser.submit = function () {
  // @see Drupal.media.browser.validateButtons().
  var buttons = $(parent.window.document.body).find('#mediaBrowser').parent('.ui-dialog').find('.ui-dialog-buttonpane button');
  buttons[0].click();

  // Return false to prevent the fake link "click" from continuing.
  return false;
}

Drupal.media.browser.selectMedia = function (selectedMedia) {
  Drupal.media.browser.selectedMedia = selectedMedia;
};

Drupal.media.browser.selectMediaAndSubmit = function (selectedMedia) {
  Drupal.media.browser.selectedMedia = selectedMedia;
  Drupal.media.browser.submit();
};

Drupal.media.browser.finalizeSelection = function () {
  if (!Drupal.media.browser.selectedMedia) {
    throw new exception(Drupal.t('Cannot continue, nothing selected'));
  }
  else {
    Drupal.media.browser.selectionFinalized(Drupal.media.browser.selectedMedia);
  }
};

}(jQuery));
;
