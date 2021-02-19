(function($) {

CKEDITOR.disableAutoInline = true;

// Exclude every id starting with 'cke_' in ajax_html_ids during AJAX requests.
Drupal.wysiwyg.excludeIdSelectors.wysiwyg_ckeditor = ['[id^="cke_"]'];

// Keeps track of private instance data.
var instanceMap;

/**
 * Initialize the editor library.
 *
 * This method is called once the first time a library is needed. If new
 * WYSIWYG fields are added later, update() will be called instead.
 *
 * @param settings
 *   An object containing editor settings for each input format.
 * @param pluginInfo
 *   An object containing global plugin configuration.
 */
Drupal.wysiwyg.editor.init.ckeditor = function(settings, pluginInfo) {
  instanceMap = {};

  // Manually set the cache-busting string to the same value as Drupal.
  if (Drupal.settings.wysiwyg.ckeditor.hasOwnProperty('timestamp')) {
    CKEDITOR.timestamp = Drupal.settings.wysiwyg.ckeditor.timestamp;
  }

  // Nothing to do here other than register new plugins etc.
  Drupal.wysiwyg.editor.update.ckeditor(settings, pluginInfo);
};

/**
 * Update the editor library when new settings are available.
 *
 * This method is called instead of init() when at least one new WYSIWYG field
 * has been added to the document and the library has already been initialized.
 *
 * $param settings
 *   An object containing editor settings for each input format.
 * $param pluginInfo
 *   An object containing global plugin configuration.
 */
Drupal.wysiwyg.editor.update.ckeditor = function(settings, pluginInfo) {
  // Register native external plugins.
  // Array syntax required; 'native' is a predefined token in JavaScript.
  for (var pluginId in pluginInfo['native']) {
    if (pluginInfo['native'].hasOwnProperty(pluginId) && (!CKEDITOR.plugins.externals || !CKEDITOR.plugins.externals[pluginId])) {
      var plugin = pluginInfo['native'][pluginId];
      CKEDITOR.plugins.addExternal(pluginId, plugin.path, plugin.fileName);
    }
  }
  // Build and register Drupal plugin wrappers.
  for (var pluginId in pluginInfo.drupal) {
    if (pluginInfo.drupal.hasOwnProperty(pluginId) && (!CKEDITOR.plugins.registered || !CKEDITOR.plugins.registered[pluginId])) {
      Drupal.wysiwyg.editor.instance.ckeditor.addPlugin(pluginId, pluginInfo.drupal[pluginId]);
    }
  }
  // Register Font styles (versions 3.2.1 and above).
  for (var format in settings) {
    if (settings[format].stylesSet && (!CKEDITOR.stylesSet || !CKEDITOR.stylesSet.registered[format])) {
      CKEDITOR.stylesSet.add(format, settings[format].stylesSet);
    }
  }
};

/**
 * Attach this editor to a target element.
 */
Drupal.wysiwyg.editor.attach.ckeditor = function(context, params, settings) {
  // Apply editor instance settings.
  CKEDITOR.config.customConfig = '';

  if (!settings.height) {
    settings.height = $('#' + params.field).height();
  }
  // Handler for any change-related event.
  function changed(ev) {
    instanceMap[ev.editor.name].contentsChanged();
  }
  settings.on = {
    // Versions 4.x has a change event, 3.x does not.
    change: function (ev) {
      changed(ev);
    },
    contentDom: function (ev) {
      if (CKEDITOR.version.split('.')[0] == '3') {
        ev.editor.on('key', function (ev) {
          // Do not capture modifiers.
          if (ev.data.ctrlKey || ev.data.metaKey)
            return;

          var keyCode = ev.data.keyCode;
          // Filter out movement keys and related.
          if (keyCode == 8 || keyCode == 13 || keyCode == 32
            || (keyCode >= 46 && keyCode <= 90) || (keyCode >= 96 && keyCode <= 111)
            || (keyCode >= 186 && keyCode <= 222) || keyCode == 229) {
            changed(ev);
          }
        });
        ev.editor.on('paste', changed);
        ev.editor.on('saveSnapshot', function (ev) {
          if (instanceMap[ev.editor.name].firstSaveSnapshot) {
            // The first save snapshot event is triggered when the editor is
            // focused and before anything has changed.
            instanceMap[ev.editor.name].firstSaveSnapshot = false;
            return;
          }
          changed(ev);
        });
      }
    },
    instanceReady: function(ev) {
      var editor = ev.editor;
      // Get a list of block, list and table tags from CKEditor's XHTML DTD.
      // @see http://docs.cksource.com/CKEditor_3.x/Developers_Guide/Output_Formatting.
      var dtd = CKEDITOR.dtd;
      var tags = CKEDITOR.tools.extend({}, dtd.$block, dtd.$listItem, dtd.$tableContent);
      // Set source formatting rules for each listed tag except <pre>.
      // Linebreaks can be inserted before or after opening and closing tags.
      if (settings.simple_source_formatting) {
        // Mimic FCKeditor output, by breaking lines between tags.
        for (var tag in tags) {
          if (tag == 'pre') {
            continue;
          }
          this.dataProcessor.writer.setRules(tag, {
            indent: true,
            breakBeforeOpen: true,
            breakAfterOpen: false,
            breakBeforeClose: false,
            breakAfterClose: true
          });
        }
      }
      else {
        // CKEditor adds default formatting to <br>, so we want to remove that
        // here too.
        tags.br = 1;
        // No indents or linebreaks;
        for (var tag in tags) {
          if (tag == 'pre') {
            continue;
          }
          this.dataProcessor.writer.setRules(tag, {
            indent: false,
            breakBeforeOpen: false,
            breakAfterOpen: false,
            breakBeforeClose: false,
            breakAfterClose: false
          });
        }
      }
    },

    pluginsLoaded: function(ev) {
      var wysiwygInstance = instanceMap[this.name];
      var enabledPlugins = wysiwygInstance.pluginInfo.instances.drupal;
      // Override the conversion methods to let Drupal plugins modify the data.
      var editor = ev.editor;
      if (editor.dataProcessor && enabledPlugins) {
        editor.dataProcessor.toHtml = CKEDITOR.tools.override(editor.dataProcessor.toHtml, function(originalToHtml) {
          // Convert raw data for display in WYSIWYG mode.
          return function(data, fixForBody) {
            for (var plugin in enabledPlugins) {
              if (typeof Drupal.wysiwyg.plugins[plugin].attach == 'function') {
                data = Drupal.wysiwyg.plugins[plugin].attach(data, wysiwygInstance.pluginInfo.global.drupal[plugin], editor.name);
                data = wysiwygInstance.prepareContent(data);
              }
            }
            return originalToHtml.call(this, data, fixForBody);
          };
        });
        editor.dataProcessor.toDataFormat = CKEDITOR.tools.override(editor.dataProcessor.toDataFormat, function(originalToDataFormat) {
          // Convert WYSIWYG mode content to raw data.
          return function(data, fixForBody) {
            data = originalToDataFormat.call(this, data, fixForBody);
            for (var plugin in enabledPlugins) {
              if (typeof Drupal.wysiwyg.plugins[plugin].detach == 'function') {
                data = Drupal.wysiwyg.plugins[plugin].detach(data, wysiwygInstance.pluginInfo.global.drupal[plugin], editor.name);
              }
            }
            return data;
          };
        });
      }
    },

    selectionChange: function (event) {
      var wysiwygInstance = instanceMap[this.name];
      var enabledPlugins = wysiwygInstance.pluginInfo.instances.drupal;
      for (var name in enabledPlugins) {
        var plugin = Drupal.wysiwyg.plugins[name];
        if ($.isFunction(plugin.isNode)) {
          var node = event.data.selection.getSelectedElement();
          var state = plugin.isNode(node ? node.$ : null) ? CKEDITOR.TRISTATE_ON : CKEDITOR.TRISTATE_OFF;
          event.editor.getCommand(name).setState(state);
        }
      }
    },

    focus: function(ev) {
      Drupal.wysiwyg.activeId = ev.editor.name;
    },

    afterCommandExec: function(ev) {
      // Fix Drupal toolbar obscuring editor toolbar in fullscreen mode.
      if (ev.data.name != 'maximize') {
        return;
      }
      if (ev.data.command.state == CKEDITOR.TRISTATE_ON) {
        Drupal.wysiwyg.utilities.onFullscreenEnter();
      }
      else {
        Drupal.wysiwyg.utilities.onFullscreenExit();
      }
    },

    destroy: function (event) {
      // Free our reference to the private instance to not risk memory leaks.
      delete instanceMap[this.name];
    }
  };
  instanceMap[params.field] = this;
  // Attach editor.
  var editorInstance = CKEDITOR.replace(params.field, settings);
};

/**
 * Detach a single editor instance.
 */
Drupal.wysiwyg.editor.detach.ckeditor = function (context, params, trigger) {
  var method = (trigger == 'serialize') ? 'updateElement' : 'destroy';
  var instance = CKEDITOR.instances[params.field];
  if (!instance) {
    return;
  }
  instance[method]();
};

Drupal.wysiwyg.editor.instance.ckeditor = {

  // Flag indicating if the first save snapshot event has fired.
  firstSaveSnapshot: true,

  addPlugin: function (pluginName, pluginSettings) {
    CKEDITOR.plugins.add(pluginName, {
      // Wrap Drupal plugin in a proxy plugin.
      init: function(editor) {
        if (pluginSettings.css) {
          editor.on('mode', function(ev) {
            if (ev.editor.mode == 'wysiwyg') {
              // Inject CSS files directly into the editing area head tag.
              var iframe = $('#cke_contents_' + ev.editor.name + ' iframe, #' + ev.editor.id + '_contents iframe');
              $('head', iframe.eq(0).contents()).append('<link rel="stylesheet" href="' + pluginSettings.css + '" type="text/css" >');
            }
          });
        }
        if (typeof Drupal.wysiwyg.plugins[pluginName].invoke == 'function') {
          var pluginCommand = {
            exec: function (editor) {
              var data = { format: 'html', node: null, content: '' };
              var selection = editor.getSelection();
              if (selection) {
                data.node = selection.getSelectedElement();
                if (data.node) {
                  data.node = data.node.$;
                }
                if (selection.getType() == CKEDITOR.SELECTION_TEXT) {
                  if (selection.getSelectedText) {
                    data.content = selection.getSelectedText();
                  }
                  else {
                    // Pre v3.6.1.
                    if (CKEDITOR.env.ie) {
                      data.content = selection.getNative().createRange().text;
                    }
                    else {
                      data.content = selection.getNative().toString();
                    }
                  }
                }
                else if (data.node) {
                  // content is supposed to contain the "outerHTML".
                  data.content = data.node.parentNode.innerHTML;
                }
              }
              Drupal.wysiwyg.plugins[pluginName].invoke(data, pluginSettings, editor.name);
            }
          };
          editor.addCommand(pluginName, pluginCommand);
        }
        editor.ui.addButton(pluginName, {
          label: pluginSettings.title,
          command: pluginName,
          icon: pluginSettings.icon
        });

        // @todo Add button state handling.
      }
    });
  },
  prepareContent: function(content) {
    // @todo Don't know if we need this yet.
    return content;
  },

  insert: function(content) {
    content = this.prepareContent(content);
    if (CKEDITOR.version.split('.')[0] === '3' && (CKEDITOR.env.webkit || CKEDITOR.env.chrome || CKEDITOR.env.opera || CKEDITOR.env.safari)) {
      // Works around a WebKit bug which removes wrapper elements.
      // @see https://drupal.org/node/1927968
      var tmp = new CKEDITOR.dom.element('div'), children, skip = 0, item;
      tmp.setHtml(content);
      children = tmp.getChildren();
      skip = 0;
      while (children.count() > skip) {
        item = children.getItem(skip);
        switch(item.type) {
          case 1:
            CKEDITOR.instances[this.field].insertElement(item);
            break;
          case 3:
            CKEDITOR.instances[this.field].insertText(item.getText());
            skip++;
            break;
          case 8:
            CKEDITOR.instances[this.field].insertHtml(item.getOuterHtml());
            skip++;
            break;
        }
      }
    }
    else {
      CKEDITOR.instances[this.field].insertHtml(content);
    }
  },

  setContent: function (content) {
    CKEDITOR.instances[this.field].setData(content);
  },

  getContent: function () {
    return CKEDITOR.instances[this.field].getData();
  },

  isFullscreen: function () {
    var cmd = CKEDITOR.instances[this.field].commands.maximize;
    return !!(cmd && cmd.state == CKEDITOR.TRISTATE_ON);
  }
};

})(jQuery);
;
(function($) {

/**
 * Attach this editor to a target element.
 *
 * @param context
 *   A DOM element, supplied by Drupal.attachBehaviors().
 * @param params
 *   An object containing input format parameters. Default parameters are:
 *   - editor: The internal editor name.
 *   - theme: The name/key of the editor theme/profile to use.
 *   - field: The CSS id of the target element.
 * @param settings
 *   An object containing editor settings for all enabled editor themes.
 */
Drupal.wysiwyg.editor.attach.none = function(context, params, settings) {
  var $field = this.$field;
  if (params.resizable) {
    var $wrapper = $field.parents('.form-textarea-wrapper:first');
    $wrapper.addClass('resizable');
    if (Drupal.behaviors.textarea) {
      Drupal.behaviors.textarea.attach(context);
    }
  }
  // This helper looks for changes on the supplied element and notifies Wysiwyg
  // when contents have changed. If the editor provides equivalent events it is
  // sufficient to call this.contentsChanged() directly on such events. Multiple
  // helpers may be added and can put conditions on when the notification is
  // actually passed along to Wysiwyg. All watchers are removed automatically
  // after an instance is destroyed, or by calling this.stopWatching().
  this.startWatching($field);
};

/**
 * Detach a single editor instance.
 *
 * The editor syncs its contents back to the original field before its instance
 * is removed.
 *
 * In here, 'this' is an instance of WysiwygInternalInstance.
 * See Drupal.wysiwyg.editor.instance.none for more details.
 *
 * @param context
 *   A DOM element, supplied by Drupal.attachBehaviors().
 * @param params
 *   An object containing input format parameters. Only the editor instance in
 *   params.field should be detached and saved, so its data can be submitted in
 *   AJAX/AHAH applications.
 * @param trigger
 *   A string describing why the editor is being detached.
 *   Possible triggers are:
 *   - unload: (default) Another or no editor is about to take its place.
 *   - move: Currently expected to produce the same result as unload.
 *   - serialize: The form is about to be serialized before an AJAX request or
 *     a normal form submission. If possible, perform a quick detach and leave
 *     the editor's GUI elements in place to avoid flashes or scrolling issues.
 * @see Drupal.detachBehaviors
 */
Drupal.wysiwyg.editor.detach.none = function (context, params, trigger) {
  if (trigger != 'serialize') {
    // This will be called before any editor instances exist.
    var $field = $('#' + params.field, context);
    var $wrapper = $field.parents('.form-textarea-wrapper:first');
    $wrapper.removeOnce('textarea').removeClass('.resizable-textarea').removeClass('resizable')
      .find('.grippie').remove();
  }
};

/**
 * Instance methods for plain text areas.
 */
Drupal.wysiwyg.editor.instance.none = {
  insert: function(content) {
    var editor = document.getElementById(this.field);

    // IE support.
    if (document.selection) {
      editor.focus();
      var sel = document.selection.createRange();
      sel.text = content;
    }
    // Mozilla/Firefox/Netscape 7+ support.
    else if (editor.selectionStart || editor.selectionStart == '0') {
      var startPos = editor.selectionStart;
      var endPos = editor.selectionEnd;
      editor.value = editor.value.substring(0, startPos) + content + editor.value.substring(endPos, editor.value.length);
    }
    // Fallback, just add to the end of the content.
    else {
      editor.value += content;
    }
  },

  setContent: function (content) {
    $('#' + this.field).val(content);
  },

  getContent: function () {
    return $('#' + this.field).val();
  }
};

})(jQuery);
;

/**
 *  @file
 *  Attach Media WYSIWYG behaviors.
 */

(function ($) {

Drupal.media = Drupal.media || {};

/**
 * Register the plugin with WYSIWYG.
 */
Drupal.wysiwyg.plugins.media = {

  /**
   * The selected text string.
   */
  selectedText: null,

  /**
   * Determine whether a DOM element belongs to this plugin.
   *
   * @param node
   *   A DOM element
   */
  isNode: function(node) {
    return $(node).is('img[data-media-element]');
  },

  /**
   * Execute the button.
   *
   * @param data
   *   An object containing data about the current selection:
   *   - format: 'html' when the passed data is HTML content, 'text' when the
   *     passed data is plain-text content.
   *   - node: When 'format' is 'html', the focused DOM element in the editor.
   *   - content: The textual representation of the focused/selected editor
   *     content.
   * @param settings
   *   The plugin settings, as provided in the plugin's PHP include file.
   * @param instanceId
   *   The ID of the current editor instance.
   */
  invoke: function (data, settings, instanceId) {
    if (data.format == 'html') {
      var insert = new InsertMedia(instanceId);
      // CKEDITOR module support doesn't set this setting
      if (typeof settings['global'] === 'undefined') {
        settings['global'] = {id: 'media_wysiwyg'};
      }
      if (this.isNode(data.node)) {
        // Change the view mode for already-inserted media.
        var media_file = Drupal.media.filter.extract_file_info($(data.node));
        insert.onSelect([media_file]);
      }
      else {
        // Store currently selected text.
        this.selectedText = data.content;

        // Insert new media.
        insert.prompt(settings.global);
      }
    }
  },

  /**
   * Attach function, called when a rich text editor loads.
   * This finds all [[tags]] and replaces them with the html
   * that needs to show in the editor.
   *
   * This finds all JSON macros and replaces them with the HTML placeholder
   * that will show in the editor.
   */
  attach: function (content, settings, instanceId) {
    content = Drupal.media.filter.replaceTokenWithPlaceholder(content);
    return content;
  },

  /**
   * Detach function, called when a rich text editor detaches
   */
  detach: function (content, settings, instanceId) {
    content = Drupal.media.filter.replacePlaceholderWithToken(content);
    return content;
  }
};
/**
 * Defining InsertMedia object to manage the sequence of actions involved in
 * inserting a media element into the WYSIWYG.
 * Keeps track of the WYSIWYG instance id.
 */
var InsertMedia = function (instance_id) {
  this.instanceId = instance_id;
  return this;
};

InsertMedia.prototype = {
  /**
   * Prompt user to select a media item with the media browser.
   *
   * @param settings
   *    Settings object to pass on to the media browser.
   *    TODO: Determine if this is actually necessary.
   */
  prompt: function (settings) {
    Drupal.media.popups.mediaBrowser($.proxy(this, 'onSelect'), settings);
  },

  /**
   * On selection of a media item, display item's display configuration form.
   */
  onSelect: function (media_files) {
    this.mediaFile = media_files[0];
    Drupal.media.popups.mediaStyleSelector(this.mediaFile, $.proxy(this, 'insert'), {});
  },

  /**
   * When display config has been set, insert the placeholder markup into the
   * wysiwyg and generate its corresponding json macro pair to be added to the
   * tagmap.
   */
  insert: function (formatted_media) {
    var element = Drupal.media.filter.create_element(formatted_media.html, {
          fid: this.mediaFile.fid,
          view_mode: formatted_media.type,
          attributes: this.mediaFile.attributes,
          fields: formatted_media.options,
          link_text: Drupal.wysiwyg.plugins.media.selectedText
        });
    // Get the markup and register it for the macro / placeholder handling.
    var markup = Drupal.media.filter.getWysiwygHTML(element);

    // Insert placeholder markup into wysiwyg.
    Drupal.wysiwyg.instances[this.instanceId].insert(markup);
  }
};

/** Helper functions */

/**
 * Ensures the tag map has been initialized.
 */
function ensure_tagmap () {
  return Drupal.media.filter.ensure_tagmap();
}

/**
 * Serializes file information as a url-encoded JSON object and stores it as a
 * data attribute on the html element.
 *
 * @param html (string)
 *    A html element to be used to represent the inserted media element.
 * @param info (object)
 *    A object containing the media file information (fid, view_mode, etc).
 *
 * @deprecated
 */
function create_element (html, info) {
  return Drupal.media.filter.create_element(html, info);
}

/**
 * Create a macro representation of the inserted media element.
 *
 * @param element (jQuery object)
 *    A media element with attached serialized file info.
 *
 * @deprecated
 */
function create_macro (element) {
  return Drupal.media.filter.create_macro(element);
}

/**
 * Extract the file info from a WYSIWYG placeholder element as JSON.
 *
 * @param element (jQuery object)
 *    A media element with attached serialized file info.
 *
 * @deprecated
 */
function extract_file_info (element) {
  return Drupal.media.filter.extract_file_info(element);
}

/**
 * Gets the HTML content of an element.
 *
 * @param element (jQuery object)
 *
 * @deprecated
 */
function outerHTML (element) {
  return Drupal.media.filter.outerHTML(element);
}

})(jQuery);
;
(function ($) {

// @todo Array syntax required; 'break' is a predefined token in JavaScript.
Drupal.wysiwyg.plugins['break'] = {

  /**
   * Return whether the passed node belongs to this plugin.
   */
  isNode: function(node) {
    return ($(node).is('img.wysiwyg-break'));
  },

  /**
   * Execute the button.
   */
  invoke: function(data, settings, instanceId) {
    if (data.format == 'html') {
      // Prevent duplicating a teaser break.
      if ($(data.node).is('img.wysiwyg-break')) {
        return;
      }
      var content = this._getPlaceholder(settings);
    }
    else {
      // Prevent duplicating a teaser break.
      // @todo data.content is the selection only; needs access to complete content.
      if (data.content.match(/<!--break-->/)) {
        return;
      }
      var content = '<!--break-->';
    }
    if (typeof content != 'undefined') {
      Drupal.wysiwyg.instances[instanceId].insert(content);
    }
  },

  /**
   * Replace all <!--break--> tags with images.
   */
  attach: function(content, settings, instanceId) {
    content = content.replace(/<!--break-->/g, this._getPlaceholder(settings));
    return content;
  },

  /**
   * Replace images with <!--break--> tags in content upon detaching editor.
   */
  detach: function(content, settings, instanceId) {
    var $content = $('<div>' + content + '</div>'); // No .outerHTML() in jQuery :(
    // #404532: document.createComment() required or IE will strip the comment.
    // #474908: IE 8 breaks when using jQuery methods to replace the elements.
    // @todo Add a generic implementation for all Drupal plugins for this.
    $.each($('img.wysiwyg-break', $content), function (i, elem) {
      elem.parentNode.insertBefore(document.createComment('break'), elem);
      elem.parentNode.removeChild(elem);
    });
    return $content.html();
  },

  /**
   * Helper function to return a HTML placeholder.
   */
  _getPlaceholder: function (settings) {
    return '<img src="' + settings.path + '/images/spacer.gif" alt="&lt;--break-&gt;" title="&lt;--break--&gt;" class="wysiwyg-break drupal-content" />';
  }
};

})(jQuery);
;
(function ($) {

Drupal.behaviors.textarea = {
  attach: function (context, settings) {
    $('.form-textarea-wrapper.resizable', context).once('textarea', function () {
      var staticOffset = null;
      var textarea = $(this).addClass('resizable-textarea').find('textarea');
      var grippie = $('<div class="grippie"></div>').mousedown(startDrag);

      grippie.insertAfter(textarea);

      function startDrag(e) {
        staticOffset = textarea.height() - e.pageY;
        textarea.css('opacity', 0.25);
        $(document).mousemove(performDrag).mouseup(endDrag);
        return false;
      }

      function performDrag(e) {
        textarea.height(Math.max(32, staticOffset + e.pageY) + 'px');
        return false;
      }

      function endDrag(e) {
        $(document).unbind('mousemove', performDrag).unbind('mouseup', endDrag);
        textarea.css('opacity', 1);
      }
    });
  }
};

})(jQuery);
;

(function ($) {

/**
 * Auto-hide summary textarea if empty and show hide and unhide links.
 */
Drupal.behaviors.textSummary = {
  attach: function (context, settings) {
    $('.text-summary', context).once('text-summary', function () {
      var $widget = $(this).closest('div.field-type-text-with-summary');
      var $summaries = $widget.find('div.text-summary-wrapper');

      $summaries.once('text-summary-wrapper').each(function(index) {
        var $summary = $(this);
        var $summaryLabel = $summary.find('label').first();
        var $full = $widget.find('.text-full').eq(index).closest('.form-item');
        var $fullLabel = $full.find('label').first();

        // Create a placeholder label when the field cardinality is
        // unlimited or greater than 1.
        if ($fullLabel.length == 0) {
          $fullLabel = $('<label></label>').prependTo($full);
        }

        // Setup the edit/hide summary link.
        var $link = $('<span class="field-edit-link">(<a class="link-edit-summary" href="#">' + Drupal.t('Hide summary') + '</a>)</span>');
        var $a = $link.find('a');
        var toggleClick = true;
        $link.bind('click', function (e) {
          if (toggleClick) {
            $summary.hide();
            $a.html(Drupal.t('Edit summary'));
            $link.appendTo($fullLabel);
          }
          else {
            $summary.show();
            $a.html(Drupal.t('Hide summary'));
            $link.appendTo($summaryLabel);
          }
          toggleClick = !toggleClick;
          return false;
        }).appendTo($summaryLabel);

        // If no summary is set, hide the summary field.
        if ($(this).find('.text-summary').val() == '') {
          $link.click();
        }
      });
    });
  }
};

})(jQuery);
;

/**
 * @file: Popup dialog interfaces for the media project.
 *
 * Drupal.media.popups.mediaBrowser
 *   Launches the media browser which allows users to pick a piece of media.
 *
 * Drupal.media.popups.mediaStyleSelector
 *  Launches the style selection form where the user can choose what
 *  format/style they want their media in.
 */

(function ($) {
namespace('Drupal.media.popups');

/**
 * Media browser popup. Creates a media browser dialog.
 *
 * @param {function}
 *   onSelect Callback for when dialog is closed, received (Array media, Object
 *   extra);
 * @param {Object}
 *   globalOptions Global options that will get passed upon initialization of
 *   the browser. @see Drupal.media.popups.mediaBrowser.getDefaults();
 * @param {Object}
 *   pluginOptions Options for specific plugins. These are passed to the plugin
 *   upon initialization.  If a function is passed here as a callback, it is
 *   obviously not passed, but is accessible to the plugin in
 *   Drupal.settings.variables. Example:
 *   pluginOptions = {library: {url_include_patterns:'/foo/bar'}};
 * @param {Object}
 *   widgetOptions Options controlling the appearance and behavior of the modal
 *   dialog. @see Drupal.media.popups.mediaBrowser.getDefaults();
 */
Drupal.media.popups.mediaBrowser = function (onSelect, globalOptions, pluginOptions, widgetOptions) {
  // Get default dialog options.
  var options = Drupal.media.popups.mediaBrowser.getDefaults();

  // Add global, plugin and widget options.
  options.global = $.extend({}, options.global, globalOptions);
  options.plugins = pluginOptions;
  options.widget = $.extend({}, options.widget, widgetOptions);

  // Find the URL of the modal iFrame.
  var browserSrc = options.widget.src;

  if ($.isArray(browserSrc) && browserSrc.length) {
    browserSrc = browserSrc[browserSrc.length - 1];
  }

  // Create an array of parameters to send along to the iFrame.
  var params = {};

  // Add global field widget settings and plugin information.
  $.extend(params, options.global);
  params.plugins = options.plugins;

  // Append the list of parameters to the iFrame URL as query parameters.
  browserSrc += '&' + $.param(params);

  // Create an iFrame with the iFrame URL.
  var mediaIframe = Drupal.media.popups.getPopupIframe(browserSrc, 'mediaBrowser');

  // Attach an onLoad event.
  mediaIframe.bind('load', options, options.widget.onLoad);

  // Create an array of Dialog options.
  var dialogOptions = options.dialog;

  // Setup the dialog buttons.
  var ok = Drupal.t('OK');
  var notSelected = Drupal.t('You have not selected anything!');

  dialogOptions.buttons[ok] = function () {
    // Find the current file selection.
    var selected = this.contentWindow.Drupal.media.browser.selectedMedia;

    // Alert the user if a selection has yet to be made.
    if (selected.length < 1) {
      alert(notSelected);

      return;
    }

    // Select the file.
    onSelect(selected);

    // Close the dialog.
    $(this).dialog('close');
  };

  // Create a jQuery UI dialog with the given options.
  var dialog = mediaIframe.dialog(dialogOptions);

  // Allow the dialog to react to re-sizing, scrolling, etc.
  Drupal.media.popups.sizeDialog(dialog);
  Drupal.media.popups.resizeDialog(dialog);
  Drupal.media.popups.scrollDialog(dialog);
  Drupal.media.popups.overlayDisplace(dialog.parents(".ui-dialog"));

  return mediaIframe;
};

/**
 * Retrieves a list of default settings for the media browser.
 *
 * @return
 *   An array of default settings.
 */
Drupal.media.popups.mediaBrowser.getDefaults = function () {
  return {
    global: {
      types: [], // Types to allow, defaults to all.
      enabledPlugins: [] // If provided, a list of plugins which should be enabled.
    },
    widget: { // Settings for the actual iFrame which is launched.
      src: Drupal.settings.media.browserUrl, // Src of the media browser (if you want to totally override it)
      onLoad: Drupal.media.popups.mediaBrowser.mediaBrowserOnLoad // Onload function when iFrame loads.
    },
    dialog: Drupal.media.popups.getDialogOptions()
  };
};

/**
 * Sets up the iFrame buttons.
 */
Drupal.media.popups.mediaBrowser.mediaBrowserOnLoad = function (e) {
  var options = e.data;

  // Ensure that the iFrame is defined.
  if (typeof this.contentWindow.Drupal.media === 'undefined' || typeof
  this.contentWindow.Drupal.media.browser === 'undefined') {
    return;
  }

  // Check if a selection has been made and press the 'ok' button.
  if (this.contentWindow.Drupal.media.browser.selectedMedia.length > 0) {
    var ok = Drupal.t('OK');
    var ok_func = $(this).dialog('option', 'buttons')[ok];

    ok_func.call(this);

    return;
  }
};

/**
 * Finalizes the selection of a file.
 *
 * Alerts the user if a selection has yet to be made, triggers the file
 * selection and closes the modal dialog.
 */
Drupal.media.popups.mediaBrowser.finalizeSelection = function () {
  // Find the current file selection.
  var selected = this.contentWindow.Drupal.media.browser.selectedMedia;

  // Alert the user if a selection has yet to be made.
  if (selected.length < 1) {
    alert(notSelected);

    return;
  }

  // Select the file.
  onSelect(selected);

  // Close the dialog.
  $(this).dialog('close');
};

/**
 * Style chooser Popup. Creates a dialog for a user to choose a media style.
 *
 * @param mediaFile
 *   The mediaFile you are requesting this formatting form for.
 *   @todo: should this be fid? That's actually all we need now.
 *
 * @param Function
 *   onSubmit Function to be called when the user chooses a media style. Takes
 *   one parameter (Object formattedMedia).
 *
 * @param Object
 *   options Options for the mediaStyleChooser dialog.
 */
Drupal.media.popups.mediaStyleSelector = function (mediaFile, onSelect, options) {
  var defaults = Drupal.media.popups.mediaStyleSelector.getDefaults();

  // @todo: remove this awful hack :(
  if (typeof defaults.src === 'string' ) {
    defaults.src = defaults.src.replace('-media_id-', mediaFile.fid) + '&fields=' + encodeURIComponent(JSON.stringify(mediaFile.fields));
  }
  else {
    var src = defaults.src.shift();

    defaults.src.unshift(src);
    defaults.src = src.replace('-media_id-', mediaFile.fid) + '&fields=' + encodeURIComponent(JSON.stringify(mediaFile.fields));
  }

  options = $.extend({}, defaults, options);

  // Create an iFrame with the iFrame URL.
  var mediaIframe = Drupal.media.popups.getPopupIframe(options.src, 'mediaStyleSelector');

  // Attach an onLoad event.
  mediaIframe.bind('load', options, options.onLoad);

  // Create an array of Dialog options.
  var dialogOptions = Drupal.media.popups.getDialogOptions();

  // Setup the dialog buttons.
  var ok = Drupal.t('OK');
  var notSelected = Drupal.t('Very sorry, there was an unknown error embedding media.');

  dialogOptions.buttons[ok] = function () {
    // Find the current file selection.
    var formattedMedia = this.contentWindow.Drupal.media.formatForm.getFormattedMedia();
    formattedMedia.options = $.extend({}, mediaFile.attributes, formattedMedia.options);

    // Alert the user if a selection has yet to be made.
    if (!formattedMedia) {
      alert(notSelected);

      return;
    }

    // Select the file.
    onSelect(formattedMedia);

    // Close the dialog.
    $(this).dialog('close');
  };

  // Create a jQuery UI dialog with the given options.
  var dialog = mediaIframe.dialog(dialogOptions);

  // Allow the dialog to react to re-sizing, scrolling, etc.
  Drupal.media.popups.sizeDialog(dialog);
  Drupal.media.popups.resizeDialog(dialog);
  Drupal.media.popups.scrollDialog(dialog);
  Drupal.media.popups.overlayDisplace(dialog.parents(".ui-dialog"));

  return mediaIframe;
};

Drupal.media.popups.mediaStyleSelector.mediaBrowserOnLoad = function (e) {
};

Drupal.media.popups.mediaStyleSelector.getDefaults = function () {
  return {
    src: Drupal.settings.media.styleSelectorUrl,
    onLoad: Drupal.media.popups.mediaStyleSelector.mediaBrowserOnLoad
  };
};

/**
 * Style chooser Popup. Creates a dialog for a user to choose a media style.
 *
 * @param mediaFile
 *   The mediaFile you are requesting this formatting form for.
 *   @todo: should this be fid? That's actually all we need now.
 *
 * @param Function
 *   onSubmit Function to be called when the user chooses a media style. Takes
 *   one parameter (Object formattedMedia).
 *
 * @param Object
 *   options Options for the mediaStyleChooser dialog.
 */
Drupal.media.popups.mediaFieldEditor = function (fid, onSelect, options) {
  var defaults = Drupal.media.popups.mediaFieldEditor.getDefaults();

  // @todo: remove this awful hack :(
  defaults.src = defaults.src.replace('-media_id-', fid);
  options = $.extend({}, defaults, options);

  // Create an iFrame with the iFrame URL.
  var mediaIframe = Drupal.media.popups.getPopupIframe(options.src, 'mediaFieldEditor');

  // Attach an onLoad event.
  mediaIframe.bind('load', options, options.onLoad);

  // Create an array of Dialog options.
  var dialogOptions = Drupal.media.popups.getDialogOptions();

  // Setup the dialog buttons.
  var ok = Drupal.t('OK');
  var notSelected = Drupal.t('Very sorry, there was an unknown error embedding media.');

  dialogOptions.buttons[ok] = function () {
    // Find the current file selection.
    var formattedMedia = this.contentWindow.Drupal.media.formatForm.getFormattedMedia();

    // Alert the user if a selection has yet to be made.
    if (!formattedMedia) {
      alert(notSelected);

      return;
    }

    // Select the file.
    onSelect(formattedMedia);

    // Close the dialog.
    $(this).dialog('close');
  };

  // Create a jQuery UI dialog with the given options.
  var dialog = mediaIframe.dialog(dialogOptions);

  // Allow the dialog to react to re-sizing, scrolling, etc.
  Drupal.media.popups.sizeDialog(dialog);
  Drupal.media.popups.resizeDialog(dialog);
  Drupal.media.popups.scrollDialog(dialog);
  Drupal.media.popups.overlayDisplace(dialog);

  return mediaIframe;
};

Drupal.media.popups.mediaFieldEditor.mediaBrowserOnLoad = function (e) {

};

Drupal.media.popups.mediaFieldEditor.getDefaults = function () {
  return {
    // @todo: do this for real
    src: '/media/-media_id-/edit?render=media-popup',
    onLoad: Drupal.media.popups.mediaFieldEditor.mediaBrowserOnLoad
  };
};

/**
 * Generic functions to both the media-browser and style selector.
 */

/**
 * Returns the commonly used options for the dialog.
 */
Drupal.media.popups.getDialogOptions = function () {
  return {
    title: Drupal.t('Media browser'),
    buttons: {},
    dialogClass: Drupal.settings.media.dialogOptions.dialogclass,
    modal: Drupal.settings.media.dialogOptions.modal,
    draggable: Drupal.settings.media.dialogOptions.draggable,
    resizable: Drupal.settings.media.dialogOptions.resizable,
    minWidth: Drupal.settings.media.dialogOptions.minwidth,
    width: Drupal.settings.media.dialogOptions.width,
    height: Drupal.settings.media.dialogOptions.height,
    position: Drupal.settings.media.dialogOptions.position,
    overlay: {
      backgroundColor: Drupal.settings.media.dialogOptions.overlay.backgroundcolor,
      opacity: Drupal.settings.media.dialogOptions.overlay.opacity
    },
    zIndex: Drupal.settings.media.dialogOptions.zindex,
    close: function (event, ui) {
      var elem = $(event.target);
      var id = elem.attr('id');
      if(id == 'mediaStyleSelector') {
        $(this).dialog("destroy");
        $('#mediaStyleSelector').remove();
      }
      else {
        $(this).dialog("destroy");
        $('#mediaBrowser').remove();
      }
    }
  };
};

/**
 * Get an iframe to serve as the dialog's contents. Common to both plugins.
 */
Drupal.media.popups.getPopupIframe = function (src, id, options) {
  var defaults = {width: '100%', scrolling: 'auto'};
  var options = $.extend({}, defaults, options);

  return $('<iframe class="media-modal-frame" tabindex="0"/>')
  .attr('src', src)
  .attr('width', options.width)
  .attr('id', id)
  .attr('scrolling', options.scrolling);
};

Drupal.media.popups.overlayDisplace = function (dialog) {
  if (parent.window.Drupal.overlay && jQuery.isFunction(parent.window.Drupal.overlay.getDisplacement)) {
    var overlayDisplace = parent.window.Drupal.overlay.getDisplacement('top');

    if (dialog.offset().top < overlayDisplace) {
      dialog.css('top', overlayDisplace);
    }
  }
}

/**
 * Size the dialog when it is first loaded and keep it centered when scrolling.
 *
 * @param jQuery dialogElement
 *  The element which has .dialog() attached to it.
 */
Drupal.media.popups.sizeDialog = function (dialogElement) {
  if (!dialogElement.is(':visible')) {
    return;
  }

  var windowWidth = $(window).width();
  var dialogWidth = windowWidth * 0.8;
  var windowHeight = $(window).height();
  var dialogHeight = windowHeight * 0.8;

  dialogElement.dialog("option", "width", dialogWidth);
  dialogElement.dialog("option", "height", dialogHeight);
  dialogElement.dialog("option", "position", 'center');

  $('.media-modal-frame').width('100%');
}

/**
 * Resize the dialog when the window changes.
 *
 * @param jQuery dialogElement
 *  The element which has .dialog() attached to it.
 */
Drupal.media.popups.resizeDialog = function (dialogElement) {
  $(window).resize(function() {
    Drupal.media.popups.sizeDialog(dialogElement);
  });
}

/**
 * Keeps the dialog centered when the window is scrolled.
 *
 * @param jQuery dialogElement
 *  The element which has .dialog() attached to it.
 */
Drupal.media.popups.scrollDialog = function (dialogElement) {
  // Keep the dialog window centered when scrolling.
  $(window).scroll(function() {
    if (!dialogElement.is(':visible')) {
      return;
    }

    dialogElement.dialog("option", "position", 'center');
  });
}

})(jQuery);
;
(function ($) {

/**
 * Automatically display the guidelines of the selected text format.
 */
Drupal.behaviors.filterGuidelines = {
  attach: function (context) {
    $('.filter-guidelines', context).once('filter-guidelines')
      .find(':header').hide()
      .closest('.filter-wrapper').find('select.filter-list')
      .bind('change', function () {
        $(this).closest('.filter-wrapper')
          .find('.filter-guidelines-item').hide()
          .siblings('.filter-guidelines-' + this.value).show();
      })
      .change();
  }
};

})(jQuery);
;
/**
 *  @file
 *  File with utilities to handle media in html editing.
 */
(function ($) {

  Drupal.media = Drupal.media || {};
  /**
   * Utility to deal with media tokens / placeholders.
   */
  Drupal.media.filter = {
    /**
     * Replaces media tokens with the placeholders for html editing.
     * @param content
     */
    replaceTokenWithPlaceholder: function(content) {
      Drupal.media.filter.ensure_tagmap();
      var matches = content.match(/\[\[.*?\]\]/g);

      if (matches) {
        for (var i = 0; i < matches.length; i++) {
          var match = matches[i];
          if (match.indexOf('"type":"media"') == -1) {
            continue;
          }

          // Check if the macro exists in the tagmap. This ensures backwards
          // compatibility with existing media and is moderately more efficient
          // than re-building the element.
          var media = Drupal.settings.tagmap[match];
          var media_json = match.replace('[[', '').replace(']]', '');

          // Ensure that the media JSON is valid.
          try {
            var media_definition = JSON.parse(media_json);
          }
          catch (err) {
            // @todo: error logging.
            // Content should be returned to prevent an empty editor.
            return content;
          }

          // Re-build the media if the macro has changed from the tagmap.
          if (!media && media_definition.fid) {
            Drupal.media.filter.ensureSourceMap();
            var source;
            if (source = Drupal.settings.mediaSourceMap[media_definition.fid]) {
              media = document.createElement(source.tagName);
              media.src = source.src;
              media.innerHTML = source.innerHTML;
            }
            else {
              // If the media element can't be found, leave it in to be resolved
              // by the user later.
              continue;
            }
          }

          // Apply attributes.
          var element = Drupal.media.filter.create_element(media, media_definition);
          var markup  = Drupal.media.filter.outerHTML(element);

          // Use split and join to replace all instances of macro with markup.
          content = content.split(match).join(markup);
        }
      }

      return content;
    },

    /**
     * Returns alt and title field attribute data from the corresponding fields.
     *
     * Specifically looks for file_entity module's file_image_alt_text and
     * file_image_title_text fields as those are by default used to store
     * override values for image alt and title attributes.
     *
     * @param options (array)
     *   Options passed through a popup form submission.
     * @param includeFieldID (bool)
     *   If set, the returned object will have extra keys with the IDs of the
     *   found fields.
     *
     * If the alt or title fields were not found, their keys will be excluded
     * from the returned array.
     *
     * @return
     *   An object with the following keys:
     *   - alt: The value of the alt field.
     *   - altField: The id of the alt field.
     *   - title: The value of the title field.
     *   - titleField: The id of the title field.
     */
    parseAttributeFields: function(options, includeFieldID) {
      var attributes = {};

      for (var field in options) {
        // If the field is set to false, use an empty string for output.
        options[field] = options[field] === false ? '' : options[field];
        //if (field.match(/^field_file_image_alt_text/)) {
        if (field.match(new RegExp('^' + Drupal.settings.media.img_alt_field))) {
          attributes.alt = options[field];
          if (includeFieldID) {
            attributes.altField = field;
          }
        }

        //if (field.match(/^field_file_image_title_text/)) {
        if (field.match(new RegExp('^' + Drupal.settings.media.img_title_field))) {
          attributes.title = options[field];
          if (includeFieldID) {
            attributes.titleField = field;
          }
        }
      }

      return attributes;
    },

    /**
     * Ensures changes made to fielded attributes are done on the fields too.
     *
     * This should be called when creating a macro tag from a placeholder.
     *
     * Changed made to attributes represented by fields are synced back to the
     * corresponding fields, if they exist. The alt/title attribute
     * values encoded in the macro will override the alt/title field values (set
     * in the Media dialog) during rendering of both WYSIWYG placeholders and
     * the final file entity on the server. Syncing makes changes applied to a
     * placeholder's alt/title attribute using native WYSIWYG tools visible in
     * the fields shown in the Media dialog.
     *
     * The reverse should be done when creating a placeholder from a macro tag
     * so changes made in the Media dialog are reflected in the placeholder's
     * alt and title attributes or the values there become stale and the change
     * appears uneffective.
     *
     * @param file_info (object)
     *   A JSON decoded object of the file being inserted/updated.
     */
    syncAttributesToFields: function(file_info) {
      if (!file_info) {
        file_info = {};
      }
      if (!file_info.attributes) {
        file_info.attributes = {};
      }
      if (!file_info.fields) {
        file_info.fields = {};
      }
      var fields = Drupal.media.filter.parseAttributeFields(file_info.fields, true);

      // If the title attribute has changed, ensure the title field is updated.
      var titleAttr = file_info.attributes.title || false;
      if (fields.titleField && (titleAttr !== fields.title)) {
        file_info.fields[fields.titleField] = titleAttr;
      }

      // If the alt attribute has changed, ensure the alt field is updated.
      var altAttr = file_info.attributes.alt || false;
      if (fields.altField && (altAttr !== fields.alt)) {
        file_info.fields[fields.altField] = altAttr;
      }

      return file_info;
    },

    /**
     * Replaces media elements with tokens.
     *
     * @param content (string)
     *   The markup within the wysiwyg instance.
     */
    replacePlaceholderWithToken: function(content) {
      Drupal.media.filter.ensure_tagmap();

      // Locate and process all the media placeholders in the WYSIWYG content.
      var contentElements = $('<div/>');  // TODO: once baseline jQuery is 1.8+, switch to using $.parseHTML(content)
      contentElements.get(0).innerHTML = content;
      var mediaElements = contentElements.find('.media-element');
      if (mediaElements) {
        $(mediaElements).each(function (i) {
          // Attempt to derive a JSON macro representation of the media placeholder.
          // Note: Drupal 7 ships with JQuery 1.4.4, which allows $(this).attr('outerHTML') to retrieve the eement's HTML,
          // but many sites use JQuery update to increate this to 1.6+, which insists on $(this).prop('outerHTML).
          // Until the minimum jQuery is >= 1.6, we need to do this the old-school way.
          // See http://stackoverflow.com/questions/2419749/get-selected-elements-outer-html
          var markup = $(this).get(0).outerHTML;
          if (markup === undefined) {
            // Browser does not support outerHTML DOM property.  Use the more expensive clone method instead.
            markup = $(this).clone().wrap('<div>').parent().html();
          }
          var macro = Drupal.media.filter.create_macro($(markup));
          if (macro) {
            // Replace the placeholder with the macro in the parsed content.
            // (Can't just replace the string section, because the outerHTML may be subtly different,
            // depending on the browser. Parsing tends to convert <img/> to <img>, for instance.)
            Drupal.settings.tagmap[macro] = markup;
            $(this).replaceWith(macro);
          }
        });
        content = $(contentElements).html();
      }

      return content;
    },

    /**
     * Serializes file information as a url-encoded JSON object and stores it
     * as a data attribute on the html element.
     *
     * @param html (string)
     *    A html element to be used to represent the inserted media element.
     * @param info (object)
     *    A object containing the media file information (fid, view_mode, etc).
     */
    create_element: function (html, info) {
      if ($('<div>').append(html).text().length === html.length) {
        // Element is not an html tag. Surround it in a span element so we can
        // pass the file attributes.
        html = '<span>' + html + '</span>';
      }
      var element = $(html);

      // Parse out link wrappers. They will be re-applied when the image is
      // rendered on the front-end.
      if (element.is('a') && element.find('img').length) {
        element = element.children();
      }

      // Extract attributes represented by fields and use those values to keep
      // them in sync, usually alt and title.
      var attributes = Drupal.media.filter.parseAttributeFields(info.fields);
      info.attributes = $.extend(info.attributes, attributes);

      // Move attributes from the file info array to the placeholder element.
      if (info.attributes) {
        $.each(Drupal.settings.media.wysiwyg_allowed_attributes, function(i, a) {
          if (info.attributes[a]) {
            element.attr(a, info.attributes[a]);
          }
          else if (element.attr(a)) {
            // If the element has the attribute, but the value is empty, be
            // sure to clear it.
            element.removeAttr(a);
          }
        });
        delete(info.attributes);

        // Store information to rebuild the element later, if necessary.
        Drupal.media.filter.ensureSourceMap();
        Drupal.settings.mediaSourceMap[info.fid] = {
          tagName: element[0].tagName,
          src: element[0].src,
          innerHTML: element[0].innerHTML
        }
      }

      info.type = info.type || "media";

      // Store the data in the data map.
      Drupal.media.filter.ensureDataMap();

      // Generate a "delta" to allow for multiple embeddings of the same file.
      var delta = Drupal.media.filter.fileEmbedDelta(info.fid, element);
      if (Drupal.settings.mediaDataMap[info.fid]) {
        info.field_deltas = Drupal.settings.mediaDataMap[info.fid].field_deltas || {};
      }
      else {
        info.field_deltas = {};
      }
      info.field_deltas[delta] = info.fields;
      element.attr('data-delta', delta);

      Drupal.settings.mediaDataMap[info.fid] = info;

      // Store the fid in the DOM to retrieve the data from the info map.
      element.attr('data-fid', info.fid);

      // Add data-media-element attribute so we can find the markup element later.
      element.attr('data-media-element', '1')

      var classes = ['media-element'];
      if (info.view_mode) {
        // Remove any existing view mode classes.
        element.removeClass (function (index, css) {
          return (css.match (/\bfile-\S+/g) || []).join(' ');
        });
        classes.push('file-' + info.view_mode.replace(/_/g, '-'));
      }
      // Check for alignment info, after removing any existing alignment class.
      element.removeClass (function (index, css) {
        return (css.match (/\bmedia-wysiwyg-align-\S+/g) || []).join(' ');
      });
      if (info.fields && info.fields.alignment) {
        classes.push('media-wysiwyg-align-' + info.fields.alignment);
      }
      element.addClass(classes.join(' '));

      // Attempt to override the link_title if the user has chosen to do this.
      info.link_text = this.overrideLinkTitle(info);
      // Apply link_text if present.
      if ((info.link_text) && (!info.fields || !info.fields.external_url || info.fields.external_url.length === 0)) {
        $('a', element).html(info.link_text);
      }

      return element;
    },

    /**
     * Create a macro representation of the inserted media element.
     *
     * @param element (jQuery object)
     *    A media element with attached serialized file info.
     */
    create_macro: function (element) {
      var file_info = Drupal.media.filter.extract_file_info(element);
      if (file_info) {
        if (typeof file_info.link_text == 'string') {
          file_info.link_text = this.overrideLinkTitle(file_info);
          // Make sure the link_text-html-tags are properly escaped.
          file_info.link_text = file_info.link_text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        return '[[' + JSON.stringify(file_info) + ']]';
      }
      return false;
    },

    /**
     * Extract the file info from a WYSIWYG placeholder element as JSON.
     *
     * @param element (jQuery object)
     *    A media element with associated file info via a file id (fid).
     */
    extract_file_info: function (element) {
      var fid, file_info, value, delta;

      if (fid = element.data('fid')) {
        Drupal.media.filter.ensureDataMap();

        if (file_info = Drupal.settings.mediaDataMap[fid]) {
          file_info.attributes = {};

          $.each(Drupal.settings.media.wysiwyg_allowed_attributes, function(i, a) {
            if (value = element.attr(a)) {
              // Replace &quot; by \" to avoid error with JSON format.
              if (typeof value == 'string') {
                value = value.replace('&quot;', '\\"');
              }
              file_info.attributes[a] = value;
            }
          });

          // Extract the link text, if there is any.
          file_info.link_text = (Drupal.settings.mediaDoLinkText) ? element.find('a:not(:has(img))').html() : false;
          // When a file is embedded, its fields can be overridden. To allow for
          // the edge case where the same file is embedded multiple times with
          // different field overrides, we look for a data-delta attribute on
          // the element, and use that to decide which set of data in the
          // "field_deltas" property to use.
          if (delta = element.data('delta')) {
            if (file_info.field_deltas && file_info.field_deltas[delta]) {
              file_info.fields = file_info.field_deltas[delta];

              // Also look for an overridden view mode, aka "format".
              // Check for existance of fields to make it backward compatible.
              if (file_info.fields && file_info.fields.format && file_info.view_mode) {
                file_info.view_mode = file_info.fields.format;
              }
            }
          }
        }
        else {
          return false;
        }
      }
      else {
        return false;
      }

      return Drupal.media.filter.syncAttributesToFields(file_info);
    },

    /**
     * Gets the HTML content of an element.
     *
     * @param element (jQuery object)
     */
    outerHTML: function (element) {
      return element[0].outerHTML || $('<div>').append(element.eq(0).clone()).html();
    },

    /**
     * Gets the wrapped HTML content of an element to insert into the wysiwyg.
     *
     * It also registers the element in the tag map so that the token
     * replacement works.
     *
     * @param element (jQuery object) The element to insert.
     *
     * @see Drupal.media.filter.replacePlaceholderWithToken()
     */
    getWysiwygHTML: function (element) {
      // Create the markup and the macro.
      var markup = Drupal.media.filter.outerHTML(element),
        macro = Drupal.media.filter.create_macro(element);

      // Store macro/markup in the tagmap.
      Drupal.media.filter.ensure_tagmap();
      Drupal.settings.tagmap[macro] = markup;

      // Return the html code to insert in an editor and use it with
      // replacePlaceholderWithToken()
      return markup;
    },

    /**
     * Ensures the src tracking has been initialized and returns it.
     */
    ensureSourceMap: function() {
      Drupal.settings.mediaSourceMap = Drupal.settings.mediaSourceMap || {};
      return Drupal.settings.mediaSourceMap;
    },

    /**
     * Ensures the data tracking has been initialized and returns it.
     */
    ensureDataMap: function() {
      Drupal.settings.mediaDataMap = Drupal.settings.mediaDataMap || {};
      return Drupal.settings.mediaDataMap;
    },

    /**
     * Ensures the tag map has been initialized and returns it.
     */
    ensure_tagmap: function () {
      Drupal.settings.tagmap = Drupal.settings.tagmap || {};
      return Drupal.settings.tagmap;
    },

    /**
     * Return the overridden link title based on the file_entity title field
     * set.
     * @param file the file object.
     * @returns the overridden link_title or the existing link text if no
     * overridden.
     */
    overrideLinkTitle: function(file) {
      var file_title_field = Drupal.settings.media.img_title_field.replace('field_', '');
      var file_title_field_machine_name = '';
      if (typeof(file.fields) != 'undefined') {
        jQuery.each(file.fields, function(field, fieldValue) {
          if (field.indexOf(file_title_field) != -1) {
            file_title_field_machine_name = field;
          }
        });

        if (typeof(file.fields[file_title_field_machine_name]) != 'undefined' && file.fields[file_title_field_machine_name] != '') {
          return file.fields[file_title_field_machine_name];
        }
        else {
          return file.link_text;
        }
      }
      else {
        return file.link_text;
      }
    },

    /**
     * Generates a unique "delta" for each embedding of a particular file.
     */
    fileEmbedDelta: function(fid, element) {
      // Ensure we have an object to track our deltas.
      Drupal.settings.mediaDeltas = Drupal.settings.mediaDeltas || {};
      Drupal.settings.maxMediaDelta = Drupal.settings.maxMediaDelta || 0;

      // Check to see if the element already has one.
      if (element && element.data('delta')) {
        var existingDelta = element.data('delta');
        // If so, make sure that it is being tracked in mediaDeltas. If we're
        // going to create new deltas later on, make sure they do not overwrite
        // other mediaDeltas.
        if (!Drupal.settings.mediaDeltas[existingDelta]) {
          Drupal.settings.mediaDeltas[existingDelta] = fid;
          Drupal.settings.maxMediaDelta = Math.max(Drupal.settings.maxMediaDelta, existingDelta);
        }
        return existingDelta;
      }
      // Otherwise, generate a new one.
      var newDelta = Drupal.settings.maxMediaDelta + 1;
      Drupal.settings.mediaDeltas[newDelta] = fid;
      Drupal.settings.maxMediaDelta = newDelta;
      return newDelta;
    }
  }

})(jQuery);
;

(function($) {

Drupal.behaviors.HierarchicalSelect = {
  attach: function (context) {
    $('.hierarchical-select-wrapper:not(.hierarchical-select-wrapper-processed)', context)
    .addClass('hierarchical-select-wrapper-processed').each(function() {
      var hsid = $(this).attr('id').replace(/^hierarchical-select-(.+)-wrapper$/, "$1");
      Drupal.HierarchicalSelect.initialize(hsid);
    });
  }
};

Drupal.HierarchicalSelect = {};

Drupal.HierarchicalSelect.state = [];

Drupal.HierarchicalSelect.context = function() {
  return $("form .hierarchical-select-wrapper");
};

Drupal.HierarchicalSelect.initialize = function(hsid) {
  // Prevent JS errors when Hierarchical Select is loaded dynamically.
  if (undefined == Drupal.settings.HierarchicalSelect || undefined == Drupal.settings.HierarchicalSelect.settings["hs-" + hsid]) {
    return false;
  }

  // If you set Drupal.settings.HierarchicalSelect.pretendNoJS to *anything*,
  // and as such, Hierarchical Select won't initialize its Javascript! It
  // will seem as if your browser had Javascript disabled.
  if (undefined != Drupal.settings.HierarchicalSelect.pretendNoJS) {
    return false;
  }

  var form = $('#hierarchical-select-'+ hsid +'-wrapper').parents('form');

  // Pressing the 'enter' key on a form that contains an HS widget, depending
  // on which browser, usually causes the first submit button to be pressed
  // (likely an HS button).  This results in unpredictable behaviour.  There is
  // no way to determine the 'real' submit button, so disable the enter key.
  form.find('input').keypress(function(event) {
    if (event.keyCode == 13) {
      event.preventDefault();
      return false;
    }
  });

  // Turn off Firefox' autocomplete feature. This causes Hierarchical Select
  // form items to be disabled after a hard refresh.
  // See http://drupal.org/node/453048 and
  // http://www.ryancramer.com/journal/entries/radio_buttons_firefox/
  if (navigator.userAgent.toLowerCase().indexOf('firefox') > -1) {
    form.attr('autocomplete', 'off');
  }

  // Enable *all* submit buttons in this form, as well as all input-related
  // elements of the current hierarchical select, in case we reloaded while
  // they were disabled.
  form.add('#hierarchical-select-' + hsid +'-wrapper .hierarchical-select .selects select')
      .add('#hierarchical-select-' + hsid +'-wrapper .hierarchical-select input')
      .attr('disabled', false);

  if (this.cache != null) {
    this.cache.initialize();
  }

  Drupal.settings.HierarchicalSelect.settings["hs-" + hsid]['updatesEnabled'] = true;
  if (undefined == Drupal.HierarchicalSelect.state["hs-" + hsid]) {
    Drupal.HierarchicalSelect.state["hs-" + hsid] = {};
  }

  this.transform(hsid);
  if (Drupal.settings.HierarchicalSelect.settings["hs-" + hsid].resizable) {
    this.resizable(hsid);
  }
  Drupal.HierarchicalSelect.attachBindings(hsid);

  if (this.cache != null && this.cache.status()) {
    this.cache.load(hsid);
  }

  Drupal.HierarchicalSelect.log(hsid);
};

Drupal.HierarchicalSelect.log = function(hsid, messages) {
  // Only perform logging if logging is enabled.
  if (Drupal.settings.HierarchicalSelect.initialLog == undefined || Drupal.settings.HierarchicalSelect.initialLog["hs-" + hsid] == undefined) {
    return;
  }
  else {
    Drupal.HierarchicalSelect.state["hs-" + hsid].log = [];
  }

  // Store the log messages. The first call to this function may not contain a
  // message: the initial log included in the initial HTML rendering should be
  // used instead..
  if (Drupal.HierarchicalSelect.state["hs-" + hsid].log.length == 0) {
    Drupal.HierarchicalSelect.state["hs-" + hsid].log.push(Drupal.settings.HierarchicalSelect.initialLog["hs-" + hsid]);
  }
  else {
      Drupal.HierarchicalSelect.state["hs-" + hsid].log.push(messages);
  }

  // Print the log messages.
  console.log("HIERARCHICAL SELECT " + hsid);
  var logIndex = Drupal.HierarchicalSelect.state["hs-" + hsid].log.length - 1;
  for (var i = 0; i < Drupal.HierarchicalSelect.state["hs-" + hsid].log[logIndex].length; i++) {
    console.log(Drupal.HierarchicalSelect.state["hs-" + hsid].log[logIndex][i]);
  }
  console.log(' ');
};

Drupal.HierarchicalSelect.transform = function(hsid) {
  var removeString = $('#hierarchical-select-'+ hsid +'-wrapper .dropbox .dropbox-remove:first', Drupal.HierarchicalSelect.context).text();

  $('#hierarchical-select-'+ hsid +'-wrapper', Drupal.HierarchicalSelect.context)
  // Remove the .nojs div.
  .find('.nojs').hide().end()
  // Find all .dropbox-remove cells in the dropbox table.
  .find('.dropbox .dropbox-remove')
  // Hide the children of these table cells. We're not removing them because
  // we want to continue to use the "Remove" checkboxes.
  .find('*').css('display', 'none').end() // We can't use .hide() because of collapse.js: http://drupal.org/node/351458#comment-1258303.
  // Put a "Remove" link there instead.
  .append('<a href="">'+ removeString +'</a>');
};

Drupal.HierarchicalSelect.resizable = function(hsid) {
  var $selectsWrapper = $('#hierarchical-select-' + hsid + '-wrapper .hierarchical-select .selects', Drupal.HierarchicalSelect.context);

  // No select wrapper present: the user is creating a new item.
  if ($selectsWrapper.length == 0) {
    return;
  }

  // Append the drag handle ("grippie").
  $selectsWrapper.append($('<div class="grippie"></div>'));

  // jQuery object that contains all selects in the hierarchical select, to
  // speed up DOM manipulation during dragging.
  var $selects = $selectsWrapper.find('select');

  var defaultPadding = parseInt($selects.slice(0, 1).css('padding-top').replace(/^(\d+)px$/, "$1")) + parseInt($selects.slice(0, 1).css('padding-bottom').replace(/^(\d+)px$/, "$1"));
  var defaultHeight = Drupal.HierarchicalSelect.state["hs-" + hsid].defaultHeight = $selects.slice(0, 1).height() + defaultPadding;
  var defaultSize = Drupal.HierarchicalSelect.state["hs-" + hsid].defaultSize = $selects.slice(0, 1).attr('size');
  defaultSize = (defaultSize == 0) ? 1 : defaultSize;
  var margin = Drupal.HierarchicalSelect.state["hs-" + hsid].margin = parseInt($selects.slice(0, 1).css('margin-bottom').replace(/^(\d+)px$/, "$1"));

  // Bind the drag event.
  $('.grippie', $selectsWrapper)
  .mousedown(startDrag)
  .dblclick(function() {
    if (Drupal.HierarchicalSelect.state["hs-" + hsid].resizedHeight == undefined) {
      Drupal.HierarchicalSelect.state["hs-" + hsid].resizedHeight = defaultHeight;
    }
    var resizedHeight = Drupal.HierarchicalSelect.state["hs-" + hsid].resizedHeight = (Drupal.HierarchicalSelect.state["hs-" + hsid].resizedHeight > defaultHeight + 2) ? defaultHeight : 4.6 / defaultSize * defaultHeight;
    Drupal.HierarchicalSelect.resize($selects, defaultHeight, resizedHeight, defaultSize, margin);
  });

  function startDrag(e) {
    staticOffset = $selects.slice(0, 1).height() - e.pageY;
    $selects.css('opacity', 0.25);
    $(document).mousemove(performDrag).mouseup(endDrag);
    return false;
  }

  function performDrag(e) {
    var resizedHeight = staticOffset + e.pageY;
    Drupal.HierarchicalSelect.resize($selects, defaultHeight, resizedHeight, defaultSize, margin);
    return false;
  }

  function endDrag(e) {
    var height = $selects.slice(0, 1).height();

    $(document).unbind("mousemove", performDrag).unbind("mouseup", endDrag);
    $selects.css('opacity', 1);
    if (height != Drupal.HierarchicalSelect.state["hs-" + hsid].resizedHeight) {
      Drupal.HierarchicalSelect.state["hs-" + hsid].resizedHeight = (height > defaultHeight) ? height : defaultHeight;
    }
  }
};

Drupal.HierarchicalSelect.resize = function($selects, defaultHeight, resizedHeight, defaultSize, margin) {
  if (resizedHeight == undefined) {
    resizedHeight = defaultHeight;
  }

  $selects
  .attr('size', (resizedHeight > defaultHeight) ? 2 : defaultSize)
  .height(Math.max(defaultHeight + margin, resizedHeight)); // Without the margin component, the height() method would allow the select to be sized to low: defaultHeight - margin.
};

Drupal.HierarchicalSelect.disableForm = function(hsid) {
  // Disable *all* submit buttons in this form, as well as all input-related
  // elements of the current hierarchical select.
  $('form:has(#hierarchical-select-' + hsid +'-wrapper) :submit')
  .add('#hierarchical-select-' + hsid +'-wrapper .hierarchical-select .selects select')
  .add('#hierarchical-select-' + hsid +'-wrapper .hierarchical-select :input')
  .attr('disabled', true);

  // Add the 'waiting' class. Default style: make everything transparent.
  $('#hierarchical-select-' + hsid +'-wrapper').addClass('waiting');

  // Indicate that the user has to wait.
  $('body').css('cursor', 'wait');
};

Drupal.HierarchicalSelect.enableForm = function(hsid) {
  // This method undoes everything the disableForm() method did.

  $e = $('form:has(#hierarchical-select-' + hsid +'-wrapper) :submit')
  .add('#hierarchical-select-' + hsid +'-wrapper .hierarchical-select :input:not(:submit)');

  // Don't enable the selects again if they've been disabled because the
  // dropbox limit was exceeded.
  dropboxLimitExceeded = $('#hierarchical-select-' + hsid +'-wrapper .hierarchical-select-dropbox-limit-warning').length > 0;
  if (!dropboxLimitExceeded) {
    $e = $e.add($('#hierarchical-select-' + hsid +'-wrapper .hierarchical-select .selects select'));
  }
  $e.removeAttr("disabled");

  // Don't enable the 'Add' button again if it's been disabled because the
  // dropbox limit was exceeded.
  if (dropboxLimitExceeded) {
    $('#hierarchical-select-' + hsid +'-wrapper .hierarchical-select :submit')
    .attr('disabled', true);
  }

  $('#hierarchical-select-' + hsid +'-wrapper').removeClass('waiting');

  $('body').css('cursor', 'auto');
};

Drupal.HierarchicalSelect.throwError = function(hsid, message) {
  // Show the error to the user.
  alert(message);

  // Log the error.
  Drupal.HierarchicalSelect.log(hsid, [ message ]);

  // Re-enable the form to allow the user to retry, but reset the selection to
  // the level label if possible, otherwise the "<none>" option if possible.
  var $select = $('#hierarchical-select-' + hsid +'-wrapper .hierarchical-select .selects select:first');
  var levelLabelOption = $('option[value^=label_]', $select).val();
  if (levelLabelOption !== undefined) {
    $select.val(levelLabelOption);
  }
  else {
    var noneOption = $('option[value=none]', $select).val();
    if (noneOption !== undefined) {
      $select.val(noneOption);
    }
  }
  Drupal.HierarchicalSelect.enableForm(hsid);
};

Drupal.HierarchicalSelect.prepareGETSubmit = function(hsid) {
  // Remove the name attributes of all form elements that end up in GET,
  // except for the "flat select" form element.
  $('#hierarchical-select-'+ hsid +'-wrapper', Drupal.HierarchicalSelect.context)
  .find('input, select')
  .not('.flat-select')
  .removeAttr('name');

  // Update the name attribute of the "flat select" form element
  var $flatSelect = $('#hierarchical-select-'+ hsid +'-wrapper .flat-select', Drupal.HierarchicalSelect.context);
  var newName = $flatSelect.attr('name').replace(/^([a-zA-Z0-9_\-]*)(?:\[flat_select\]){1}(\[\])?$/, "$1$2");
  $flatSelect.attr('name', newName);

  Drupal.HierarchicalSelect.triggerEvents(hsid, 'prepared-GET-submit', {});
};

Drupal.HierarchicalSelect.attachBindings = function(hsid) {
  var updateOpString = $('#hierarchical-select-'+ hsid +'-wrapper .update-button').val();
  var addOpString = $('#hierarchical-select-'+ hsid +'-wrapper .hierarchical-select .add-to-dropbox', Drupal.HierarchicalSelect.context).val();
  var createNewItemOpString = $('#hierarchical-select-'+ hsid +'-wrapper .hierarchical-select .create-new-item-create', Drupal.HierarchicalSelect.context).val();
  var cancelNewItemOpString = $('#hierarchical-select-'+ hsid +'-wrapper .hierarchical-select .create-new-item-cancel', Drupal.HierarchicalSelect.context).val();

  var data = {};
  data.hsid = hsid;

  $('#hierarchical-select-'+ hsid +'-wrapper', this.context)
  // "disable-updates" event
  .unbind('disable-updates').bind('disable-updates', data, function(e) {
    Drupal.settings.HierarchicalSelect.settings["hs-" + e.data.hsid]['updatesEnabled'] = false;
  })

  // "enforce-update" event
  .unbind('enforce-update').bind('enforce-update', data, function(e, extraPost) {
     Drupal.HierarchicalSelect.update(e.data.hsid, 'enforced-update', { opString: updateOpString, extraPost: extraPost });
  })

  // "prepare-GET-submit" event
  .unbind('prepare-GET-submit').bind('prepare-GET-submit', data, function(e) {
    Drupal.HierarchicalSelect.prepareGETSubmit(e.data.hsid);
  })

  // "update-hierarchical-select" event
  .find('.hierarchical-select .selects select').unbind().change(function(_hsid) {
    return function() {
      if (Drupal.settings.HierarchicalSelect.settings["hs-" + _hsid]['updatesEnabled']) {
        Drupal.HierarchicalSelect.update(_hsid, 'update-hierarchical-select', { opString: updateOpString, select_id : $(this).attr('id') });
      }
    };
  }(hsid)).end()

  // "create-new-item" event
  .find('.hierarchical-select .create-new-item .create-new-item-create').unbind().click(function(_hsid) {
    return function() {
      Drupal.HierarchicalSelect.update(_hsid, 'create-new-item', { opString : createNewItemOpString });
      return false; // Prevent the browser from POSTing the page.
    };
  }(hsid)).end()

  // "cancel-new-item" event"
  .find('.hierarchical-select .create-new-item .create-new-item-cancel').unbind().click(function(_hsid) {
    return function() {
      Drupal.HierarchicalSelect.update(_hsid, 'cancel-new-item', { opString : cancelNewItemOpString });
      return false; // Prevent the browser from POSTing the page (in case of the "Cancel" button).
    };
  }(hsid)).end()

  // "add-to-dropbox" event
  .find('.hierarchical-select .add-to-dropbox').unbind().click(function(_hsid) {
    return function() {
      Drupal.HierarchicalSelect.update(_hsid, 'add-to-dropbox', { opString : addOpString });
      return false; // Prevent the browser from POSTing the page.
    };
  }(hsid)).end()

  // "remove-from-dropbox" event
  // (anchors in the .dropbox-remove cells in the .dropbox table)
  .find('.dropbox .dropbox-remove a').unbind().click(function(_hsid) {
    return function() {
      var isDisabled = $('#hierarchical-select-'+ hsid +'-wrapper', Drupal.HierarchicalSelect.context).attr('disabled');

      // If the hierarchical select is disabled, then ignore this click.
      if (isDisabled) {
        return false;
      }

      // Check the (hidden, because JS is enabled) checkbox that marks this
      // dropbox entry for removal.
      $(this).parent().find('input[type=checkbox]').attr('checked', true);
      Drupal.HierarchicalSelect.update(_hsid, 'remove-from-dropbox', { opString: updateOpString });
      return false; // Prevent the browser from POSTing the page.
    };
  }(hsid));
};

Drupal.HierarchicalSelect.preUpdateAnimations = function(hsid, updateType, lastUnchanged, callback) {
  switch (updateType) {
    case 'update-hierarchical-select':
      // Drop out the selects of the levels deeper than the select of the
      // level that just changed.
      var animationDelay = Drupal.settings.HierarchicalSelect.settings["hs-" + hsid]['animationDelay'];
      var $animatedSelects = $('#hierarchical-select-'+ hsid +'-wrapper .hierarchical-select .selects select', Drupal.HierarchicalSelect.context).slice(lastUnchanged);
      if ($animatedSelects.size() > 0) {
        $animatedSelects.hide();
        for (var i = 0; i < $animatedSelects.size(); i++) {
          if (i < $animatedSelects.size() - 1) {
            $animatedSelects.slice(i, i + 1).hide("drop", { direction: "left" }, animationDelay);
          }
          else {
            $animatedSelects.slice(i, i + 1).hide("drop", { direction: "left" }, animationDelay, callback);
          }
        }
      }
      else if (callback) {
        callback();
      }
      break;
    default:
      if (callback) {
        callback();
      }
      break;
  }
};

Drupal.HierarchicalSelect.postUpdateAnimations = function(hsid, updateType, lastUnchanged, callback) {
  if (Drupal.settings.HierarchicalSelect.settings["hs-" + hsid].resizable) {
    // Restore the resize.
    Drupal.HierarchicalSelect.resize(
      $('#hierarchical-select-' + hsid + '-wrapper .hierarchical-select .selects select', Drupal.HierarchicalSelect.context),
      Drupal.HierarchicalSelect.state["hs-" + hsid].defaultHeight,
      Drupal.HierarchicalSelect.state["hs-" + hsid].resizedHeight,
      Drupal.HierarchicalSelect.state["hs-" + hsid].defaultSize,
      Drupal.HierarchicalSelect.state["hs-" + hsid].margin
    );
  }

  switch (updateType) {
    case 'update-hierarchical-select':
      var $createNewItemInput = $('#hierarchical-select-'+ hsid +'-wrapper .hierarchical-select .create-new-item-input', Drupal.HierarchicalSelect.context);
      // Hide the loaded selects after the one that was just changed, then
      // drop them in.
      var animationDelay = Drupal.settings.HierarchicalSelect.settings["hs-" + hsid]['animationDelay'];
      var $animatedSelects = $('#hierarchical-select-'+ hsid +'-wrapper .hierarchical-select .selects select', Drupal.HierarchicalSelect.context).slice(lastUnchanged);
      if ($animatedSelects.size() > 0) {
        $animatedSelects.hide();
        for (var i = 0; i < $animatedSelects.size(); i++) {
          if (i < $animatedSelects.size() - 1) {
            $animatedSelects.slice(i, i + 1).show("drop", { direction: "left" }, animationDelay);
          }
          else {
            $animatedSelects.slice(i, i + 1).show("drop", { direction: "left" }, animationDelay, callback);
          }
        }
      }
      else if (callback) {
        callback();
      }
      if ($createNewItemInput.size() == 0) {
        // Give focus to the level below the one that has changed, if it
        // exists.
        setTimeout(
          function() {
            $('#hierarchical-select-'+ hsid +'-wrapper .hierarchical-select .selects select', Drupal.HierarchicalSelect.context)
              .slice(lastUnchanged, lastUnchanged + 1)
              .focus();
          },
          animationDelay + 100
        );
      }
      else {
        // Give focus to the input field of the "create new item/level"
        // section, if it exists, and also select the existing text.
        $createNewItemInput.focus();
        $createNewItemInput[0].select();
      }
      break;

    case 'create-new-item':
      // Make sure that other Hierarchical Selects that represent the same
      // hierarchy are also updated, to make sure that they have the newly
      // created item!
      var cacheId = Drupal.settings.HierarchicalSelect.settings["hs-" + hsid].cacheId;
      for (var otherHsid in Drupal.settings.HierarchicalSelect.settings) {
        if (Drupal.settings.HierarchicalSelect.settings[otherHsid].cacheId == cacheId) {
          $('#hierarchical-select-'+ otherHsid +'-wrapper')
          .trigger('enforce-update');
        }
      }
      // TRICKY: NO BREAK HERE!

    case 'cancel-new-item':
      // After an item/level has been created/cancelled, reset focus to the
      // beginning of the hierarchical select.
      $('#hierarchical-select-'+ hsid +'-wrapper .hierarchical-select .selects select', Drupal.HierarchicalSelect.context)
      .slice(0, 1)
      .focus();

      if (callback) {
        callback();
      }
      break;

    default:
      if (callback) {
        callback();
      }
      break;
  }
};

Drupal.HierarchicalSelect.triggerEvents = function(hsid, updateType, settings) {
  $('#hierarchical-select-'+ hsid +'-wrapper', Drupal.HierarchicalSelect.context)
  .trigger(updateType, [ hsid, settings ]);
};

Drupal.HierarchicalSelect.update = function(hsid, updateType, settings) {
  var post = $('form:has(#hierarchical-select-' + hsid +'-wrapper)', Drupal.HierarchicalSelect.context).formToArray();
  var hs_current_language = Drupal.settings.HierarchicalSelect.hs_current_language;

  // Pass the hierarchical_select id via POST.
  post.push({ name : 'hsid', value : hsid });
  // Send the current language so we can use the same language during the AJAX callback.
  post.push({ name : 'hs_current_language', value : hs_current_language});
  // Emulate the AJAX data sent normally so that we get the same theme.
  post.push({ name : 'ajax_page_state[theme]', value : Drupal.settings.ajaxPageState.theme });
  post.push({ name : 'ajax_page_state[theme_token]', value : Drupal.settings.ajaxPageState.theme_token });

  // If a cache system is installed, let the server know if it's running
  // properly. If it is running properly, the server will send back additional
  // information to maintain a lazily-loaded cache.
  if (Drupal.HierarchicalSelect.cache != null) {
    post.push({ name : 'client_supports_caching', value : Drupal.HierarchicalSelect.cache.status() });
  }

  // updateType is one of:
  // - 'none' (default)
  // - 'update-hierarchical-select'
  // - 'enforced-update'
  // - 'create-new-item'
  // - 'cancel-new-item'
  // - 'add-to-dropbox'
  // - 'remove-from-dropbox'
  switch (updateType) {
    case 'update-hierarchical-select':
      var value = $('#'+ settings.select_id).val();
      var lastUnchanged = parseInt(settings.select_id.replace(/^.*-hierarchical-select-selects-(\d+)/, "$1")) + 1;
      var optionClass = $('#'+ settings.select_id).find('option[value="'+ value +'"]').attr('class');

      // Don't do anything (also no callback to the server!) when the selected
      // item is:
      // - the '<none>' option and the renderFlatSelect setting is disabled, or
      // - a level label, or
      // - an option of class 'has-no-children', and
      //   (the renderFlatSelect setting is disabled or the dropbox is enabled)
      //   and
      //   (the createNewLevels setting is disabled).
      if ((value == 'none' && Drupal.settings.HierarchicalSelect.settings["hs-" + hsid]['renderFlatSelect'] == false)
          || value.match(/^label_\d+$/)
          || (optionClass == 'has-no-children'
             &&
             (
               (Drupal.settings.HierarchicalSelect.settings["hs-" + hsid]['renderFlatSelect'] == false
                || $('#hierarchical-select-'+ hsid +'-wrapper .dropbox').length > 0
               )
               &&
               Drupal.settings.HierarchicalSelect.settings["hs-" + hsid]['createNewLevels'] == false
             )
           )
         )
      {
        Drupal.HierarchicalSelect.preUpdateAnimations(hsid, updateType, lastUnchanged, function() {
          // Remove the sublevels.
          $('#hierarchical-select-'+ hsid +'-wrapper .hierarchical-select .selects select', Drupal.HierarchicalSelect.context)
          .slice(lastUnchanged)
          .remove();

          // The selection of this hierarchical select has changed!
          Drupal.HierarchicalSelect.triggerEvents(hsid, 'change-hierarchical-select', settings);
        });
        return;
      }
      post.push({ name : 'op', value : settings.opString });
      break;

    case 'enforced-update':
      post.push({ name : 'op', value : settings.opString });
      post = post.concat(settings.extraPost);
      break;

    case 'create-new-item':
    case 'cancel-new-item':
    case 'add-to-dropbox':
    case 'remove-from-dropbox':
      post.push({ name : 'op', value : settings.opString });
      break;

    default:
      break;
  }

  // Construct the URL the request should be made to.
  var url = Drupal.settings.HierarchicalSelect.settings["hs-" + hsid].ajax_url;

  // Construct the object that contains the options for a callback to the
  // server. If a client-side cache is found however, it's possible that this
  // won't be used.
  var ajaxOptions = $.extend({}, Drupal.ajax.prototype, {
    url:        url,
    type:       'POST',
    dataType:   'json',
    data:       post,
    effect:     'fade',
    wrapper:    '#hierarchical-select-' + hsid + '-wrapper',
    beforeSend: function() {
      Drupal.HierarchicalSelect.triggerEvents(hsid, 'before-' + updateType, settings);
      Drupal.HierarchicalSelect.disableForm(hsid);
    },
    error: function (XMLHttpRequest, textStatus, errorThrown) {
      // When invalid HTML is received in Safari, jQuery calls this function.
      Drupal.HierarchicalSelect.throwError(hsid, Drupal.t('Received an invalid response from the server.'));
    },
    success: function(response, status) {
      // An invalid response may be returned by the server, in case of a PHP
      // error. Detect this and let the user know.
      if (response === null || response.length == 0) {
        Drupal.HierarchicalSelect.throwError(hsid, Drupal.t('Received an invalid response from the server.'));
        return;
      }

      // Execute all AJAX commands in the response. But pass an additional
      // hsid parameter, which is then only used by the commands written
      // for Hierarchical Select.

      // This is another hack because of the non-Drupal ajax implementation
      // of this module, one of the response that can come from a drupal
      // ajax command is insert, which expects a Drupal.ajax object as the first
      // arguments and assumes that certain functions/settings are available.
      // Because we are calling a Drupal.ajax.command but providing the regular
      // jQuery ajax object itself, we are allowing Drupal.ajax.prototype.commands
      // to misserably fail.
      //
      // This hack attempts to fix one issue with an insert command,
      // @see https://www.drupal.org/node/2393695, allowing it to work properly
      // Other hacks might be necessary for other ajax commands if they are added
      // by external modules.
      this.effect = 'none';
      this.getEffect = Drupal.ajax.prototype.getEffect;

      for (var i in response) {
        if (response[i]['command'] && Drupal.ajax.prototype.commands[response[i]['command']]) {
          Drupal.ajax.prototype.commands[response[i]['command']](this, response[i], status, hsid);
        }
      }

      // Attach behaviors. This is just after the HTML has been updated, so
      // it's as soon as we can.
      Drupal.attachBehaviors($('#hierarchical-select-' + hsid + '-wrapper').parents('div.form-type-hierarchical-select')[0]);

      // Transform the hierarchical select and/or dropbox to the JS variant,
      // make it resizable again and re-enable the disabled form items.
      Drupal.HierarchicalSelect.enableForm(hsid);

      Drupal.HierarchicalSelect.postUpdateAnimations(hsid, updateType, lastUnchanged, function() {
        // Update the client-side cache when:
        // - information for in the cache is provided in the response, and
        // - the cache system is available, and
        // - the cache system is running.
        if (response.cache != null && Drupal.HierarchicalSelect.cache != null && Drupal.HierarchicalSelect.cache.status()) {
          Drupal.HierarchicalSelect.cache.sync(hsid, response.cache);
        }

        if (response.log != undefined) {
          Drupal.HierarchicalSelect.log(hsid, response.log);
        }

        Drupal.HierarchicalSelect.triggerEvents(hsid, updateType, settings);

        if (updateType == 'update-hierarchical-select') {
          // The selection of this hierarchical select has changed!
          Drupal.HierarchicalSelect.triggerEvents(hsid, 'change-hierarchical-select', settings);
        }
      });
    }
  });

  // Use the client-side cache to update the hierarchical select when:
  // - the hierarchical select is being updated (i.e. no add/remove), and
  // - the renderFlatSelect setting is disabled, and
  // - the createNewItems setting is disabled, and
  // - the cache system is available, and
  // - the cache system is running.
  // Otherwise, perform a normal dynamic form submit.
  if (updateType == 'update-hierarchical-select'
      && Drupal.settings.HierarchicalSelect.settings["hs-" + hsid]['renderFlatSelect'] == false
      && Drupal.settings.HierarchicalSelect.settings["hs-" + hsid]['createNewItems'] == false
      && Drupal.HierarchicalSelect.cache != null
      && Drupal.HierarchicalSelect.cache.status())
  {
    Drupal.HierarchicalSelect.cache.updateHierarchicalSelect(hsid, value, settings, lastUnchanged, ajaxOptions);
  }
  else {
    Drupal.HierarchicalSelect.preUpdateAnimations(hsid, updateType, lastUnchanged, function() {
      // Adding current theme to prevent conflicts, @see ajax.js
      // @TODO, try converting to use Drupal.ajax instead.

      // Prevent duplicate HTML ids in the returned markup.
      // @see drupal_html_id()
      var ids = [];
      $('[id]').each(function () {
        ids.push(this.id);
      });

      ajaxOptions.data.push({ name : 'ajax_html_ids[]', value : ids });

      ajaxOptions.data.push({ name : 'ajax_page_state[theme]', value : Drupal.settings.ajaxPageState.theme });
      ajaxOptions.data.push({ name : 'ajax_page_state[theme_token]', value : Drupal.settings.ajaxPageState.theme_token });
      for (var key in Drupal.settings.ajaxPageState.css) {
        ajaxOptions.data.push({ name : 'ajax_page_state[css][' + key + ']', value : 1});
      }
      for (var key in Drupal.settings.ajaxPageState.js) {
        ajaxOptions.data.push({ name : 'ajax_page_state[js][' + key + ']', value : 1});
      }

      // Make it work with jquery update
      if (Drupal.settings.ajaxPageState.jquery_version) {
        ajaxOptions.data.push({ name : 'ajax_page_state[jquery_version]', value : Drupal.settings.ajaxPageState.jquery_version });
      }

      $.ajax(ajaxOptions);
    });
  }
};

Drupal.ajax.prototype.commands.hierarchicalSelectUpdate = function(ajax, response, status, hsid) {
  // Replace the old HTML with the (relevant part of) retrieved HTML.
  $('#hierarchical-select-'+ hsid +'-wrapper', Drupal.HierarchicalSelect.context)
  .parent('.form-item')
  .replaceWith($(response.output));
};

Drupal.ajax.prototype.commands.hierarchicalSelectSettingsUpdate = function(ajax, response, status, hsid) {
  Drupal.settings.HierarchicalSelect.settings["hs-" + response.hsid] = response.settings;
};

})(jQuery);
;
/**
 * @file
 * Provides JavaScript additions to the media field widget.
 *
 * This file provides support for launching the media browser to select existing
 * files and disabling of other media fields during Ajax uploads (which prevents
 * separate media fields from accidentally attaching files).
 */

(function ($) {

/**
 * Attach behaviors to media element upload fields.
 */
Drupal.behaviors.mediaElement = {
  attach: function (context, settings) {
    var $context = $(context);
    var elements;

    function initMediaBrowser(selector) {
      var widget=$context.find(selector).once('media-browser-launch');
      var browse=widget.siblings('.browse').add(widget.find('.browse'));
      var upload=browse.siblings('.upload').add(widget.find('.upload'));
      var attach=upload.siblings('.attach').add(widget.find('.attach'));
      browse.show();
      upload.hide();
      attach.hide();
      browse.bind('click', {configuration: settings.media.elements[selector]}, Drupal.media.openBrowser);
    }

    if (settings.media && settings.media.elements) {
      elements = settings.media.elements;
      Object.keys(elements).forEach(initMediaBrowser);
    }
  },
  detach: function (context, settings, trigger) {
    var $context = $(context);
    var elements;

    function removeMediaBrowser(selector) {
      $context.find(selector)
        .removeOnce('media-browser-launch')
        .siblings('.browse').hide()
        .siblings('.upload').show()
        .siblings('.attach').show()
        .siblings('.browse').unbind('click', Drupal.media.openBrowser);
    }

    if (trigger === 'unload' && settings.media && settings.media.elements) {
      elements = settings.media.elements;
      Object.keys(elements).forEach(removeMediaBrowser);
    }
  }
};

/**
 * Attach behaviors to the media attach and remove buttons.
 */
Drupal.behaviors.mediaButtons = {
  attach: function (context) {
    $('input.form-submit', context).bind('mousedown', Drupal.media.disableFields);
  },
  detach: function (context) {
    $('input.form-submit', context).unbind('mousedown', Drupal.media.disableFields);
  }
};

/**
 * Media attach utility functions.
 */
Drupal.media = Drupal.media || {};

/**
 * Opens the media browser with the element's configuration settings.
 */
Drupal.media.openBrowser = function (event) {
  var clickedButton = this;
  var configuration = event.data.configuration.global;

  // Find the file ID, preview and upload fields.
  var fidField = $(this).siblings('.fid');
  var previewField = $(this).siblings('.preview');
  var uploadField = $(this).siblings('.upload');

  // Find the edit and remove buttons.
  var editButton = $(this).siblings('.edit');
  var removeButton = $(this).siblings('.remove');

  // Launch the media browser.
  Drupal.media.popups.mediaBrowser(function (mediaFiles) {
    // Ensure that there was at least one media file selected.
    if (mediaFiles.length < 0) {
      return;
    }

    var mediaFileValue;
    // Process the value based on multiselect.
    if (mediaFiles.length > 1) {
      // Concatenate the array into a comma separated string.
      mediaFileValue = mediaFiles.map(function(file) {
        return file.fid;
      }).join(',');
    }
    else {
      // Grab the first of the selected media files.
      mediaFileValue = mediaFiles[0].fid;

      // Display a preview of the file using the selected media file's display.
      previewField.html(mediaFileValue.preview);
    }

    // Set the value of the hidden file ID field and trigger a change.
    uploadField.val(mediaFileValue);
    uploadField.trigger('change');

    // Find the attach button and automatically trigger it.
    var attachButton = uploadField.siblings('.attach');
    attachButton.trigger('mousedown');
  }, configuration);

  return false;
};

/**
 * Prevent media browsing when using buttons not intended to browse.
 */
Drupal.media.disableFields = function (event) {
  var clickedButton = this;

  // Only disable browse fields for Ajax buttons.
  if (!$(clickedButton).hasClass('ajax-processed')) {
    return;
  }

  // Check if we're working with an "Attach" button.
  var $enabledFields = [];
  if ($(this).closest('div.media-widget').length > 0) {
    $enabledFields = $(this).closest('div.media-widget').find('input.attach');
  }

  // Temporarily disable attach fields other than the one we're currently
  // working with. Filter out fields that are already disabled so that they
  // do not get enabled when we re-enable these fields at the end of behavior
  // processing. Re-enable in a setTimeout set to a relatively short amount
  // of time (1 second). All the other mousedown handlers (like Drupal's Ajax
  // behaviors) are excuted before any timeout functions are called, so we
  // don't have to worry about the fields being re-enabled too soon.
  // @todo If the previous sentence is true, why not set the timeout to 0?
  var $fieldsToTemporarilyDisable = $('div.media-widget input.attach').not($enabledFields).not(':disabled');
  $fieldsToTemporarilyDisable.attr('disabled', 'disabled');
  setTimeout(function (){
    $fieldsToTemporarilyDisable.attr('disabled', false);
  }, 1000);
};

})(jQuery);
;
(function ($) {

/**
 * Toggle the visibility of a fieldset using smooth animations.
 */
Drupal.toggleFieldset = function (fieldset) {
  var $fieldset = $(fieldset);
  if ($fieldset.is('.collapsed')) {
    var $content = $('> .fieldset-wrapper', fieldset).hide();
    $fieldset
      .removeClass('collapsed')
      .trigger({ type: 'collapsed', value: false })
      .find('> legend span.fieldset-legend-prefix').html(Drupal.t('Hide'));
    $content.slideDown({
      duration: 'fast',
      easing: 'linear',
      complete: function () {
        Drupal.collapseScrollIntoView(fieldset);
        fieldset.animating = false;
      },
      step: function () {
        // Scroll the fieldset into view.
        Drupal.collapseScrollIntoView(fieldset);
      }
    });
  }
  else {
    $fieldset.trigger({ type: 'collapsed', value: true });
    $('> .fieldset-wrapper', fieldset).slideUp('fast', function () {
      $fieldset
        .addClass('collapsed')
        .find('> legend span.fieldset-legend-prefix').html(Drupal.t('Show'));
      fieldset.animating = false;
    });
  }
};

/**
 * Scroll a given fieldset into view as much as possible.
 */
Drupal.collapseScrollIntoView = function (node) {
  var h = document.documentElement.clientHeight || document.body.clientHeight || 0;
  var offset = document.documentElement.scrollTop || document.body.scrollTop || 0;
  var posY = $(node).offset().top;
  var fudge = 55;
  if (posY + node.offsetHeight + fudge > h + offset) {
    if (node.offsetHeight > h) {
      window.scrollTo(0, posY);
    }
    else {
      window.scrollTo(0, posY + node.offsetHeight - h + fudge);
    }
  }
};

Drupal.behaviors.collapse = {
  attach: function (context, settings) {
    $('fieldset.collapsible', context).once('collapse', function () {
      var $fieldset = $(this);
      // Expand fieldset if there are errors inside, or if it contains an
      // element that is targeted by the URI fragment identifier.
      var anchor = location.hash && location.hash != '#' ? ', ' + location.hash : '';
      if ($fieldset.find('.error' + anchor).length) {
        $fieldset.removeClass('collapsed');
      }

      var summary = $('<span class="summary"></span>');
      $fieldset.
        bind('summaryUpdated', function () {
          var text = $.trim($fieldset.drupalGetSummary());
          summary.html(text ? ' (' + text + ')' : '');
        })
        .trigger('summaryUpdated');

      // Turn the legend into a clickable link, but retain span.fieldset-legend
      // for CSS positioning.
      var $legend = $('> legend .fieldset-legend', this);

      $('<span class="fieldset-legend-prefix element-invisible"></span>')
        .append($fieldset.hasClass('collapsed') ? Drupal.t('Show') : Drupal.t('Hide'))
        .prependTo($legend)
        .after(' ');

      // .wrapInner() does not retain bound events.
      var $link = $('<a class="fieldset-title" href="#"></a>')
        .prepend($legend.contents())
        .appendTo($legend)
        .click(function () {
          var fieldset = $fieldset.get(0);
          // Don't animate multiple times.
          if (!fieldset.animating) {
            fieldset.animating = true;
            Drupal.toggleFieldset(fieldset);
          }
          return false;
        });

      $legend.append(summary);
    });
  }
};

})(jQuery);
;
(function ($) {

Drupal.behaviors.menuFieldsetSummaries = {
  attach: function (context) {
    $('fieldset.menu-link-form', context).drupalSetSummary(function (context) {
      if ($('.form-item-menu-enabled input', context).is(':checked')) {
        return Drupal.checkPlain($('.form-item-menu-link-title input', context).val());
      }
      else {
        return Drupal.t('Not in menu');
      }
    });
  }
};

/**
 * Automatically fill in a menu link title, if possible.
 */
Drupal.behaviors.menuLinkAutomaticTitle = {
  attach: function (context) {
    $('fieldset.menu-link-form', context).each(function () {
      // Try to find menu settings widget elements as well as a 'title' field in
      // the form, but play nicely with user permissions and form alterations.
      var $checkbox = $('.form-item-menu-enabled input', this);
      var $link_title = $('.form-item-menu-link-title input', context);
      var $title = $(this).closest('form').find('.form-item-title input');
      // Bail out if we do not have all required fields.
      if (!($checkbox.length && $link_title.length && $title.length)) {
        return;
      }
      // If there is a link title already, mark it as overridden. The user expects
      // that toggling the checkbox twice will take over the node's title.
      if ($checkbox.is(':checked') && $link_title.val().length) {
        $link_title.data('menuLinkAutomaticTitleOveridden', true);
      }
      // Whenever the value is changed manually, disable this behavior.
      $link_title.keyup(function () {
        $link_title.data('menuLinkAutomaticTitleOveridden', true);
      });
      // Global trigger on checkbox (do not fill-in a value when disabled).
      $checkbox.change(function () {
        if ($checkbox.is(':checked')) {
          if (!$link_title.data('menuLinkAutomaticTitleOveridden')) {
            $link_title.val($title.val());
          }
        }
        else {
          $link_title.val('');
          $link_title.removeData('menuLinkAutomaticTitleOveridden');
        }
        $checkbox.closest('fieldset.vertical-tabs-pane').trigger('summaryUpdated');
        $checkbox.trigger('formUpdated');
      });
      // Take over any title change.
      $title.keyup(function () {
        if (!$link_title.data('menuLinkAutomaticTitleOveridden') && $checkbox.is(':checked')) {
          $link_title.val($title.val());
          $link_title.val($title.val()).trigger('formUpdated');
        }
      });
    });
  }
};

})(jQuery);
;
/**
 * @file
 * Javascript behaviors for the Book module.
 */

(function ($) {

Drupal.behaviors.bookFieldsetSummaries = {
  attach: function (context) {
    $('fieldset.book-outline-form', context).drupalSetSummary(function (context) {
      var $select = $('.form-item-book-bid select');
      var val = $select.val();

      if (val === '0') {
        return Drupal.t('Not in book');
      }
      else if (val === 'new') {
        return Drupal.t('New book');
      }
      else {
        return Drupal.checkPlain($select.find(':selected').text());
      }
    });
  }
};

})(jQuery);
;

(function ($) {

Drupal.behaviors.commentFieldsetSummaries = {
  attach: function (context) {
    $('fieldset.comment-node-settings-form', context).drupalSetSummary(function (context) {
      return Drupal.checkPlain($('.form-item-comment input:checked', context).next('label').text());
    });

    // Provide the summary for the node type form.
    $('fieldset.comment-node-type-settings-form', context).drupalSetSummary(function(context) {
      var vals = [];

      // Default comment setting.
      vals.push($(".form-item-comment select option:selected", context).text());

      // Threading.
      var threading = $(".form-item-comment-default-mode input:checked", context).next('label').text();
      if (threading) {
        vals.push(threading);
      }

      // Comments per page.
      var number = $(".form-item-comment-default-per-page select option:selected", context).val();
      vals.push(Drupal.t('@number comments per page', {'@number': number}));

      return Drupal.checkPlain(vals.join(', '));
    });
  }
};

})(jQuery);
;

/**
 * @file
 * Attaches behaviors for the Path module.
 */

(function ($) {

Drupal.behaviors.pathFieldsetSummaries = {
  attach: function (context) {
    $('fieldset.path-form', context).drupalSetSummary(function (context) {
      var path = $('.form-item-path-alias input').val();

      return path ?
        Drupal.t('Alias: @alias', { '@alias': path }) :
        Drupal.t('No alias');
    });
  }
};

})(jQuery);
;
(function ($) {

/**
 * Attaches the autocomplete behavior to all required fields.
 */
Drupal.behaviors.autocomplete = {
  attach: function (context, settings) {
    var acdb = [];
    $('input.autocomplete', context).once('autocomplete', function () {
      var uri = this.value;
      if (!acdb[uri]) {
        acdb[uri] = new Drupal.ACDB(uri);
      }
      var $input = $('#' + this.id.substr(0, this.id.length - 13))
        .attr('autocomplete', 'OFF')
        .attr('aria-autocomplete', 'list');
      $($input[0].form).submit(Drupal.autocompleteSubmit);
      $input.parent()
        .attr('role', 'application')
        .append($('<span class="element-invisible" aria-live="assertive"></span>')
          .attr('id', $input.attr('id') + '-autocomplete-aria-live')
        );
      new Drupal.jsAC($input, acdb[uri]);
    });
  }
};

/**
 * Prevents the form from submitting if the suggestions popup is open
 * and closes the suggestions popup when doing so.
 */
Drupal.autocompleteSubmit = function () {
  return $('#autocomplete').each(function () {
    this.owner.hidePopup();
  }).length == 0;
};

/**
 * An AutoComplete object.
 */
Drupal.jsAC = function ($input, db) {
  var ac = this;
  this.input = $input[0];
  this.ariaLive = $('#' + this.input.id + '-autocomplete-aria-live');
  this.db = db;

  $input
    .keydown(function (event) { return ac.onkeydown(this, event); })
    .keyup(function (event) { ac.onkeyup(this, event); })
    .blur(function () { ac.hidePopup(); ac.db.cancel(); });

};

/**
 * Handler for the "keydown" event.
 */
Drupal.jsAC.prototype.onkeydown = function (input, e) {
  if (!e) {
    e = window.event;
  }
  switch (e.keyCode) {
    case 40: // down arrow.
      this.selectDown();
      return false;
    case 38: // up arrow.
      this.selectUp();
      return false;
    default: // All other keys.
      return true;
  }
};

/**
 * Handler for the "keyup" event.
 */
Drupal.jsAC.prototype.onkeyup = function (input, e) {
  if (!e) {
    e = window.event;
  }
  switch (e.keyCode) {
    case 16: // Shift.
    case 17: // Ctrl.
    case 18: // Alt.
    case 20: // Caps lock.
    case 33: // Page up.
    case 34: // Page down.
    case 35: // End.
    case 36: // Home.
    case 37: // Left arrow.
    case 38: // Up arrow.
    case 39: // Right arrow.
    case 40: // Down arrow.
      return true;

    case 9:  // Tab.
    case 13: // Enter.
    case 27: // Esc.
      this.hidePopup(e.keyCode);
      return true;

    default: // All other keys.
      if (input.value.length > 0 && !input.readOnly) {
        this.populatePopup();
      }
      else {
        this.hidePopup(e.keyCode);
      }
      return true;
  }
};

/**
 * Puts the currently highlighted suggestion into the autocomplete field.
 */
Drupal.jsAC.prototype.select = function (node) {
  this.input.value = $(node).data('autocompleteValue');
  $(this.input).trigger('autocompleteSelect', [node]);
};

/**
 * Highlights the next suggestion.
 */
Drupal.jsAC.prototype.selectDown = function () {
  if (this.selected && this.selected.nextSibling) {
    this.highlight(this.selected.nextSibling);
  }
  else if (this.popup) {
    var lis = $('li', this.popup);
    if (lis.length > 0) {
      this.highlight(lis.get(0));
    }
  }
};

/**
 * Highlights the previous suggestion.
 */
Drupal.jsAC.prototype.selectUp = function () {
  if (this.selected && this.selected.previousSibling) {
    this.highlight(this.selected.previousSibling);
  }
};

/**
 * Highlights a suggestion.
 */
Drupal.jsAC.prototype.highlight = function (node) {
  if (this.selected) {
    $(this.selected).removeClass('selected');
  }
  $(node).addClass('selected');
  this.selected = node;
  $(this.ariaLive).html($(this.selected).html());
};

/**
 * Unhighlights a suggestion.
 */
Drupal.jsAC.prototype.unhighlight = function (node) {
  $(node).removeClass('selected');
  this.selected = false;
  $(this.ariaLive).empty();
};

/**
 * Hides the autocomplete suggestions.
 */
Drupal.jsAC.prototype.hidePopup = function (keycode) {
  // Select item if the right key or mousebutton was pressed.
  if (this.selected && ((keycode && keycode != 46 && keycode != 8 && keycode != 27) || !keycode)) {
    this.select(this.selected);
  }
  // Hide popup.
  var popup = this.popup;
  if (popup) {
    this.popup = null;
    $(popup).fadeOut('fast', function () { $(popup).remove(); });
  }
  this.selected = false;
  $(this.ariaLive).empty();
};

/**
 * Positions the suggestions popup and starts a search.
 */
Drupal.jsAC.prototype.populatePopup = function () {
  var $input = $(this.input);
  var position = $input.position();
  // Show popup.
  if (this.popup) {
    $(this.popup).remove();
  }
  this.selected = false;
  this.popup = $('<div id="autocomplete"></div>')[0];
  this.popup.owner = this;
  $(this.popup).css({
    top: parseInt(position.top + this.input.offsetHeight, 10) + 'px',
    left: parseInt(position.left, 10) + 'px',
    width: $input.innerWidth() + 'px',
    display: 'none'
  });
  $input.before(this.popup);

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
  var ul = $('<ul></ul>');
  var ac = this;
  for (key in matches) {
    $('<li></li>')
      .html($('<div></div>').html(matches[key]))
      .mousedown(function () { ac.hidePopup(this); })
      .mouseover(function () { ac.highlight(this); })
      .mouseout(function () { ac.unhighlight(this); })
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
      $(this.popup).css({ visibility: 'hidden' });
      this.hidePopup();
    }
  }
};

Drupal.jsAC.prototype.setStatus = function (status) {
  switch (status) {
    case 'begin':
      $(this.input).addClass('throbbing');
      $(this.ariaLive).html(Drupal.t('Searching for matches...'));
      break;
    case 'cancel':
    case 'error':
    case 'found':
      $(this.input).removeClass('throbbing');
      break;
  }
};

/**
 * An AutoComplete DataBase object.
 */
Drupal.ACDB = function (uri) {
  this.uri = uri;
  this.delay = 300;
  this.cache = {};
};

/**
 * Performs a cached and delayed search.
 */
Drupal.ACDB.prototype.search = function (searchString) {
  var db = this;
  this.searchString = searchString;

  // See if this string needs to be searched for anyway. The pattern ../ is
  // stripped since it may be misinterpreted by the browser.
  searchString = searchString.replace(/^\s+|\.{2,}\/|\s+$/g, '');
  // Skip empty search strings, or search strings ending with a comma, since
  // that is the separator between search terms.
  if (searchString.length <= 0 ||
    searchString.charAt(searchString.length - 1) == ',') {
    return;
  }

  // See if this key has been searched for before.
  if (this.cache[searchString]) {
    return this.owner.found(this.cache[searchString]);
  }

  // Initiate delayed search.
  if (this.timer) {
    clearTimeout(this.timer);
  }
  this.timer = setTimeout(function () {
    db.owner.setStatus('begin');

    // Ajax GET request for autocompletion. We use Drupal.encodePath instead of
    // encodeURIComponent to allow autocomplete search terms to contain slashes.
    $.ajax({
      type: 'GET',
      url: db.uri + '/' + Drupal.encodePath(searchString),
      dataType: 'json',
      success: function (matches) {
        if (typeof matches.status == 'undefined' || matches.status != 0) {
          db.cache[searchString] = matches;
          // Verify if these are still the matches the user wants to see.
          if (db.searchString == searchString) {
            db.owner.found(matches);
          }
          db.owner.setStatus('found');
        }
      },
      error: function (xmlhttp) {
        Drupal.displayAjaxError(Drupal.ajaxError(xmlhttp, db.uri));
      }
    });
  }, this.delay);
};

/**
 * Cancels the current autocomplete request.
 */
Drupal.ACDB.prototype.cancel = function () {
  if (this.owner) this.owner.setStatus('cancel');
  if (this.timer) clearTimeout(this.timer);
  this.searchString = '';
};

})(jQuery);
;

(function ($) {

Drupal.behaviors.nodeFieldsetSummaries = {
  attach: function (context) {
    $('fieldset.node-form-revision-information', context).drupalSetSummary(function (context) {
      var revisionCheckbox = $('.form-item-revision input', context);

      // Return 'New revision' if the 'Create new revision' checkbox is checked,
      // or if the checkbox doesn't exist, but the revision log does. For users
      // without the "Administer content" permission the checkbox won't appear,
      // but the revision log will if the content type is set to auto-revision.
      if (revisionCheckbox.is(':checked') || (!revisionCheckbox.length && $('.form-item-log textarea', context).length)) {
        return Drupal.t('New revision');
      }

      return Drupal.t('No revision');
    });

    $('fieldset.node-form-author', context).drupalSetSummary(function (context) {
      var name = $('.form-item-name input', context).val() || Drupal.settings.anonymous,
        date = $('.form-item-date input', context).val();
      return date ?
        Drupal.t('By @name on @date', { '@name': name, '@date': date }) :
        Drupal.t('By @name', { '@name': name });
    });

    $('fieldset.node-form-options', context).drupalSetSummary(function (context) {
      var vals = [];

      $('input:checked', context).parent().each(function () {
        vals.push(Drupal.checkPlain($.trim($(this).text())));
      });

      if (!$('.form-item-status input', context).is(':checked')) {
        vals.unshift(Drupal.t('Not published'));
      }
      return vals.join(', ');
    });
  }
};

})(jQuery);
;
