(function($) {
  // Unbind core state.js from document first so we can then override below.
  $(document).unbind('state:disabled');

  /**
   * Global state change handlers. These are bound to "document" to cover all
   * elements whose state changes. Events sent to elements within the page
   * bubble up to these handlers. We use this system so that themes and modules
   * can override these state change handlers for particular parts of a page.
   */
  $(document).bind('state:disabled', function(e) {
    // Only act when this change was triggered by a dependency and not by the
    // element monitoring itself.
    if (e.trigger) {
      $(e.target)
        .attr('disabled', e.value)
        .closest('.form-item, .form-submit, .form-wrapper').toggleClass('form-disabled', e.value)
        .find(':input').attr('disabled', e.value);

      // Note: WebKit nightlies don't reflect that change correctly.
      // See https://bugs.webkit.org/show_bug.cgi?id=23789
    }
  });
})(jQuery);
;
(function ($) {

/**
 * Override Drupal's AJAX prototype beforeSend function so it can append the
 * throbber inside the pager links.
 */
Drupal.ajax.prototype.beforeSend = function (xmlhttprequest, options) {
  // For forms without file inputs, the jQuery Form plugin serializes the form
  // values, and then calls jQuery's $.ajax() function, which invokes this
  // handler. In this circumstance, options.extraData is never used. For forms
  // with file inputs, the jQuery Form plugin uses the browser's normal form
  // submission mechanism, but captures the response in a hidden IFRAME. In this
  // circumstance, it calls this handler first, and then appends hidden fields
  // to the form to submit the values in options.extraData. There is no simple
  // way to know which submission mechanism will be used, so we add to extraData
  // regardless, and allow it to be ignored in the former case.
  if (this.form) {
    options.extraData = options.extraData || {};

    // Let the server know when the IFRAME submission mechanism is used. The
    // server can use this information to wrap the JSON response in a TEXTAREA,
    // as per http://jquery.malsup.com/form/#file-upload.
    options.extraData.ajax_iframe_upload = '1';

    // The triggering element is about to be disabled (see below), but if it
    // contains a value (e.g., a checkbox, textfield, select, etc.), ensure that
    // value is included in the submission. As per above, submissions that use
    // $.ajax() are already serialized prior to the element being disabled, so
    // this is only needed for IFRAME submissions.
    var v = $.fieldValue(this.element);
    if (v !== null) {
      options.extraData[this.element.name] = v;
    }
  }

  var $element = $(this.element);

  // Disable the element that received the change to prevent user interface
  // interaction while the Ajax request is in progress. ajax.ajaxing prevents
  // the element from triggering a new request, but does not prevent the user
  // from changing its value.
  $element.addClass('progress-disabled').attr('disabled', true);

  // Insert progressbar or throbber.
  if (this.progress.type == 'bar') {
    var progressBar = new Drupal.progressBar('ajax-progress-' + this.element.id, eval(this.progress.update_callback), this.progress.method, eval(this.progress.error_callback));
    if (this.progress.message) {
      progressBar.setProgress(-1, this.progress.message);
    }
    if (this.progress.url) {
      progressBar.startMonitoring(this.progress.url, this.progress.interval || 500);
    }
    this.progress.element = $(progressBar.element).addClass('ajax-progress ajax-progress-bar');
    this.progress.object = progressBar;
    if (!$element.closest('.file-widget,.form-item').length) {
      $element.before(this.progress.element);
    }
    else {
      $element.closest('.file-widget,.form-item').after(this.progress.element);
    }
  }
  else if (this.progress.type == 'throbber') {
    this.progress.element = $('<div class="ajax-progress ajax-progress-throbber"><i class="glyphicon glyphicon-refresh glyphicon-spin"></i></div>');
    if (this.progress.message) {
      $('.throbber', this.progress.element).after('<div class="message">' + this.progress.message + '</div>');
    }

    // If element is an input type, append after.
    if ($element.is('input')) {
      $element.after(this.progress.element);
    }
    else if ($element.is('select')) {
      var $inputGroup = $element.closest('.form-item').find('.input-group-addon, .input-group-btn');
      if (!$inputGroup.length) {
        $element.wrap('<div class="input-group">');
        $inputGroup = $('<span class="input-group-addon">');
        $element.after($inputGroup);
      }
      $inputGroup.append(this.progress.element);
    }
    // Otherwise append the throbber inside the element.
    else {
      $element.append(this.progress.element);
    }
  }
};

})(jQuery);
;
/**
 * @file
 *
 * Overrides for ctools modal.
 *
 */

(function ($) {
  /**
   * Override CTools modal show function so it can recognize the Bootstrap modal classes correctly
   */
  Drupal.CTools.Modal.show = function(choice) {
    var opts = {};

    if (choice && typeof choice === 'string' && Drupal.settings[choice]) {
      // This notation guarantees we are actually copying it.
      $.extend(true, opts, Drupal.settings[choice]);
    }
    else if (choice) {
      $.extend(true, opts, choice);
    }

    var defaults = {
      modalTheme: 'CToolsModalDialog',
      throbberTheme: 'CToolsModalThrobber',
      animation: 'show',
      animationSpeed: 'fast',
      modalSize: {
        type: 'scale',
        width: 0.8,
        height: 0.8,
        addWidth: 0,
        addHeight: 0,
        // How much to remove from the inner content to make space for the
        // theming.
        contentRight: 25,
        contentBottom: 45
      },
      modalOptions: {
        opacity: 0.55,
        background: '#fff'
      },
      modalClass: 'default'
    };

    var settings = {};
    $.extend(true, settings, defaults, Drupal.settings.CToolsModal, opts);

    if (Drupal.CTools.Modal.currentSettings && Drupal.CTools.Modal.currentSettings !== settings) {
      Drupal.CTools.Modal.modal.remove();
      Drupal.CTools.Modal.modal = null;
    }

    Drupal.CTools.Modal.currentSettings = settings;

    var resize = function(e) {
      // When creating the modal, it actually exists only in a theoretical
      // place that is not in the DOM. But once the modal exists, it is in the
      // DOM so the context must be set appropriately.
      var context = e ? document : Drupal.CTools.Modal.modal;
      var width = 0;
      var height = 0;

      //  Handle fixed navbars. Grab the body top offset in pixels.
      var topOffset = parseInt($('body').css("padding-top"), 10);

      if (Drupal.CTools.Modal.currentSettings.modalSize.type === 'scale') {
        width = $(window).width() * Drupal.CTools.Modal.currentSettings.modalSize.width;
        height = ($(window).height() - topOffset) * Drupal.CTools.Modal.currentSettings.modalSize.height;
      }
      else {
        width = Drupal.CTools.Modal.currentSettings.modalSize.width;
        height = Drupal.CTools.Modal.currentSettings.modalSize.height;
      }

      // Add padding for the offset.
      $('#modalContent').css('padding-top', topOffset + 'px');

      // Use the additionol pixels for creating the width and height.
      $('div.ctools-modal-dialog', context).css({
        'width': width + Drupal.CTools.Modal.currentSettings.modalSize.addWidth + 'px',
        'height': height + Drupal.CTools.Modal.currentSettings.modalSize.addHeight + 'px'
      });

      $('div.ctools-modal-dialog .modal-body', context).css({
        'width': (width - Drupal.CTools.Modal.currentSettings.modalSize.contentRight) + 'px',
        'max-height': (height - Drupal.CTools.Modal.currentSettings.modalSize.contentBottom) + 'px'
      });
    };

    if (!Drupal.CTools.Modal.modal) {
      Drupal.CTools.Modal.modal = $(Drupal.theme(settings.modalTheme));
      if (settings.modalSize.type === 'scale') {
        $(window).bind('resize', resize);
      }
    }

    $('body').addClass('modal-open');

    resize();

    $('.modal-title', Drupal.CTools.Modal.modal).html(Drupal.CTools.Modal.currentSettings.loadingText);
    Drupal.CTools.Modal.modalContent(Drupal.CTools.Modal.modal, settings.modalOptions, settings.animation, settings.animationSpeed, settings.modalClass);
    $('#modalContent .modal-body').html(Drupal.theme(settings.throbberTheme)).addClass('ctools-modal-loading');
  };

  /**
   * Remove modal class from body when closing modal.
   */
  $(document).on('CToolsDetachBehaviors', function() {
    $('body').removeClass('modal-open');
  });

  /**
   * Provide the HTML to create the modal dialog in the Bootstrap style.
   */
  Drupal.theme.prototype.CToolsModalDialog = function () {
    var html = '';
    html += '<div id="ctools-modal">';
    html += '  <div class="ctools-modal-dialog modal-dialog">';
    html += '    <div class="modal-content">';
    html += '      <div class="modal-header">';
    html += '        <button type="button" class="close ctools-close-modal" aria-hidden="true">&times;</button>';
    html += '        <h4 id="modal-title" class="modal-title">&nbsp;</h4>';
    html += '      </div>';
    html += '      <div id="modal-content" class="modal-body">';
    html += '      </div>';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';

    return html;
  };

  /**
   * Provide the HTML to create a nice looking loading progress bar.
   */
  Drupal.theme.prototype.CToolsModalThrobber = function () {
    var html = '';
    html += '<div class="loading-spinner" style="width: 200px; margin: -20px 0 0 -100px; position: absolute; top: 45%; left: 50%">';
    html += '  <div class="progress progress-striped active">';
    html += '    <div class="progress-bar" style="width: 100%;"></div>';
    html += '  </div>';
    html += '</div>';

    return html;
  };


})(jQuery);
;
(function ($) {

  function updateFilterHelpLink () {
    var $link = $(this).parents('.filter-wrapper').find('.filter-help > a');
    var originalLink = $link.data('originalLink');
    if (!originalLink) {
      originalLink = $link.attr('href');
      $link.data('originalLink', originalLink);
    }
    $link.attr('href', originalLink + '/' + $(this).find(':selected').val());
  }

  $(document).on('change', '.filter-wrapper select.filter-list', updateFilterHelpLink);

  /**
   * Override core's functionality.
   */
  Drupal.behaviors.filterGuidelines = {
    attach: function (context) {
      $(context).find('.filter-wrapper select.filter-list').once('filter-list', updateFilterHelpLink);
    }
  };

})(jQuery);
;
(function ($) {

  /**
   * Attaches the autocomplete behavior to all required fields.
   */
  Drupal.behaviors.autocomplete = {
    attach: function (context) {
      var $context = $(context);
      var acdb = [];
      $context.find('input.autocomplete').once('autocomplete', function () {
        var uri = this.value;
        if (!acdb[uri]) {
          acdb[uri] = new Drupal.ACDB(uri);
        }
        var $input = $context.find('#' + this.id.substr(0, this.id.length - 13))
          .attr('autocomplete', 'OFF')
          .attr('aria-autocomplete', 'list');
        $context.find($input[0].form).submit(Drupal.autocompleteSubmit);
        $input.parents('.form-item')
          .attr('role', 'application')
          .append($('<span class="element-invisible" aria-live="assertive"></span>')
            .attr('id', $input.attr('id') + '-autocomplete-aria-live')
          );
        new Drupal.jsAC($input, acdb[uri], $context);
      });
    }
  };

  /**
   * Prevents the form from submitting if the suggestions popup is open
   * and closes the suggestions popup when doing so.
   */
  Drupal.autocompleteSubmit = function () {
    // NOTE: Do not return true as this is non-standard. Keep it similar to
    // core. If another contrib project alters this functionality, then it is
    // the responsibility of a sub-theme to override this method and combine
    // this project with the other project.
    return $('.form-autocomplete > .dropdown').each(function () {
      this.owner.hidePopup();
    }).length == 0;
  };

  /**
   * Highlights a suggestion.
   */
  Drupal.jsAC.prototype.highlight = function (node) {
    if (this.selected) {
      $(this.selected).removeClass('active');
    }
    $(node).addClass('active');
    this.selected = node;
    $(this.ariaLive).html($(this.selected).html());
  };

  /**
   * Unhighlights a suggestion.
   */
  Drupal.jsAC.prototype.unhighlight = function (node) {
    $(node).removeClass('active');
    this.selected = false;
    $(this.ariaLive).empty();
  };

  /**
   * Positions the suggestions popup and starts a search.
   */
  Drupal.jsAC.prototype.populatePopup = function () {
    var $input = $(this.input);
    // Show popup.
    if (this.popup) {
      $(this.popup).remove();
    }
    this.selected = false;
    this.popup = $('<div class="dropdown"></div>')[0];
    this.popup.owner = this;
    $input.parent().after(this.popup);

    // Do search.
    this.db.owner = this;
    this.db.search(this.input.value);
  };

  /**
   * Fills the suggestion popup with any matches received.
   */
  Drupal.jsAC.prototype.found = function (matches) {
    // If no value in the textfield, do not show the popup.
    if (!this.input.value.length) {
      return false;
    }

    // Prepare matches.
    var ul = $('<ul class="dropdown-menu"></ul>');
    var ac = this;
    ul.css({
      display: 'block',
      right: 0
    });
    for (var key in matches) {
      $('<li></li>')
        .html($('<a href="#"></a>').html(matches[key]).on('click', function (e) {
          e.preventDefault();
        }))
        .on('mousedown', function () {
          ac.hidePopup(this);
        })
        .on('mouseover', function () {
          ac.highlight(this);
        })
        .on('mouseout', function () {
          ac.unhighlight(this);
        })
        .data('autocompleteValue', key)
        .appendTo(ul);
    }

    // Show popup with matches, if any.
    if (this.popup) {
      if (ul.children().length) {
        $(this.popup).empty().append(ul).show();
        $(this.ariaLive).html(Drupal.t('Autocomplete popup'));
      }
      else {
        $(this.popup).css({visibility: 'hidden'});
        this.hidePopup();
      }
    }
  };

  /**
   * Finds the next sibling item.
   */
  Drupal.jsAC.prototype.findNextSibling = function (element) {
    var sibling = element && element.nextSibling;
    if (sibling && !this.validItem(sibling)) {
      return this.findNextSibling(sibling.nextSibling);
    }
    return sibling;
  };

  /**
   * Finds the previous sibling item.
   */
  Drupal.jsAC.prototype.findPreviousSibling = function (element) {
    var sibling = element && element.previousSibling;
    if (sibling && !this.validItem(sibling)) {
      return this.findPreviousSibling(sibling.previousSibling);
    }
    return sibling;
  };

  /**
   * Highlights the next suggestion.
   */
  Drupal.jsAC.prototype.selectDown = function () {
    var sibling = this.findNextSibling(this.selected);
    if (sibling) {
      this.highlight(sibling);
    }
    else if (this.popup) {
      var lis = $('li', this.popup);
      if (lis.length > 0) {
        if (this.validItem(lis[0])) {
          this.highlight(lis[0]);
        }
        else {
          this.highlight(this.findNextSibling(lis[0]));
        }
      }
    }
  };

  /**
   * Highlights the previous suggestion.
   */
  Drupal.jsAC.prototype.selectUp = function () {
    var sibling = this.findPreviousSibling(this.selected);
    if (sibling) {
      this.highlight(sibling);
    }
    else if (this.popup) {
      var lis = $('li', this.popup);
      if (lis.length > 0) {
        if (this.validItem(lis[lis.length - 1])) {
          this.highlight(lis[lis.length - 1]);
        }
        else {
          this.highlight(this.findPreviousSibling(lis[lis.length - 1]));
        }
      }
    }
  };

  /**
   * Ensures the item is valid.
   */
  Drupal.jsAC.prototype.validItem = function (element) {
    return !$(element).is('.dropdown-header, .divider, .disabled');
  };

  Drupal.jsAC.prototype.setStatus = function (status) {
    var $throbber = $(this.input).parent().find('.glyphicon-refresh, .autocomplete-throbber').first();
    var throbbingClass = $throbber.is('.autocomplete-throbber') ? 'throbbing' : 'glyphicon-spin';
    switch (status) {
      case 'begin':
        $throbber.addClass(throbbingClass);
        $(this.ariaLive).html(Drupal.t('Searching for matches...'));
        break;
      case 'cancel':
      case 'error':
      case 'found':
        $throbber.removeClass(throbbingClass);
        break;
    }
  };

  // Save the previous autocomplete prototype.
  var oldPrototype = Drupal.jsAC.prototype;

  /**
   * Override the autocomplete constructor.
   */
  Drupal.jsAC = function ($input, db, context) {
    var ac = this;

    // Context is normally passed by Drupal.behaviors.autocomplete above. However,
    // if a module has manually invoked this method they will likely not know
    // about this feature and a global fallback context to document must be used.
    // @see https://www.drupal.org/node/2594243
    // @see https://www.drupal.org/node/2315295
    this.$context = context && $(context) || $(document);

    this.input = $input[0];
    this.ariaLive = this.$context.find('#' + this.input.id + '-autocomplete-aria-live');
    this.db = db;
    $input
      .keydown(function (event) {
        return ac.onkeydown(this, event);
      })
      .keyup(function (event) {
        ac.onkeyup(this, event);
      })
      .blur(function () {
        ac.hidePopup();
        ac.db.cancel();
      });
  };

  // Restore the previous prototype.
  Drupal.jsAC.prototype = oldPrototype;

})(jQuery);
;
