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
/**
* hoverIntent r6 // 2011.02.26 // jQuery 1.5.1+
* <http://cherne.net/brian/resources/jquery.hoverIntent.html>
* 
* @param  f  onMouseOver function || An object with configuration options
* @param  g  onMouseOut function  || Nothing (use configuration options object)
* @author    Brian Cherne brian(at)cherne(dot)net
*/
(function($){$.fn.hoverIntent=function(f,g){var cfg={sensitivity:7,interval:100,timeout:0};cfg=$.extend(cfg,g?{over:f,out:g}:f);var cX,cY,pX,pY;var track=function(ev){cX=ev.pageX;cY=ev.pageY};var compare=function(ev,ob){ob.hoverIntent_t=clearTimeout(ob.hoverIntent_t);if((Math.abs(pX-cX)+Math.abs(pY-cY))<cfg.sensitivity){$(ob).unbind("mousemove",track);ob.hoverIntent_s=1;return cfg.over.apply(ob,[ev])}else{pX=cX;pY=cY;ob.hoverIntent_t=setTimeout(function(){compare(ev,ob)},cfg.interval)}};var delay=function(ev,ob){ob.hoverIntent_t=clearTimeout(ob.hoverIntent_t);ob.hoverIntent_s=0;return cfg.out.apply(ob,[ev])};var handleHover=function(e){var ev=jQuery.extend({},e);var ob=this;if(ob.hoverIntent_t){ob.hoverIntent_t=clearTimeout(ob.hoverIntent_t)}if(e.type=="mouseenter"){pX=ev.pageX;pY=ev.pageY;$(ob).bind("mousemove",track);if(ob.hoverIntent_s!=1){ob.hoverIntent_t=setTimeout(function(){compare(ev,ob)},cfg.interval)}}else{$(ob).unbind("mousemove",track);if(ob.hoverIntent_s==1){ob.hoverIntent_t=setTimeout(function(){delay(ev,ob)},cfg.timeout)}}};return this.bind('mouseenter',handleHover).bind('mouseleave',handleHover)}})(jQuery);;
/*
 * sf-Smallscreen v1.2b - Provides small-screen compatibility for the jQuery Superfish plugin.
 *
 * Developer's note:
 * Built as a part of the Superfish project for Drupal (http://drupal.org/project/superfish)
 * Found any bug? have any cool ideas? contact me right away! http://drupal.org/user/619294/contact
 *
 * jQuery version: 1.3.x or higher.
 *
 * Dual licensed under the MIT and GPL licenses:
 *  http://www.opensource.org/licenses/mit-license.php
 *  http://www.gnu.org/licenses/gpl.html
  */

(function($){
  $.fn.sfsmallscreen = function(options){
    options = $.extend({
      mode: 'inactive',
      type: 'accordion',
      breakpoint: 768,
      breakpointUnit: 'px',
      useragent: '',
      title: '',
      addSelected: false,
      menuClasses: false,
      hyperlinkClasses: false,
      excludeClass_menu: '',
      excludeClass_hyperlink: '',
      includeClass_menu: '',
      includeClass_hyperlink: '',
      accordionButton: 1,
      expandText: 'Expand',
      collapseText: 'Collapse'
    }, options);

    // We need to clean up the menu from anything unnecessary.
    function refine(menu){
      var
      refined = menu.clone(),
      // Things that should not be in the small-screen menus.
      rm = refined.find('span.sf-sub-indicator, span.sf-description'),
      // This is a helper class for those who need to add extra markup that shouldn't exist
      // in the small-screen versions.
      rh = refined.find('.sf-smallscreen-remove'),
      // Mega-menus has to be removed too.
      mm = refined.find('ul.sf-megamenu');
      for (var a = 0; a < rh.length; a++){
        rh.eq(a).replaceWith(rh.eq(a).html());
      }
      for (var b = 0; b < rm.length; b++){
        rm.eq(b).remove();
      }
      if (mm.length > 0){
        mm.removeClass('sf-megamenu');
        var ol = refined.find('div.sf-megamenu-column > ol');
        for (var o = 0; o < ol.length; o++){
          ol.eq(o).replaceWith('<ul>' + ol.eq(o).html() + '</ul>');
        }
        var elements = ['div.sf-megamenu-column','.sf-megamenu-wrapper > ol','li.sf-megamenu-wrapper'];
        for (var i = 0; i < elements.length; i++){
          obj = refined.find(elements[i]);
          for (var t = 0; t < obj.length; t++){
            obj.eq(t).replaceWith(obj.eq(t).html());
          }
        }
        refined.find('.sf-megamenu-column').removeClass('sf-megamenu-column');
      }
      refined.add(refined.find('*')).css({width:''});
      return refined;
    }

    // Creating <option> elements out of the menu.
    function toSelect(menu, level){
      var
      items = '',
      childLI = $(menu).children('li');
      for (var a = 0; a < childLI.length; a++){
        var list = childLI.eq(a), parent = list.children('a, span');
        for (var b = 0; b < parent.length; b++){
          var
          item = parent.eq(b),
          path = item.is('a') ? item.attr('href') : '',
          // Class names modification.
          itemClone = item.clone(),
          classes = (options.hyperlinkClasses) ? ((options.excludeClass_hyperlink && itemClone.hasClass(options.excludeClass_hyperlink)) ? itemClone.removeClass(options.excludeClass_hyperlink).attr('class') : itemClone.attr('class')) : '',
          classes = (options.includeClass_hyperlink && !itemClone.hasClass(options.includeClass_hyperlink)) ? ((options.hyperlinkClasses) ? itemClone.addClass(options.includeClass_hyperlink).attr('class') : options.includeClass_hyperlink) : classes;
          // Retaining the active class if requested.
          if (options.addSelected && item.hasClass('active')){
            classes += ' active';
          }
          // <option> has to be disabled if the item is not a link.
          disable = item.is('span') || item.attr('href')=='#' ? ' disabled="disabled"' : '',
          // Crystal clear.
          subIndicator = 1 < level ? Array(level).join('-') + ' ' : '';
          // Preparing the <option> element.
          items += '<option value="' + path + '" class="' + classes + '"' + disable + '>' + subIndicator + $.trim(item.text()) +'</option>',
          childUL = list.find('> ul');
          // Using the function for the sub-menu of this item.
          for (var u = 0; u < childUL.length; u++){
            items += toSelect(childUL.eq(u), level + 1);
          }
        }
      }
      return items;
    }

    // Create the new version, hide the original.
    function convert(menu){
      var menuID = menu.attr('id'),
      // Creating a refined version of the menu.
      refinedMenu = refine(menu);
      // Currently the plugin provides two reactions to small screens.
      // Converting the menu to a <select> element, and converting to an accordion version of the menu.
      if (options.type == 'accordion'){
        var
        toggleID = menuID + '-toggle',
        accordionID = menuID + '-accordion';
        // Making sure the accordion does not exist.
        if ($('#' + accordionID).length == 0){
          var
          // Getting the style class.
          styleClass = menu.attr('class').split(' ').filter(function(item){
            return item.indexOf('sf-style-') > -1 ? item : '';
          }),
          // Creating the accordion.
          accordion = $(refinedMenu).attr('id', accordionID);
          // Removing unnecessary classes.
          accordion.removeClass('sf-horizontal sf-vertical sf-navbar sf-shadow sf-js-enabled');
          // Adding necessary classes.
          accordion.addClass('sf-accordion sf-hidden');
          // Removing style attributes and any unnecessary class.
          accordion.children('li').removeAttr('style').removeClass('sfHover');
          // Doing the same and making sure all the sub-menus are off-screen (hidden).
          accordion.find('ul').removeAttr('style').not('.sf-hidden').addClass('sf-hidden');
          // Creating the accordion toggle switch.
          var toggle = '<div class="sf-accordion-toggle ' + styleClass + '"><a href="#" id="' + toggleID + '"><span>' + options.title + '</span></a></div>';

          // Adding Expand\Collapse buttons if requested.
          if (options.accordionButton == 2){
            var parent = accordion.find('li.menuparent');
            for (var i = 0; i < parent.length; i++){
              parent.eq(i).prepend('<a href="#" class="sf-accordion-button">' + options.expandText + '</a>');
            }
          }
          // Inserting the according and hiding the original menu.
          menu.before(toggle).before(accordion).hide();

          var
          accordionElement = $('#' + accordionID),
          // Deciding what should be used as accordion buttons.
          buttonElement = (options.accordionButton < 2) ? 'a.menuparent,span.nolink.menuparent' : 'a.sf-accordion-button',
          button = accordionElement.find(buttonElement);

          // Attaching a click event to the toggle switch.
          $('#' + toggleID).bind('click', function(e){
            // Preventing the click.
            e.preventDefault();
            // Adding the sf-expanded class.
            $(this).toggleClass('sf-expanded');

            if (accordionElement.hasClass('sf-expanded')){
              // If the accordion is already expanded:
              // Hiding its expanded sub-menus and then the accordion itself as well.
              accordionElement.add(accordionElement.find('li.sf-expanded')).removeClass('sf-expanded')
              .end().find('ul').hide()
              // This is a bit tricky, it's the same trick that has been in use in the main plugin for sometime.
              // Basically we'll add a class that keeps the sub-menu off-screen and still visible,
              // and make it invisible and removing the class one moment before showing or hiding it.
              // This helps screen reader software access all the menu items.
              .end().hide().addClass('sf-hidden').show();
              // Changing the caption of any existing accordion buttons to 'Expand'.
              if (options.accordionButton == 2){
                accordionElement.find('a.sf-accordion-button').text(options.expandText);
              }
            }
            else {
              // But if it's collapsed,
              accordionElement.addClass('sf-expanded').hide().removeClass('sf-hidden').show();
            }
          });

          // Attaching a click event to the buttons.
          button.bind('click', function(e){
            // Making sure the buttons does not exist already.
            if ($(this).closest('li').children('ul').length > 0){
              e.preventDefault();
              // Selecting the parent menu items.
              var parent = $(this).closest('li');
              // Creating and inserting Expand\Collapse buttons to the parent menu items,
              // of course only if not already happened.
              if (options.accordionButton == 1 && parent.children('a.menuparent,span.nolink.menuparent').length > 0 && parent.children('ul').children('li.sf-clone-parent').length == 0){
                var
                // Cloning the hyperlink of the parent menu item.
                cloneLink = parent.children('a.menuparent,span.nolink.menuparent').clone(),
                // Wrapping the hyerplinks in <li>.
                cloneLink = $('<li class="sf-clone-parent" />').html(cloneLink);
                // Adding a helper class and attaching them to the sub-menus.
                parent.children('ul').addClass('sf-has-clone-parent').prepend(cloneLink);
              }
              // Once the button is clicked, collapse the sub-menu if it's expanded.
              if (parent.hasClass('sf-expanded')){
                parent.children('ul').slideUp('fast', function(){
                  // Doing the accessibility trick after hiding the sub-menu.
                  $(this).closest('li').removeClass('sf-expanded').end().addClass('sf-hidden').show();
                });
                // Changing the caption of the inserted Collapse link to 'Expand', if any is inserted.
                if (options.accordionButton == 2 && parent.children('.sf-accordion-button').length > 0){
                  parent.children('.sf-accordion-button').text(options.expandText);
                }
              }
              // Otherwise, expand the sub-menu.
              else {
                // Doing the accessibility trick and then showing the sub-menu.
                parent.children('ul').hide().removeClass('sf-hidden').slideDown('fast')
                // Changing the caption of the inserted Expand link to 'Collape', if any is inserted.
                .end().addClass('sf-expanded').children('a.sf-accordion-button').text(options.collapseText)
                // Hiding any expanded sub-menu of the same level.
                .end().siblings('li.sf-expanded').children('ul')
                .slideUp('fast', function(){
                  // Doing the accessibility trick after hiding it.
                  $(this).closest('li').removeClass('sf-expanded').end().addClass('sf-hidden').show();
                })
                // Assuming Expand\Collapse buttons do exist, resetting captions, in those hidden sub-menus.
                .parent().children('a.sf-accordion-button').text(options.expandText);
              }
            }
          });
        }
      }
      else {
        var
        // Class names modification.
        menuClone = menu.clone(), classes = (options.menuClasses) ? ((options.excludeClass_menu && menuClone.hasClass(options.excludeClass_menu)) ? menuClone.removeClass(options.excludeClass_menu).attr('class') : menuClone.attr('class')) : '',
        classes = (options.includeClass_menu && !menuClone.hasClass(options.includeClass_menu)) ? ((options.menuClasses) ? menuClone.addClass(options.includeClass_menu).attr('class') : options.includeClass_menu) : classes,
        classes = (classes) ? ' class="' + classes + '"' : '';

        // Making sure the <select> element does not exist already.
        if ($('#' + menuID + '-select').length == 0){
          // Creating the <option> elements.
          var newMenu = toSelect(refinedMenu, 1),
          // Creating the <select> element and assigning an ID and class name.
          selectList = $('<select' + classes + ' id="' + menuID + '-select"/>')
          // Attaching the title and the items to the <select> element.
          .html('<option>' + options.title + '</option>' + newMenu)
          // Attaching an event then.
          .change(function(){
            // Except for the first option that is the menu title and not a real menu item.
            if ($('option:selected', this).index()){
              window.location = selectList.val();
            }
          });
          // Applying the addSelected option to it.
          if (options.addSelected){
            selectList.find('.active').attr('selected', !0);
          }
          // Finally inserting the <select> element into the document then hiding the original menu.
          menu.before(selectList).hide();
        }
      }
    }

    // Turn everything back to normal.
    function turnBack(menu){
      var
      id = '#' + menu.attr('id');
      // Removing the small screen version.
      $(id + '-' + options.type).remove();
      // Removing the accordion toggle switch as well.
      if (options.type == 'accordion'){
        $(id + '-toggle').parent('div').remove();
      }
      // Crystal clear!
      $(id).show();
    }

    // Return original object to support chaining.
    // Although this is unnecessary because of the way the module uses these plugins.
    for (var s = 0; s < this.length; s++){
      var
      menu = $(this).eq(s),
      mode = options.mode;
      // The rest is crystal clear, isn't it? :)
      if (mode == 'always_active'){
        convert(menu);
      }
      else if (mode == 'window_width'){
        var breakpoint = (options.breakpointUnit == 'em') ? (options.breakpoint * parseFloat($('body').css('font-size'))) : options.breakpoint,
        windowWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth,
        timer;
        if ((typeof Modernizr === 'undefined' || typeof Modernizr.mq !== 'function') && windowWidth < breakpoint){
          convert(menu);
        }
        else if (typeof Modernizr !== 'undefined' && typeof Modernizr.mq === 'function' && Modernizr.mq('(max-width:' + (breakpoint - 1) + 'px)')) {
          convert(menu);
        }
        $(window).resize(function(){
          clearTimeout(timer);
          timer = setTimeout(function(){
            var windowWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
            if ((typeof Modernizr === 'undefined' || typeof Modernizr.mq !== 'function') && windowWidth < breakpoint){
              convert(menu);
            }
            else if (typeof Modernizr !== 'undefined' && typeof Modernizr.mq === 'function' && Modernizr.mq('(max-width:' + (breakpoint - 1) + 'px)')) {
              convert(menu);
            }
            else {
              turnBack(menu);
            }
          }, 50);
        });
      }
      else if (mode == 'useragent_custom'){
        if (options.useragent != ''){
          var ua = RegExp(options.useragent, 'i');
          if (navigator.userAgent.match(ua)){
            convert(menu);
          }
        }
      }
      else if (mode == 'useragent_predefined' && navigator.userAgent.match(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od|ad)|iris|kindle|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i)){
        convert(menu);
      }
    }
    return this;
  }
})(jQuery);
;
/*
 * Supposition v0.2 - an optional enhancer for Superfish jQuery menu widget.
 *
 * Copyright (c) 2008 Joel Birch - based mostly on work by Jesse Klaasse and credit goes largely to him.
 * Special thanks to Karl Swedberg for valuable input.
 *
 * Dual licensed under the MIT and GPL licenses:
 *  http://www.opensource.org/licenses/mit-license.php
 *  http://www.gnu.org/licenses/gpl.html
 */
/*
 * This is not the original jQuery Supposition plugin.
 * Please refer to the README for more information.
 */

(function($){
  $.fn.supposition = function(){
    var $w = $(window), /*do this once instead of every onBeforeShow call*/
    _offset = function(dir) {
      return window[dir == 'y' ? 'pageYOffset' : 'pageXOffset']
      || document.documentElement && document.documentElement[dir=='y' ? 'scrollTop' : 'scrollLeft']
      || document.body[dir=='y' ? 'scrollTop' : 'scrollLeft'];
    },
    onHide = function(){
      this.css({bottom:''});
    },
    onBeforeShow = function(){
      this.each(function(){
        var $u = $(this);
        $u.css('display','block');
        var $mul = $u.closest('.sf-menu'),
        level = $u.parents('ul').length,
        menuWidth = $u.width(),
        menuParentWidth = $u.closest('li').outerWidth(true),
        menuParentLeft = $u.closest('li').offset().left,
        totalRight = $w.width() + _offset('x'),
        menuRight = $u.offset().left + menuWidth,
        exactMenuWidth = (menuRight > (menuParentWidth + menuParentLeft)) ? menuWidth - (menuRight - (menuParentWidth + menuParentLeft)) : menuWidth;
        if ($u.parents('.sf-js-enabled').hasClass('rtl')) {
          if (menuParentLeft < exactMenuWidth) {
            if (($mul.hasClass('sf-horizontal') && level == 1) || ($mul.hasClass('sf-navbar') && level == 2)){
              $u.css({left:0,right:'auto'});
            }
            else {
              $u.css({left:menuParentWidth + 'px',right:'auto'});
            }
          }
        }
        else {
          if (menuRight > totalRight && menuParentLeft > menuWidth) {
            if (($mul.hasClass('sf-horizontal') && level == 1) || ($mul.hasClass('sf-navbar') && level == 2)){
              $u.css({right:0,left:'auto'});
            }
            else {
              $u.css({right:menuParentWidth + 'px',left:'auto'});
            }
          }
        }
        var windowHeight = $w.height(),
        offsetTop = $u.offset().top,
        menuParentShadow = ($mul.hasClass('sf-shadow') && $u.css('padding-bottom').length > 0) ? parseInt($u.css('padding-bottom').slice(0,-2)) : 0,
        menuParentHeight = ($mul.hasClass('sf-vertical')) ? '-' + menuParentShadow : $u.parent().outerHeight(true) - menuParentShadow,
        menuHeight = $u.height(),
        baseline = windowHeight + _offset('y');
        var expandUp = ((offsetTop + menuHeight > baseline) && (offsetTop > menuHeight));
        if (expandUp) {
          $u.css({bottom:menuParentHeight + 'px',top:'auto'});
        }
        $u.css('display','none');
      });
    };

    return this.each(function() {
      var o = $.fn.superfish.o[this.serial]; /* get this menu's options */

      /* if callbacks already set, store them */
      var _onBeforeShow = o.onBeforeShow,
      _onHide = o.onHide;

      $.extend($.fn.superfish.o[this.serial],{
        onBeforeShow: function() {
          onBeforeShow.call(this); /* fire our Supposition callback */
          _onBeforeShow.call(this); /* fire stored callbacks */
        },
        onHide: function() {
          onHide.call(this); /* fire our Supposition callback */
          _onHide.call(this); /* fire stored callbacks */
        }
      });
    });
  };
})(jQuery);;
/*
 * Superfish v1.4.8 - jQuery menu widget
 * Copyright (c) 2008 Joel Birch
 *
 * Dual licensed under the MIT and GPL licenses:
 *  http://www.opensource.org/licenses/mit-license.php
 *  http://www.gnu.org/licenses/gpl.html
 *
 * CHANGELOG: http://users.tpg.com.au/j_birch/plugins/superfish/changelog.txt
 */
/*
 * This is not the original jQuery Superfish plugin.
 * Please refer to the README for more information.
 */

(function($){
  $.fn.superfish = function(op){
    var sf = $.fn.superfish,
      c = sf.c,
      $arrow = $(['<span class="',c.arrowClass,'"> &#187;</span>'].join('')),
      over = function(){
        var $$ = $(this), menu = getMenu($$);
        clearTimeout(menu.sfTimer);
        $$.showSuperfishUl().siblings().hideSuperfishUl();
      },
      out = function(){
        var $$ = $(this), menu = getMenu($$), o = sf.op;
        clearTimeout(menu.sfTimer);
        menu.sfTimer=setTimeout(function(){
          if ($$.children('.sf-clicked').length == 0){
            o.retainPath=($.inArray($$[0],o.$path)>-1);
            $$.hideSuperfishUl();
            if (o.$path.length && $$.parents(['li.',o.hoverClass].join('')).length<1){over.call(o.$path);}
          }
        },o.delay);
      },
      getMenu = function($menu){
        var menu = $menu.parents(['ul.',c.menuClass,':first'].join(''))[0];
        sf.op = sf.o[menu.serial];
        return menu;
      },
      addArrow = function($a){ $a.addClass(c.anchorClass).append($arrow.clone()); };

    return this.each(function() {
      var s = this.serial = sf.o.length;
      var o = $.extend({},sf.defaults,op);
      o.$path = $('li.'+o.pathClass,this).slice(0,o.pathLevels),
      p = o.$path;
      for (var l = 0; l < p.length; l++){
        p.eq(l).addClass([o.hoverClass,c.bcClass].join(' ')).filter('li:has(ul)').removeClass(o.pathClass);
      }
      sf.o[s] = sf.op = o;

      $('li:has(ul)',this)[($.fn.hoverIntent && !o.disableHI) ? 'hoverIntent' : 'hover'](over,out).each(function() {
        if (o.autoArrows) addArrow( $(this).children('a:first-child, span.nolink:first-child') );
      })
      .not('.'+c.bcClass)
        .hideSuperfishUl();

      var $a = $('a, span.nolink',this);
      $a.each(function(i){
        var $li = $a.eq(i).parents('li');
        $a.eq(i).focus(function(){over.call($li);}).blur(function(){out.call($li);});
      });
      o.onInit.call(this);

    }).each(function() {
      var menuClasses = [c.menuClass],
      addShadow = true;
      if ($.browser !== undefined){
        if ($.browser.msie && $.browser.version < 7){
          addShadow = false;
        }
      }
      if (sf.op.dropShadows && addShadow){
        menuClasses.push(c.shadowClass);
      }
      $(this).addClass(menuClasses.join(' '));
    });
  };

  var sf = $.fn.superfish;
  sf.o = [];
  sf.op = {};
  sf.IE7fix = function(){
    var o = sf.op;
    if ($.browser !== undefined){
      if ($.browser.msie && $.browser.version > 6 && o.dropShadows && o.animation.opacity != undefined) {
        this.toggleClass(sf.c.shadowClass+'-off');
      }
    }
  };
  sf.c = {
    bcClass: 'sf-breadcrumb',
    menuClass: 'sf-js-enabled',
    anchorClass: 'sf-with-ul',
    arrowClass: 'sf-sub-indicator',
    shadowClass: 'sf-shadow'
  };
  sf.defaults = {
    hoverClass: 'sfHover',
    pathClass: 'overideThisToUse',
    pathLevels: 1,
    delay: 800,
    animation: {opacity:'show'},
    speed: 'fast',
    autoArrows: true,
    dropShadows: true,
    disableHI: false, // true disables hoverIntent detection
    onInit: function(){}, // callback functions
    onBeforeShow: function(){},
    onShow: function(){},
    onHide: function(){}
  };
  $.fn.extend({
    hideSuperfishUl : function(){
      var o = sf.op,
        not = (o.retainPath===true) ? o.$path : '';
      o.retainPath = false;
      var $ul = $(['li.',o.hoverClass].join(''),this).add(this).not(not).removeClass(o.hoverClass)
          .children('ul').addClass('sf-hidden');
      o.onHide.call($ul);
      return this;
    },
    showSuperfishUl : function(){
      var o = sf.op,
        sh = sf.c.shadowClass+'-off',
        $ul = this.addClass(o.hoverClass)
          .children('ul.sf-hidden').hide().removeClass('sf-hidden');
      sf.IE7fix.call($ul);
      o.onBeforeShow.call($ul);
      $ul.animate(o.animation,o.speed,function(){ sf.IE7fix.call($ul); o.onShow.call($ul); });
      return this;
    }
  });
})(jQuery);;
/*
 * Supersubs v0.4b - jQuery plugin
 * Copyright (c) 2013 Joel Birch
 *
 * Dual licensed under the MIT and GPL licenses:
 *  http://www.opensource.org/licenses/mit-license.php
 *  http://www.gnu.org/licenses/gpl.html
 *
 * This plugin automatically adjusts submenu widths of suckerfish-style menus to that of
 * their longest list item children. If you use this, please expect bugs and report them
 * to the jQuery Google Group with the word 'Superfish' in the subject line.
 *
 */
/*
 * This is not the original jQuery Supersubs plugin.
 * Please refer to the README for more information.
 */

(function($){ // $ will refer to jQuery within this closure
  $.fn.supersubs = function(options){
    var opts = $.extend({}, $.fn.supersubs.defaults, options);
    // return original object to support chaining
    // Although this is unnecessary due to the way the module uses these plugins.
    for (var a = 0; a < this.length; a++) {
      // cache selections
      var $$ = $(this).eq(a),
      // support metadata
      o = $.meta ? $.extend({}, opts, $$.data()) : opts;
      // Jump one level if it's a "NavBar"
      if ($$.hasClass('sf-navbar')) {
        $$ = $$.children('li').children('ul');
      }
      // cache all ul elements
      var $ULs = $$.find('ul'),
      // get the font size of menu.
      // .css('fontSize') returns various results cross-browser, so measure an em dash instead
      fontsize = $('<li id="menu-fontsize">&#8212;</li>'),
      size = fontsize.attr('style','padding:0;position:absolute;top:-99999em;width:auto;')
      .appendTo($$)[0].clientWidth; //clientWidth is faster than width()
      // remove em dash
      fontsize.remove();

      // loop through each ul in menu
      for (var b = 0; b < $ULs.length; b++) {
        var
        // cache this ul
        $ul = $ULs.eq(b);
        // If a multi-column sub-menu, and only if correctly configured.
        if (o.megamenu && $ul.hasClass('sf-megamenu') && $ul.find('.sf-megamenu-column').length > 0){
          // Look through each column.
          var $column = $ul.find('div.sf-megamenu-column > ol'),
          // Overall width.
          mwWidth = 0;
          for (var d = 0; d < $column.length; d++){
            resize($column.eq(d));
            // New column width, in pixels.
            var colWidth = $column.width();
            // Just a trick to convert em unit to px.
            $column.css({width:colWidth})
            // Making column parents the same size.
            .parents('.sf-megamenu-column').css({width:colWidth});
            // Overall width.
            mwWidth += parseInt(colWidth);
          }
          // Resizing the columns container too.
          $ul.add($ul.find('li.sf-megamenu-wrapper, li.sf-megamenu-wrapper > ol')).css({width:mwWidth});
        }
        else {
          resize($ul);
        }
      }
    }
    function resize($ul){
      var
      // get all (li) children of this ul
      $LIs = $ul.children(),
      // get all anchor grand-children
      $As = $LIs.children('a');
      // force content to one line and save current float property
      $LIs.css('white-space','nowrap');
      // remove width restrictions and floats so elements remain vertically stacked
      $ul.add($LIs).add($As).css({float:'none',width:'auto'});
      // this ul will now be shrink-wrapped to longest li due to position:absolute
      // so save its width as ems.
      var emWidth = $ul.get(0).clientWidth / size;
      // add more width to ensure lines don't turn over at certain sizes in various browsers
      emWidth += o.extraWidth;
      // restrict to at least minWidth and at most maxWidth
      if (emWidth > o.maxWidth) {emWidth = o.maxWidth;}
      else if (emWidth < o.minWidth) {emWidth = o.minWidth;}
      emWidth += 'em';
      // set ul to width in ems
      $ul.css({width:emWidth});
      // restore li floats to avoid IE bugs
      // set li width to full width of this ul
      // revert white-space to normal
      $LIs.add($As).css({float:'',width:'',whiteSpace:''});
      // update offset position of descendant ul to reflect new width of parent.
      // set it to 100% in case it isn't already set to this in the CSS
      for (var c = 0; c < $LIs.length; c++) {
        var $childUl = $LIs.eq(c).children('ul');
        var offsetDirection = $childUl.css('left') !== undefined ? 'left' : 'right';
        $childUl.css(offsetDirection,'100%');
      }
    }
    return this;
  };
  // expose defaults
  $.fn.supersubs.defaults = {
    megamenu: true, // define width for multi-column sub-menus and their columns.
    minWidth: 12, // requires em unit.
    maxWidth: 27, // requires em unit.
    extraWidth: 1 // extra width can ensure lines don't sometimes turn over due to slight browser differences in how they round-off values
  };
})(jQuery); // plugin code ends
;
/**
 * @file
 * The Superfish Drupal Behavior to apply the Superfish jQuery plugin to lists.
 */

(function ($) {
  Drupal.behaviors.superfish = {
    attach: function (context, settings) {
      // Take a look at each list to apply Superfish to.
      $.each(settings.superfish || {}, function(index, options) {
        // Process all Superfish lists.
        $('#superfish-' + options.id, context).once('superfish', function() {
          var list = $(this);

          // Check if we are to apply the Supersubs plug-in to it.
          if (options.plugins || false) {
            if (options.plugins.supersubs || false) {
              list.supersubs(options.plugins.supersubs);
            }
          }

          // Apply Superfish to the list.
          list.superfish(options.sf);

          // Check if we are to apply any other plug-in to it.
          if (options.plugins || false) {
            if (options.plugins.touchscreen || false) {
              list.sftouchscreen(options.plugins.touchscreen);
            }
            if (options.plugins.smallscreen || false) {
              list.sfsmallscreen(options.plugins.smallscreen);
            }
            if (options.plugins.automaticwidth || false) {
              list.sfautomaticwidth();
            }
            if (options.plugins.supposition || false) {
              list.supposition();
            }
            if (options.plugins.bgiframe || false) {
              list.find('ul').bgIframe({opacity:false});
            }
          }
        });
      });
    }
  };
})(jQuery);;
