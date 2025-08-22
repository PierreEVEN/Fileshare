import {AppWidget} from "../app_widget";

/**
 * @type {NavigableAppWidget}
 */
let FOCUSED_ITEM = null;

document.addEventListener('focusin', e => {
    const new_elem = e.target.closest('.app-navigable-item');
    if (FOCUSED_ITEM === new_elem)
        return;
    if (new_elem) {
        const old = FOCUSED_ITEM;
        if (old && old.focus_out)
            old.focus_out(e)
        FOCUSED_ITEM = new_elem;
        FOCUSED_ITEM._last_focused_item = old;
        if (FOCUSED_ITEM.focus_in)
            FOCUSED_ITEM.focus_in(e);
        //console.log("Focus", FOCUSED_ITEM)
    } else {
        console.warn("Item", e.target, "is not focusable")
    }
});

document.addEventListener('keydown', e => {
    if (FOCUSED_ITEM) {
        if (e.key === 'ArrowRight' && FOCUSED_ITEM.move_next)
            FOCUSED_ITEM.move_next(e);
        else if (e.key === 'ArrowLeft' && FOCUSED_ITEM.move_previous)
            FOCUSED_ITEM.move_previous(e);
        else if (e.key === 'ArrowDown' && (FOCUSED_ITEM.move_down || FOCUSED_ITEM.move_next))
            FOCUSED_ITEM.move_down ? FOCUSED_ITEM.move_down(e) : FOCUSED_ITEM.move_next(e);
        else if (e.key === 'ArrowUp' && (FOCUSED_ITEM.move_up || FOCUSED_ITEM.move_previous))
            FOCUSED_ITEM.move_up ? FOCUSED_ITEM.move_up(e) : FOCUSED_ITEM.move_previous(e);
        else if (e.key === 'Escape' && FOCUSED_ITEM.exit)
            FOCUSED_ITEM.exit(e);
        else if (e.key === 'Backspace' && (FOCUSED_ITEM.back || FOCUSED_ITEM.exit))
            FOCUSED_ITEM.back ? FOCUSED_ITEM.back(e) : FOCUSED_ITEM.exit(e);
        else if (e.key === 'Enter' && FOCUSED_ITEM.enter)
            FOCUSED_ITEM.enter(e);

        if (FOCUSED_ITEM.any_key)
            FOCUSED_ITEM.any_key(e);
    }
})

/**
 * @class
 * @property {Function} focus_in Navigable callback
 * @property {Function} focus_out Navigable callback
 * @property {Function} move_next Navigable callback
 * @property {Function} move_previous Navigable callback
 * @property {Function} move_up Navigable callback
 * @property {Function} move_down Navigable callback
 * @property {Function} exit Navigable callback
 * @property {Function} back Navigable callback
 * @property {Function} enter Navigable callback
 * @property {Function} any_key Navigable callback
 */
class NavigableAppWidget extends AppWidget {
    /**
     * @param tab_index {number}
     */
    constructor(tab_index = 0) {
        super();
        this._tab_index = tab_index;
        /**
         * @type {NavigableAppWidget}
         * @private
         */
        this._last_focused_item = null;
    }

    /**
     * @return {NavigableAppWidget}
     */
    get_last_focused_item() {
        return this._last_focused_item;
    }

    connectedCallback() {
        this.tabIndex = this._tab_index;
        this.classList.add('app-navigable-item');
    }
}

export {NavigableAppWidget}