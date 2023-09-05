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

function spawn_context_action(actions) {
    setTimeout(() => {
        if (last_context_action)
            last_context_action.remove();
        const modal = document.createElement('div')
        modal.classList.add('context-action-box')

        modal.style.left = Math.min(window.innerWidth - 200, mouse_pos.x) + 'px';
        modal.style.top = Math.min(window.innerHeight - 40 * actions.length, mouse_pos.y) + 'px';

        for (const action of actions) {
            const input = document.createElement('button')
            input.type = 'button'

            if (action.image) {
                const image = document.createElement('img')
                image.src = action.image;
                image.alt = action.title;
                input.append(image)
            }

            const p = document.createElement('p')
            p.innerText = action.title;
            input.append(p)

            input.onclick = e => {
                if (last_context_action)
                    last_context_action.remove();
                last_context_action = null;
                action.action(e);
            }
            modal.append(input)
        }

        last_context_action = modal;
        document.body.append(modal)
    }, 10);
}

window.context_action = {spawn_context_action}
export {spawn_context_action}