require('./context_menu.scss')

/**
 * @type {null|ContextMenu}
 */
let CURRENT_CONTEXT_MENU = null;


const mouse_pos = {x: 0, y: 0}
document.addEventListener('mousemove', event => {
    mouse_pos.x = event.clientX
    mouse_pos.y = event.clientY
})

document.addEventListener('click', () => {
    if (CURRENT_CONTEXT_MENU)
        CURRENT_CONTEXT_MENU.close();
})

document.oncontextmenu = () => {
    if (CURRENT_CONTEXT_MENU && CURRENT_CONTEXT_MENU._can_close)
        CURRENT_CONTEXT_MENU.close();
}

class MenuAction {
    /**
     * @param title {string}
     * @param image {string}
     * @param action {function}
     * @param checked {boolean}
     */
    constructor(title, image, action, checked = false) {
        this.title = title;
        this.image = image;
        this.action = action;
        this.checked = checked;
    }

}

class ContextMenu {
    constructor() {
        if (CURRENT_CONTEXT_MENU)
            CURRENT_CONTEXT_MENU.close();

        setTimeout(() => {
            CURRENT_CONTEXT_MENU = this;
        }, 10);

        this._actions = [];

        const widget = document.createElement('div');
        widget.classList.add("context-action-box");
        this._widget = widget;
        this._widget.style.left = Math.min(window.innerWidth - 200, mouse_pos.x) + 'px';
        this._widget.style.top = mouse_pos.y + 'px';
        this._initial_pos = {x: mouse_pos.x, y: mouse_pos.y};
        document.body.append(widget);

        setTimeout(() => {
            this._can_close = true;
        }, 10);
    }

    /**
     * @param action {MenuAction}
     */
    add_action(action) {
        this._actions.push(action);
        const action_widget = require('./context_menu.hbs')(action, {
            click: () => {
                action.action();
            }
        });
        this._widget.append(action_widget)
        this._widget.style.top = Math.min(window.innerHeight - 40 * this._actions.length, this._initial_pos.y) + 'px';
        document.body.append(this._widget)
    }

    close() {
        CURRENT_CONTEXT_MENU = null;
        this._widget.remove();
    }
}

export {ContextMenu, MenuAction}