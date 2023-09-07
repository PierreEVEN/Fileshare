const context_action_hbs = require('./context_action.hbs')

const mouse_pos = {x: 0, y: 0}
document.addEventListener('mousemove', event => {
    mouse_pos.x = event.clientX
    mouse_pos.y = event.clientY
})

document.addEventListener('click', () => {
    if (last_context_action)
        last_context_action.remove();
    last_context_action = null;
})

document.oncontextmenu = () => {
    if (last_context_action)
        last_context_action.remove();
    last_context_action = null;
}

let last_context_action = null;

let objects = {}

function click_object(id) {
    objects[id]();
}

function spawn_context_action(actions) {
    setTimeout(() => {
        if (last_context_action)
            last_context_action.remove();

        objects = {}
        for (const action of actions)
            objects[action.title] = () => {
                if (last_context_action)
                    last_context_action.remove();
                last_context_action = null;
                action.action();
            }

        last_context_action = context_action_hbs({actions: actions});
        last_context_action.style.left = Math.min(window.innerWidth - 200, mouse_pos.x) + 'px';
        last_context_action.style.top = Math.min(window.innerHeight - 40 * actions.length, mouse_pos.y) + 'px';
        document.body.append(last_context_action)
    }, 10);
}

window.context_action = {spawn_context_action, click_object}
export {spawn_context_action}