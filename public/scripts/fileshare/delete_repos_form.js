function delete_repos(e) {
    const delete_repos_modal = document.createElement('div')
    delete_repos_modal.classList.add('login')
    delete_repos_modal.innerHTML = `
            <h1>Supprimer ce dépôt et toutes ses données ?</h1>
            <form action="/fileshare/delete-repos/${e.attributes.repos.value}" method="post" class="delete-repos">
                <input type="button" value="Annuler" onclick="close_modal()">
                <input type="submit" value="Oui : Supprimer" id="countdown-button">
            </form>
            <div class="delete-repos-progress">
                <div id="countdown-bar"></div>
            </div>`
    open_modal(delete_repos_modal, '500px', '170px');

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

module.delete_repos = {delete_repos}

export {delete_repos}