import {open_modal} from "../components/modal.js";

require('./delete-repos.scss')

const delete_repos_form = require('./delete_repos.hbs')

function delete_repos(e) {
    open_modal(delete_repos_form(e, {
        clicked: async () => {
            if (remaining_s <= 0) {
                await fetch(`/${e.username}/${e.name}/delete`, {method:'POST'})
                window.location = `/`;
            }
        }
    }), '500px', '180px', 'delete-repos');

    let remaining_s = 5;
    const countdown_bar = document.getElementsByClassName('progress-bar')[0];
    const countdown_button = document.getElementById('countdown-button');
    countdown_button.disabled = true;
    const countdown = () => {
        if (remaining_s > 0) {
            remaining_s -= 1 / 30;
            setTimeout(countdown, 1000 / 30);
        } else {
            countdown_button.disabled = false;
            countdown_button.value = 'Supprimer'
            return;
        }
        countdown_button.value = `${Math.ceil(remaining_s)}s`
        countdown_bar.style.width = `${100 - remaining_s * 20}%`
    }
    countdown();
}

window.delete_repos = {delete_repos}
export {delete_repos}