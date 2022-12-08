/**
 * Vertical Workspaces
 * dash.js
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2022
 * @license    GPL-3.0
 * modified dash module of https://github.com/RensAlthuis/vertical-overview extension
 */

const { Clutter, GLib, GObject, Graphene, Meta, Shell, St } = imports.gi;
const AppDisplay = imports.ui.appDisplay;
const AppFavorites = imports.ui.appFavorites;
const DND = imports.ui.dnd;
const IconGrid = imports.ui.iconGrid;
const Main = imports.ui.main;
const Overview = imports.ui.overview;
const Dash = imports.ui.dash;
const { DashIcon, DashItemContainer, getAppFromSource, DragPlaceholderItem } = imports.ui.dash;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Util = Me.imports.util;

let verticalOverrides = {};
let _origWorkId;
let _newWorkId;

var baseIconSizes = [16, 24, 32, 48, 64];
var MAX_ICON_SIZE = 64;
var DASH_POSITION = 0;
var DashPosition = {};
const DASH_ITEM_LABEL_SHOW_TIME = 150;

function override(horizonatal = false) {
    if (verticalOverrides !== {})
        reset();

    verticalOverrides['DashItemContainer'] = Util.overrideProto(Dash.DashItemContainer.prototype, DashItemContainerOverride);

    const dash = Main.overview.dash;
    if (horizonatal) {
        verticalOverrides['DashCommon'] = Util.overrideProto(Dash.Dash.prototype, DashCommonOverride);
        if (_origWorkId)
            dash._workId = _origWorkId;
    }
    else {
        verticalOverrides['Dash'] = Util.overrideProto(Dash.Dash.prototype, DashOverride);
        verticalOverrides['DashCommon'] = Util.overrideProto(Dash.Dash.prototype, DashCommonOverride);
        set_to_vertical();
        dash.add_style_class_name("vertical-overview");

        if (!_newWorkId) {
            _origWorkId = dash._workId;
            dash._workId = Main.initializeDeferredWork(dash._box, dash._redisplay.bind(dash));
            _newWorkId = dash._workId;
        } else {
            dash._workId = _newWorkId;
        }
    }
}

function reset() {
    if (verticalOverrides === {})
        return;
    if (Main.overview.dash._isHorizontal === undefined)
        set_to_horizontal();
    Util.overrideProto(Dash.Dash.prototype, verticalOverrides['Dash']);
    Util.overrideProto(Dash.Dash.prototype, verticalOverrides['DashCommon']);
    Util.overrideProto(Dash.DashItemContainer.prototype, verticalOverrides['DashItemContainer']);
    verticalOverrides = {};
    Main.overview.dash.remove_style_class_name("vertical-overview");
    Main.overview.dash.remove_style_class_name("vertical-overview-left");
    Main.overview.dash.remove_style_class_name("vertical-overview-right");
}

function set_to_vertical() {
    let dash = Main.overview.dash;
    // don't touch Dash to Dock
    if (dash._isHorizontal !== undefined)
        return;

    dash._box.layout_manager.orientation = Clutter.Orientation.VERTICAL;
    dash._dashContainer.layout_manager.orientation = Clutter.Orientation.VERTICAL;
    dash._dashContainer.y_expand = false;
    dash._dashContainer.x_expand = true;
    dash.x_align = Clutter.ActorAlign.START;
    dash.y_align = Clutter.ActorAlign.CENTER;

    let sizerBox = dash._background.get_children()[0];
    sizerBox.clear_constraints();
    sizerBox.add_constraint(new Clutter.BindConstraint({
        source: dash._showAppsIcon.icon,
        coordinate: Clutter.BindCoordinate.WIDTH,
    }));
    sizerBox.add_constraint(new Clutter.BindConstraint({
        source: dash._dashContainer,
        coordinate: Clutter.BindCoordinate.HEIGHT,
    }));
    dash._box.remove_all_children();
    dash._separator = null;
    dash._queueRedisplay();

    dash.add_style_class_name(DASH_POSITION === DashPosition.LEFT ? 'vertical-overview-left' : 'vertical-overview-right');
}

function set_to_horizontal() {
    let dash = Main.overview._overview._controls.dash;
    if (_origWorkId)
        dash._workId = _origWorkId; //pretty sure this is a leak, but there no provided way to disconnect these...
    dash._box.layout_manager.orientation = Clutter.Orientation.HORIZONTAL;
    dash._dashContainer.layout_manager.orientation = Clutter.Orientation.HORIZONTAL;
    dash._dashContainer.y_expand = true;
    dash._dashContainer.x_expand = false;
    dash.x_align = Clutter.ActorAlign.CENTER;
    dash.y_align = 0;

    let sizerBox = dash._background.get_children()[0];
    sizerBox.clear_constraints();
    sizerBox.add_constraint(new Clutter.BindConstraint({
        source: dash._showAppsIcon.icon,
        coordinate: Clutter.BindCoordinate.HEIGHT,
    }));
    sizerBox.add_constraint(new Clutter.BindConstraint({
        source: dash._dashContainer,
        coordinate: Clutter.BindCoordinate.WIDTH,
    }));

    dash._box.remove_all_children();
    dash._separator = null;
    dash._queueRedisplay();
}

var DashOverride = {
    handleDragOver: function (source, actor, _x, y, _time) {
        let app = getAppFromSource(source);

        // Don't allow favoriting of transient apps
        if (app == null || app.is_window_backed())
            return DND.DragMotionResult.NO_DROP;

        if (!global.settings.is_writable('favorite-apps'))
            return DND.DragMotionResult.NO_DROP;

        let favorites = AppFavorites.getAppFavorites().getFavorites();
        let numFavorites = favorites.length;

        let favPos = favorites.indexOf(app);

        let children = this._box.get_children();
        let numChildren = children.length;
        let boxHeight = this._box.height;

        // Keep the placeholder out of the index calculation; assuming that
        // the remove target has the same size as "normal" items, we don't
        // need to do the same adjustment there.
        if (this._dragPlaceholder) {
            boxHeight -= this._dragPlaceholder.height;
            numChildren--;
        }

        // Same with the separator
        if (this._separator) {
            boxHeight -= this._separator.height;
            numChildren--;
        }

        let pos;
        if (!this._emptyDropTarget)
            pos = Math.floor(y * numChildren / boxHeight);
        else
            pos = 0; // always insert at the top when dash is empty

        // Put the placeholder after the last favorite if we are not
        // in the favorites zone
        if (pos > numFavorites)
            pos = numFavorites;

        if (pos !== this._dragPlaceholderPos && this._animatingPlaceholdersCount === 0) {
            this._dragPlaceholderPos = pos;

            // Don't allow positioning before or after self
            if (favPos != -1 && (pos == favPos || pos == favPos + 1)) {
                this._clearDragPlaceholder();
                return DND.DragMotionResult.CONTINUE;
            }

            // If the placeholder already exists, we just move
            // it, but if we are adding it, expand its size in
            // an animation
            let fadeIn;
            if (this._dragPlaceholder) {
                this._dragPlaceholder.destroy();
                fadeIn = false;
            } else {
                fadeIn = true;
            }

            this._dragPlaceholder = new DragPlaceholderItem();
            this._dragPlaceholder.child.set_width(this.iconSize / 2);
            this._dragPlaceholder.child.set_height(this.iconSize);
            this._box.insert_child_at_index(this._dragPlaceholder,
                this._dragPlaceholderPos);
            this._dragPlaceholder.show(fadeIn);
        }

        if (!this._dragPlaceholder)
            return DND.DragMotionResult.NO_DROP;

        let srcIsFavorite = favPos != -1;

        if (srcIsFavorite)
            return DND.DragMotionResult.MOVE_DROP;

        return DND.DragMotionResult.COPY_DROP;
    },

    _redisplay: function () {
        let favorites = AppFavorites.getAppFavorites().getFavoriteMap();

        let running = this._appSystem.get_running();

        let children = this._box.get_children().filter(actor => {
            return actor.child &&
                actor.child._delegate &&
                actor.child._delegate.app;
        });
        // Apps currently in the dash
        let oldApps = children.map(actor => actor.child._delegate.app);
        // Apps supposed to be in the dash
        let newApps = [];

        for (let id in favorites)
            newApps.push(favorites[id]);

        for (let i = 0; i < running.length; i++) {
            let app = running[i];
            if (app.get_id() in favorites)
                continue;
            newApps.push(app);
        }

        // Figure out the actual changes to the list of items; we iterate
        // over both the list of items currently in the dash and the list
        // of items expected there, and collect additions and removals.
        // Moves are both an addition and a removal, where the order of
        // the operations depends on whether we encounter the position
        // where the item has been added first or the one from where it
        // was removed.
        // There is an assumption that only one item is moved at a given
        // time; when moving several items at once, everything will still
        // end up at the right position, but there might be additional
        // additions/removals (e.g. it might remove all the launchers
        // and add them back in the new order even if a smaller set of
        // additions and removals is possible).
        // If above assumptions turns out to be a problem, we might need
        // to use a more sophisticated algorithm, e.g. Longest Common
        // Subsequence as used by diff.
        let addedItems = [];
        let removedActors = [];

        let newIndex = 0;
        let oldIndex = 0;
        while (newIndex < newApps.length || oldIndex < oldApps.length) {
            let oldApp = oldApps.length > oldIndex ? oldApps[oldIndex] : null;
            let newApp = newApps.length > newIndex ? newApps[newIndex] : null;

            // No change at oldIndex/newIndex
            if (oldApp == newApp) {
                oldIndex++;
                newIndex++;
                continue;
            }

            // App removed at oldIndex
            if (oldApp && !newApps.includes(oldApp)) {
                removedActors.push(children[oldIndex]);
                oldIndex++;
                continue;
            }

            // App added at newIndex
            if (newApp && !oldApps.includes(newApp)) {
                addedItems.push({
                    app: newApp,
                    item: this._createAppItem(newApp),
                    pos: newIndex
                });
                newIndex++;
                continue;
            }

            // App moved
            let nextApp = newApps.length > newIndex + 1
                ? newApps[newIndex + 1] : null;
            let insertHere = nextApp && nextApp == oldApp;
            let alreadyRemoved = removedActors.reduce((result, actor) => {
                let removedApp = actor.child._delegate.app;
                return result || removedApp == newApp;
            }, false);

            if (insertHere || alreadyRemoved) {
                let newItem = this._createAppItem(newApp);
                addedItems.push({
                    app: newApp,
                    item: newItem,
                    pos: newIndex + removedActors.length
                });
                newIndex++;
            } else {
                removedActors.push(children[oldIndex]);
                oldIndex++;
            }
        }

        for (let i = 0; i < addedItems.length; i++) {
            this._box.insert_child_at_index(addedItems[i].item,
                addedItems[i].pos);
        }

        for (let i = 0; i < removedActors.length; i++) {
            let item = removedActors[i];

            // Don't animate item removal when the overview is transitioning
            // or hidden
            if (Main.overview.visible && !Main.overview.animationInProgress)
                item.animateOutAndDestroy();
            else
                item.destroy();
        }

        this._adjustIconSize();

        // Skip animations on first run when adding the initial set
        // of items, to avoid all items zooming in at once

        let animate = this._shownInitially && Main.overview.visible &&
            !Main.overview.animationInProgress;

        if (!this._shownInitially)
            this._shownInitially = true;

        for (let i = 0; i < addedItems.length; i++)
            addedItems[i].item.show(animate);

        // Update separator
        const nFavorites = Object.keys(favorites).length;
        const nIcons = children.length + addedItems.length - removedActors.length;
        if (nFavorites > 0 && nFavorites < nIcons) {
            // destroy the horizontal separator if it exists.
            // this is incredibly janky, but I can't think of a better way atm.
            if (this._separator && this._separator.height !== 1) {
                this._separator.destroy();
                this._separator = null;
            }

            if (!this._separator) {
                this._separator = new St.Widget({
                    style_class: 'dash-separator',
                    x_align: Clutter.ActorAlign.CENTER,
                    y_align: Clutter.ActorAlign.CENTER,
                    width: this.iconSize,
                    height: 1,
                });
                this._box.add_child(this._separator)
            }

            //FIXME: separator placement is broken (also in original dash)
            let pos = nFavorites;
            if (this._dragPlaceholder)
                pos++;
            this._box.set_child_at_index(this._separator, pos);
        } else if (this._separator) {
            this._separator.destroy();
            this._separator = null;
        }
        // Workaround for https://bugzilla.gnome.org/show_bug.cgi?id=692744
        // Without it, StBoxLayout may use a stale size cache
        this._box.queue_relayout();
    },

    _createAppItem: function (app) {
        let appIcon = new DashIcon(app);

        let indicator = appIcon._dot;
        indicator.x_align = DASH_POSITION === 3 ? Clutter.ActorAlign.START : Clutter.ActorAlign.END;
        indicator.y_align = Clutter.ActorAlign.CENTER;

        appIcon.connect('menu-state-changed',
            (o, opened) => {
                this._itemMenuStateChanged(item, opened);
            });

        let item = new DashItemContainer();
        item.setChild(appIcon);

        // Override default AppIcon label_actor, now the
        // accessible_name is set at DashItemContainer.setLabelText
        appIcon.label_actor = null;
        item.setLabelText(app.get_name());

        appIcon.icon.setIconSize(this.iconSize);
        this._hookUpLabel(item, appIcon);

        return item;
    }
}

var DashItemContainerOverride = {
    // move labels under the icons
    showLabel: function() {
        if (!this._labelText)
            return;

        this.label.set_text(this._labelText);
        this.label.opacity = 0;
        this.label.show();

        let [stageX, stageY] = this.get_transformed_position();

        const itemWidth = this.allocation.get_width();
        const itemHeight = this.allocation.get_height();

        const labelWidth = this.label.get_width();
        const labelHeight = this.label.get_height();
        const xOffset = Math.floor((itemWidth - labelWidth) / 2);
        let x = Math.clamp(stageX + xOffset, 0, global.stage.width - labelWidth);

        let node = this.label.get_theme_node();
        let y;

        if (DASH_POSITION === DashPosition.TOP) {
            const yOffset = itemHeight - labelHeight + 3 * node.get_length('-y-offset');
            y = stageY + yOffset;

        } else  if (DASH_POSITION === DashPosition.BOTTOM) {
            const yOffset = node.get_length('-y-offset');
            y = stageY - this.label.height - yOffset;

        } else if (DASH_POSITION === DashPosition.RIGHT) {
            const yOffset = Math.floor((itemHeight - labelHeight) / 2);

            const xOffset = 4;

            x = stageX - xOffset - this.label.width;
            y = Math.clamp(stageY + yOffset, 0, global.stage.height - labelHeight);

        } if (DASH_POSITION === DashPosition.LEFT) {
            const yOffset = Math.floor((itemHeight - labelHeight) / 2);

            const xOffset = 4;

            x = stageX + this.width + xOffset;
            y = Math.clamp(stageY + yOffset, 0, global.stage.height - labelHeight);
        }

        this.label.set_position(x, y);
        this.label.ease({
            opacity: 255,
            duration: DASH_ITEM_LABEL_SHOW_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });

        this.label.set_position(x, y);
        this.label.ease({
            opacity: 255,
            duration: DASH_ITEM_LABEL_SHOW_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }
}

var DashCommonOverride = {
    _adjustIconSize: function () {
        // For the icon size, we only consider children which are "proper"
        // icons (i.e. ignoring drag placeholders) and which are not
        // animating out (which means they will be destroyed at the end of
        // the animation)
        let iconChildren = this._box.get_children().filter(actor => {
            return actor.child &&
                actor.child._delegate &&
                actor.child._delegate.icon &&
                !actor.animatingOut;
        });

        iconChildren.push(this._showAppsIcon);

        if (this._maxWidth === -1 || this._maxHeight === -1)
            return;

        const dashHorizontal = [0, 2].includes(DASH_POSITION);

        const themeNode = this.get_theme_node();
        const maxAllocation = new Clutter.ActorBox({
            x1: 0,
            y1: 0,
            x2: dashHorizontal ? this._maxWidth :  42, // not whatever
            y2: dashHorizontal ? 42 : this._maxHeight,
        });

        let maxContent = themeNode.get_content_box(maxAllocation);

        let spacing = themeNode.get_length('spacing');

        let firstButton = iconChildren[0].child;
        let firstIcon = firstButton._delegate.icon;

        // Enforce valid spacings during the size request
        firstIcon.icon.ensure_style();
        const [, , iconWidth, iconHeight] = firstIcon.icon.get_preferred_size();
        const [, , buttonWidth, buttonHeight] = firstButton.get_preferred_size();

        let availWidth, availHeight, maxIconSize;
        if (dashHorizontal) {
            availWidth = maxContent.x2 - maxContent.x1;
            // Subtract icon padding and box spacing from the available width
            availWidth -= iconChildren.length * (buttonWidth - iconWidth) +
                           (iconChildren.length - 1) * spacing +
                           2 * this._background.get_theme_node().get_horizontal_padding();

            availHeight = this._maxHeight;
            availHeight -= this.margin_top + this.margin_bottom;
            availHeight -= this._background.get_theme_node().get_vertical_padding();
            availHeight -= themeNode.get_vertical_padding();
            availHeight -= buttonHeight - iconHeight;

            maxIconSize = Math.min(availWidth / iconChildren.length, availHeight, MAX_ICON_SIZE);
        } else {
            availWidth = this._maxWidth;
            availWidth -= this._background.get_theme_node().get_horizontal_padding();
            availWidth -= themeNode.get_horizontal_padding();
            availWidth -= buttonWidth - iconWidth;

            availHeight = maxContent.y2 - maxContent.y1;
            availHeight -= iconChildren.length * (buttonHeight - iconHeight) +
                            (iconChildren.length - 1) * spacing +
                            2 * this._background.get_theme_node().get_vertical_padding();

            maxIconSize = Math.min(availWidth, availHeight / iconChildren.length, MAX_ICON_SIZE);
        }

        let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        let iconSizes = baseIconSizes.map(s => s * scaleFactor);

        let newIconSize = baseIconSizes[0];
        for (let i = 0; i < iconSizes.length; i++) {
            if (iconSizes[i] <= maxIconSize)
                newIconSize = baseIconSizes[i];
        }

        if (newIconSize == this.iconSize)
            return;

        let oldIconSize = this.iconSize;
        this.iconSize = newIconSize;
        this.emit('icon-size-changed');

        let scale = oldIconSize / newIconSize;
        for (let i = 0; i < iconChildren.length; i++) {
            let icon = iconChildren[i].child._delegate.icon;

            // Set the new size immediately, to keep the icons' sizes
            // in sync with this.iconSize
            icon.setIconSize(this.iconSize);

            // Don't animate the icon size change when the overview
            // is transitioning, not visible or when initially filling
            // the dash
            if (!Main.overview.visible || Main.overview.animationInProgress ||
                !this._shownInitially)
                continue;

            let [targetWidth, targetHeight] = icon.icon.get_size();

            // Scale the icon's texture to the previous size and
            // tween to the new size
            icon.icon.set_size(icon.icon.width * scale,
                               icon.icon.height * scale);

            icon.icon.ease({
                width: targetWidth,
                height: targetHeight,
                duration: Dash.DASH_ANIMATION_TIME,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        }

        if (this._separator) {
            this._separator.ease({
                width: dashHorizontal ? 1 : this.iconSize,
                height: dashHorizontal ? this.iconSize : 1,
                duration: Dash.DASH_ANIMATION_TIME,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        }
    },
}
