/**
 * Vertical Workspaces
 * prefs.js
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2022
 * @license    GPL-3.0
 */

'use strict';

const { Gtk } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();
const Settings       = Me.imports.settings;

const ItemFactory = Me.imports.optionsFactory.ItemFactory;
const AdwPrefs = Me.imports.optionsFactory.AdwPrefs;
const LegacyPrefs = Me.imports.optionsFactory.LegacyPrefs;

const shellVersion   = Settings.shellVersion;

// gettext
const _  = Settings._;

// libadwaita is available starting with GNOME Shell 42.
let Adw = null;
try { Adw = imports.gi.Adw; } catch (e) {}

let gOptions;
let pageList;
let itemFactory;


function init() {
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
    gOptions = new Settings.Options();

    itemFactory = new ItemFactory(gOptions);

    pageList = [
        {
            name: 'layout',
            title: _('Layout'),
            iconName: 'view-grid-symbolic',
            optionList: _getLayoutOptionList()
        },
        {
            name: 'adjustments',
            title: _('Adjustments'),
            iconName: 'preferences-other-symbolic',
            optionList: _getAdjustmentsOptionList()
        },
        {
            name: 'misc',
            title: _('Misc'),
            iconName: 'input-keyboard-symbolic',
            optionList: _getMiscOptionList()
        },
        {
            name: 'about',
            title: _('About'),
            iconName: 'preferences-system-details-symbolic',
            optionList: _getAboutOptionList()
        }
    ];
}

function fillPreferencesWindow(window) {
    window = new AdwPrefs(gOptions).getFilledWindow(window, pageList);
    window.connect('close-request', () => {
        gOptions.destroy();
        gOptions = null;
        itemFactory = null;
        pageList = null;
    });

    window.set_default_size(800, 800);
}

function buildPrefsWidget() {
    const prefsWidget = new LegacyPrefs(gOptions).getPrefsWidget(pageList);

    prefsWidget.connect('realize', (widget) => {
        const window = widget.get_root ? widget.get_root() : widget.get_toplevel();
        const width = 800;
        const height = 800;
        window.set_default_size(width, height);
        const headerbar = window.get_titlebar();
        headerbar.title_widget = prefsWidget._stackSwitcher;

        const signal = Gtk.get_major_version() === 3 ? 'destroy' : 'close-request';
        window.connect(signal, () => {
            gOptions.destroy();
            gOptions = null;
        });
    });

    return prefsWidget;
}

//////////////////////////////////////////////////////////////////////
function _getLayoutOptionList() {
    const optionList = [];
    // options item format:
    // [text, caption, widget, settings-variable, options for combo]

    optionList.push(
        itemFactory.getRowWidget(
            _('Dash'),
        )
    );

    optionList.push(
        itemFactory.getRowWidget(
            _('Dash Position'),
            null,
            itemFactory.newComboBox(),
            //itemFactory.newDropDown(),
            'dashPosition',
            [   [_('Top'), 0],
                [_('Right'), 1],
                [_('Bottom'), 2],
                [_('Left'), 3],
                [_('Disable'), 4],
            ]
        )
    );

    optionList.push(
        itemFactory.getRowWidget(
            _('Center Horizontal Dash to Workspace'),
            _('If the Dash Position is set to Top or Bottom, the position will be recalculated relative to the workspace preview instead of the screen. Works only with the default Dash.'),
            itemFactory.newSwitch(),
            'centerDashToWs',
        )
    );

    const dashPositionAdjustment = new Gtk.Adjustment({
        upper: 100,
        lower: -100,
        step_increment: 1,
        page_increment: 10,
    });

    const dashPositionScale = itemFactory.newScale(dashPositionAdjustment);
    dashPositionScale.add_mark(0, Gtk.PositionType.TOP, null);
    optionList.push(
        itemFactory.getRowWidget(
            _('Fine Tune Dash Position'),
            _('Adjusts position of the dock on chosen axis. Works only with the default Dash.'),
            dashPositionScale,
            'dashPositionAdjust'
        )
    );

    optionList.push(
        itemFactory.getRowWidget(
            _('Show Apps Icon Position'),
            _('Sets the position of the "Show Applications" icon in the Dash.'),
            itemFactory.newComboBox(),
            //itemFactory.newDropDown(),
            'showAppsIconPosition',
            [   [_('Start'), 0],
                [_('End'), 1],
            ]
        )
    );

    optionList.push(
        itemFactory.getRowWidget(
            _('Dash Max Icon Size'),
            _('Maximum size of Dash icons in pixels. Works only with default Dash.'),
            itemFactory.newComboBox(),
            //itemFactory.newDropDown(),
            'dashMaxIconSize',
            [   [_('16'), 0],
                [_('24'), 1],
                [_('32'), 2],
                [_('48'), 3],
                [_('64'), 4],
            ]
        )
    );

    optionList.push(
        itemFactory.getRowWidget(
            _('Workspace Thumbnails'),
        )
    );

    optionList.push(
        itemFactory.getRowWidget(
            _('Workspace Thumbnails Position and Max Height'),
            _('Position of the workspace thumbnails on the screen. Full-Height options allow the workspace thumbnails to use the full height of the screen at the expense of the space available for Dash.'),
            itemFactory.newComboBox(),
            //itemFactory.newDropDown(),
            'workspaceThumbnailsPosition',
            [   [_('Left'), 0],
                [_('Right'), 1],
                [_('Left - Full-Height'), 2],
                [_('Right - Full-Height'), 3],
                [_('Disable'), 4],
            ]
        )
    );

    const wstPositionAdjustment = new Gtk.Adjustment({
        upper: 100,
        lower: -100,
        step_increment: 1,
        page_increment: 10,
    });

    const wstPositionScale = itemFactory.newScale(wstPositionAdjustment);
    wstPositionScale.add_mark(0, Gtk.PositionType.TOP, null);
    optionList.push(
        itemFactory.getRowWidget(
            _('Fine Tune Workspace Thumbnails Position'),
            _('Adjusts workspace thumbnails vertical position.'),
            wstPositionScale,
            'wsTmbPositionAdjust'
        )
    );

    optionList.push(
        itemFactory.getRowWidget(
            _('Workspace Thumbnails Position on Secondary Monitor'),
            _('Allows you to place workspace thumbnails of the secondary monitor closer to the one on the primary monitor. "Default" option follows position of the primary workspace thumbnails.'),
            itemFactory.newComboBox(),
            //itemFactory.newDropDown(),
            'secondaryWsThumbnailsPosition',
            [   [_('Left'), 0],
                [_('Right'), 1],
                [_('Default'), 2],
                [_('Disable'), 3],
            ]
        )
    );

    const SecWstPositionAdjustment = new Gtk.Adjustment({
        upper: 100,
        lower: -100,
        step_increment: 1,
        page_increment: 10,
    });

    const SecWstPositionScale = itemFactory.newScale(SecWstPositionAdjustment);
    SecWstPositionScale.add_mark(0, Gtk.PositionType.TOP, null);
    optionList.push(
        itemFactory.getRowWidget(
            _('Fine Tune Secondary Workspace Thumbnails Position'),
            _('Adjusts secondary monitors workspace thumbnails vertical position.'),
            SecWstPositionScale,
            'SecWsTmbPositionAdjust'
        )
    );

    const wsThumbnailScaleAdjustment = new Gtk.Adjustment({
        upper: 30,
        lower: 5,
        step_increment: 1,
        page_increment: 1,
    });

    const wsThumbnailScale = itemFactory.newScale(wsThumbnailScaleAdjustment);
    wsThumbnailScale.add_mark(13, Gtk.PositionType.TOP, null);
    optionList.push(
        itemFactory.getRowWidget(
            _('Workspace Thumbnails Max Scale'),
            _('Adjusts maximum size of the workspace thumbnails (% relative to display width).'),
            wsThumbnailScale,
            'wsThumbnailScale'
        )
    );

    optionList.push(
        itemFactory.getRowWidget(
            _('App Grid'),
        )
    );

    optionList.push(
        itemFactory.getRowWidget(
            _('Center App Grid'),
            _('App grid in app view page will be centered to the display instead of the available space. This option may have impact on the size of the grid, more for narrower and small resolution displays, especially if workspace thumbnails are bigger.'),
            itemFactory.newSwitch(),
            'centerAppGrid',
        )
    );

    optionList.push(
        itemFactory.getRowWidget(
            _('Search View'),
        )
    );

    optionList.push(
        itemFactory.getRowWidget(
            _('Center Search View'),
            _('Search view will be centered to the display instead of the available space. If needed workspace thumbnails will be temporarily scaled down to fit the search box. This option has bigger impact for narrower and small resolution displays.'),
            itemFactory.newSwitch(),
            'centerSearch',
        )
    );

    optionList.push(
        itemFactory.getRowWidget(
            _('Always Show Search Entry'),
            _('If disabled, the search entry field will be hidden when not in use, so the workspace preview and app grid may take up more space.'),
            itemFactory.newSwitch(),
            'showSearchEntry',
        )
    );

    return optionList;
}

function _getAdjustmentsOptionList() {
    const optionList = [];
    // options item format:
    // [text, caption, widget, settings-variable, options for combo]

    //----------------------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Appearance'),
        )
    );

    const dashBgAdjustment = new Gtk.Adjustment({
        upper: 100,
        lower: 0,
        step_increment: 1,
        page_increment: 10,
    });

    const dashBgOpacityScale = itemFactory.newScale(dashBgAdjustment);
    optionList.push(
        itemFactory.getRowWidget(
            _('Dash Background Opacity'),
            _('Adjusts opacity of the default background (%).'),
            dashBgOpacityScale,
            'dashBgOpacity'
        )
    );

    optionList.push(
        itemFactory.getRowWidget(
            _('Show Workspace Thumbnails Labels'),
            _('Each workspace thumbnail can show its index and name (if defined in the system settings) or name of its most recently used app.'),
            itemFactory.newComboBox(),
            //itemFactory.newDropDown(),
            'showWsTmbLabels',
            [   [_('Disable'), 0],
                [_('Index'), 1],
                [_('Index + WS Name'), 2],
                [_('Index + App Name'), 3],
            ]
        )
    );

    optionList.push(
        itemFactory.getRowWidget(
            _('Show WS Thumbnail Label on Hover'),
            _('Show label only when the mouse pointer hovers over a thumbnail'),
            itemFactory.newSwitch(),
            'showWsTmbLabelsOnHover',
        )
    );

    optionList.push(
        itemFactory.getRowWidget(
            _('Show Wallpaper in Workspace Thumbnails'),
            _('Workspace thumbnails will include the current desktop background.'),
            itemFactory.newSwitch(),
            'showWsSwitcherBg',
        )
    );

    optionList.push(
        itemFactory.getRowWidget(
            _('Show Workspace Preview Background'),
            _('Allows you to hide the scaling background of the workspace preview.'),
            itemFactory.newSwitch(),
            'showWsPreviewBg',
        )
    );

    optionList.push(
        itemFactory.getRowWidget(
            _('Show Static Background'),
            _('Show static background wallpaper instead of the solid grey color.'),
            itemFactory.newSwitch(),
            'showBgInOverview',
        )
    );

    const blurBgAdjustment = new Gtk.Adjustment({
        upper: 100,
        lower: 0,
        step_increment: 1,
        page_increment: 10,
    });

    const bgBlurScale = itemFactory.newScale(blurBgAdjustment);
    optionList.push(
        itemFactory.getRowWidget(
            _('Blur Static Background'),
            _('Blur the background wallpaper (if enabled) in the overview. Even if you set the value to 0, the wallpaper will be blurred in the App Grid view for better readability.'),
            bgBlurScale,
            'overviewBgBlurSigma'
        )
    );    

    optionList.push(
        itemFactory.getRowWidget(
            _('Window Preview App Icon Size'),
            _('Default size is 64.'),
            itemFactory.newComboBox(),
            //itemFactory.newDropDown(),
            'winPreviewIconSize',
            [   [_('64'), 0],
                [_('48'), 1],
                [_('32'), 2],
                [_('22'), 3],
                [_('Disable'), 4]
            ]
        )
    );

    //----------------------------------------------------------------

    optionList.push(
        itemFactory.getRowWidget(
            _('Behavior'),
        )
    );

    optionList.push(
        itemFactory.getRowWidget(
            _('App Grid Animation'),
            _(`When entering the App Grid view, the app grid animates from the edge of the screen (defaultly from the right edge to follow the three fingers trackpad gesture). You can choose other direction or disable the animation if you don't like it.`),
            itemFactory.newComboBox(),
            //itemFactory.newDropDown(),
            'appGridAnimation',
            [   [_('Disable'), 0],
                [_('From Right'), 1],
                [_('From Left'), 2],
                [_('From Bottom'), 3],
                [_('Auto'), 4]
            ]
        )
    );

    optionList.push(
        itemFactory.getRowWidget(
            _('Workspace Animation'),
            _(`When entering / leaving the App Grid view, the workspace can animate to/from workspace thumbnails. The animation can be choppy if you have many workspaces with many windows and weak hw.`),
            itemFactory.newComboBox(),
            //itemFactory.newDropDown(),
            'workspaceAnimation',
            [   [_('Disable'), 0],
                [_('Enable'), 1],
            ]
        )
    );

    optionList.push(
        itemFactory.getRowWidget(
            _('Startup State'),
            _('Allows to change the state in which GNOME Shell starts a session.'),
            itemFactory.newComboBox(),
            //itemFactory.newDropDown(),
            'startupState',
            [   [_('Overview'), 0],
                [_('Desktop'), 1],
            ]
        )
    );

    return optionList;
}

function _getMiscOptionList() {
    const optionList = [];
    // options item format:
    // [text, caption, widget, settings-variable, options for combo]

    optionList.push(
       itemFactory.getRowWidget(
            _('Keyboard'),
        )
    );

    optionList.push(
       itemFactory.getRowWidget(
            _('Override Page Up/Down Shortcuts'),
            _('This option automatically overrides the (Sift +) Super + Page Up/Down keyboard shortcuts for the current workspace orientation. If you encounter any issues, check the configuration in the dconf editor.'),
            itemFactory.newSwitch(),
            'enablePageShortcuts',
        )
    );

    optionList.push(
       itemFactory.getRowWidget(
            _('Compatibility'),
        )
    );

    optionList.push(
       itemFactory.getRowWidget(
            _('Fix for Dash to Dock'),
            _('With the default Ubuntu Dock and other Dash To Dock forks, you may experience issues with Activities overview after you change Dock position or change monitors configuration. If you are experiencing such issues, try to enable this option, or disable/replace the dock extension.'),
            itemFactory.newSwitch(),
            'fixUbuntuDock',
        )
    );

    return optionList;
}

function _getAboutOptionList() {
    const optionList = [];

    optionList.push(itemFactory.getRowWidget(
        Me.metadata.name
    ));

    optionList.push(itemFactory.getRowWidget(
        _('Version'),
        null,
        itemFactory.newLabel(Me.metadata.version.toString()),
    ));

    optionList.push(itemFactory.getRowWidget(
        _('Reset all options'),
        _('Set all options to default values.'),
        itemFactory.newOptionsResetButton(),
    ));


    optionList.push(itemFactory.getRowWidget(
        _('Links')
    ));

    optionList.push(itemFactory.getRowWidget(
        _('Homepage'),
        _('Source code and more info about this extension'),
        itemFactory.newLinkButton('https://github.com/G-dH/vertical-workspaces'),
    ));

    optionList.push(itemFactory.getRowWidget(
        _('Changelog'),
        _("See what's changed."),
        itemFactory.newLinkButton('https://github.com/G-dH/vertical-workspaces/blob/main/CHANGELOG.md'),
    ));

    optionList.push(itemFactory.getRowWidget(
        _('Gnome Extensions'),
        _('Rate and comment the extension on GNOME Extensions site.'),
        itemFactory.newLinkButton('https://extensions.gnome.org/extension/5177'),
    ));

    optionList.push(itemFactory.getRowWidget(
        _('Report a bug or suggest new feature'),
        null,
        itemFactory.newLinkButton('https://github.com/G-dH/vertical-workspaces/issues'),
    ));

    optionList.push(itemFactory.getRowWidget(
        _('Buy Me a Coffee'),
        _('If you like this extension, you can help me with my coffee expenses.'),
        itemFactory.newLinkButton('https://buymeacoffee.com/georgdh'),
    ));

    return optionList;
}
