import {open_modal} from "../widgets/modal.js";
import {open_create_repos_modal} from "./create-repos-form";

const delete_repos_form = require('./delete_repos.hbs')

function delete_repos(e) {
    open_modal(delete_repos_form(), '500px', '170px');

    let remaining_s = 5;
    const coundown_bar = document.getElementById('countdown-bar');
    const coundown_button = document.getElementById('countdown-button');
    coundown_button.disabled = true;
    const countdown = () => {
        if (remaining_s > 0) {
            remaining_s -= 1 / 30;
            setTimeout(countdown, 1000 / 30);
        } else {
            coundown_button.disabled = false;
        }

        coundown_bar.style.width = `${100 - remaining_s * 20}%`
    }
    countdown();
}

window.delete_repos = {delete_repos}
export {delete_repos}