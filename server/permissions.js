const {Repos} = require("./database/repos");
const {UserRepos} = require("./database/user_repos");

class Permissions {
    /**
     * @param directory {Directories}
     * @param user_id {number}
     * @return {Promise<boolean|boolean>}
     */
    async can_user_view_directory(directory, user_id) {
        if (!user_id)
            return false

        // The people who created the directory can always edit or delete it
        if (directory.owner === user_id)
            return true;

        // The people who have admin right on the repos can edit or delete the directory as well
        const repos = await Repos.from_id(directory.repos);
        return this.can_user_view_repos(repos, user_id);
    }

    /**
     * @param directory {Directories}
     * @param user_id {number}
     * @return {Promise<boolean|boolean>}
     */
    async can_user_upload_to_directory(directory, user_id) {
        if (!user_id)
            return false;

        // The people who created the directory can always edit or delete it
        if (directory.owner === user_id)
            return true;

        if (directory.open_upload)
            return true;

        // The people who have admin right on the repos can edit or delete the directory as well
        const repos = await Repos.from_id(directory.repos);
        return this.can_user_upload_to_repos(repos, user_id);
    }

    /**
     * @param directory {Directories}
     * @param user_id {number}
     * @return {Promise<boolean|boolean>}
     */
    async can_user_edit_directory(directory, user_id) {
        if (!user_id)
            return false;

        // The people who created the directory can always edit or delete it
        if (directory.owner === user_id)
            return true;

        // The people who have admin right on the repos can edit or delete the directory as well
        const repos = await Repos.from_id(directory.repos);
        return this.can_user_edit_repos(repos, user_id);
    }


    /**
     * @param repos {Repos}
     * @param user_id {number}
     * @return {Promise<boolean|boolean>}
     */
    async can_user_view_repos(repos, user_id) {
        if (repos.status !== 'private')
            return true;

        if (!user_id)
            return false;

        if (repos.owner === user_id)
            return true;

        return await UserRepos.exists(user_id, repos.id) !== null;
    }

    /**
     * @param repos {Repos}
     * @param user_id {number}
     * @return {Promise<boolean|boolean>}
     */
    async can_user_upload_to_repos(repos, user_id) {
        if (!user_id)
            return false;

        // The owner of a repos can always upload to it
        if (repos.owner === user_id || repos.allow_visitor_upload)
            return true;

        // Also the other people who have upload rights on the repos
        const user_repos = await UserRepos.exists(user_id, repos.id);
        if (!user_repos)
            return false;
        return user_repos.can_upload();
    }

    /**
     * @param repos {Repos}
     * @param user_id {number}
     * @return {Promise<boolean|boolean>}
     */
    async can_user_edit_repos(repos, user_id) {
        if (!user_id)
            return false;

        // The owner of a repos can always edit it
        if (repos.owner === user_id)
            return true;

        // Also the other people who have the right on the repos
        const user_repos = await UserRepos.exists(user_id, repos.id);
        if (!user_repos)
            return false;
        return user_repos.can_edit();
    }

    /**
     * @param file {File}
     * @param user_id {number}
     * @return {Promise<boolean>}
     */
    async can_user_view_file(file, user_id) {
        const repos = await Repos.from_id(file.repos);

        if (repos.status !== 'private')
            return true;

        if (!user_id)
            return false;

        if (repos.owner === user_id)
            return true;

        return await UserRepos.exists(user_id, repos.id) !== null;
    }

    /**
     * @param file {File}
     * @param user_id {number}
     * @return {Promise<boolean>}
     */
    async can_user_edit_item(file, user_id) {
        if (!user_id)
            return false;

        // The people who created the directory can always edit or delete it
        if (file.owner === user_id)
            return true;

        // The people who have admin right on the repos can edit or delete the directory as well
        const repos = await Repos.from_id(file.repos);
        return this.can_user_edit_repos(repos, user_id);
    }
}

const perms = new Permissions()

module.exports = perms;