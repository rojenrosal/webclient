class GalleryTitleControl extends MComponent {
    buildElement() {
        this.el = document.createElement('div');
        this.el.setAttribute('class', 'flex flex-row items-center text-ellipsis');

        this.attachIcon();
        this.attachTitle();
    }

    get filterSection() {
        return this._filterSection || '';
    }

    /**
     * Set the filter section
     * @param {String} section Gallery section to filter
     * @type {String}
     */
    set filterSection(section) {
        if (!mega.gallery.sections[section]) {
            return;
        }

        this.isClickable = section !== 'favourites';

        section = mega.gallery.sections[section].root;

        if (this.isClickable) {
            this._filterSection = section;
            this.initMenu();
            this.resetItemOptions();
        }
    }

    get title() {
        return this._title || '';
    }

    /**
     * @param {String} title Title of the block
     */
    set title(title) {
        if (this._title !== title) {
            this._title = title;
            this.titleEl.textContent = title;
        }
    }

    get icon() {
        return this._icon || '';
    }

    /**
     * @param {String} icon Icon prepending the title
     */
    set icon(icon) {
        if (this._icon !== icon) {
            this._icon = icon;
            this.iconEl.setAttribute('class', 'sprite-fm-mono icon-' + icon);
        }
    }

    get isClickable() {
        return this._isClickable === true;
    }

    /**
     * @param {Boolean} status Whether control is clickable at the moment or not
     */
    set isClickable(status) {
        this._isClickable = status;

        if (status) {
            this.el.classList.add('cursor-pointer');
            this.attachCaret();

            this.attachEvent('click', () => {
                this.toggleMenu();
            });
        }
        else {
            this.el.classList.remove('cursor-pointer');
            this.detachCaret();
            this.disposeEvent('click');
        }
    }

    /**
     * @type {String}
     */
    get allItemsTitle() {
        return l.gallery_all_locations;
    }

    /**
     * @type {String}
     */
    get cuFolder() {
        return 'camera-uploads-' + this._filterSection;
    }

    /**
     * @type {String}
     */
    get cdFolder() {
        return 'cloud-drive-' + this._filterSection;
    }

    attachTitle() {
        this.titleEl = document.createElement('span');
        this.el.append(this.titleEl);
    }

    addTooltipToTitle() {
        if (this.titleEl) {
            this.titleEl.classList.add('text-ellipsis', 'simpletip', 'simpletip-tc');
        }
    }

    removeTooltipFromTitle() {
        if (this.titleEl) {
            this.titleEl.classList.remove('text-ellipsis', 'simpletip', 'simpletip-tc');
        }
    }

    attachIcon() {
        this.iconEl = document.createElement('i');
        this.el.append(this.iconEl);
    }

    attachCaret() {
        if (this._caret) {
            return;
        }

        this._caret = document.createElement('span');
        this._caret.classList.add('nw-fm-tree-arrow', 'rot-90', 'ml-1');
        this.el.append(this._caret);
    }

    detachCaret() {
        if (this._caret) {
            this.el.removeChild(this._caret);
            delete this._caret;
        }
    }

    resetItemOptions() {
        this._menu.options = [
            {
                label: this.allItemsTitle,
                click: () => {
                    M.openFolder(this._filterSection, true);
                },
                selected: M.currentdirid === this._filterSection
            },
            { label: l.gallery_show_only },
            {
                label: l.gallery_from_cloud_drive,
                click: () => {
                    M.openFolder(this.cdFolder, true);
                },
                selected: M.currentdirid === this.cdFolder
            },
            {
                label: l.gallery_camera_uploads,
                click: () => {
                    M.openFolder(this.cuFolder, true);
                },
                selected: M.currentdirid === this.cuFolder
            }
        ];
    }

    initMenu() {
        if (!this._menu) {
            this._menu = new MMenuSelect(this.el, ['item-bold']);
            this._menu.width = 200;
        }
    }

    toggleMenu() {
        this.initMenu();
        this._menu.toggle();
    }

    hide() {
        if (this._menu) {
            this._menu.hide();
        }
    }
}
