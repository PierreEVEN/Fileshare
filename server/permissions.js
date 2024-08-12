const {Repos} = require("./database/repos");
const {UserRepos} = require("./database/user_repos");

class ServerPermissions {
    /**
     * @param item {Item}
     * @param user_id {number}
     * @return {Promise<boolean>}
     */
    static async can_user_access_item(item, user_id) {
        if (!item)
            return false;

        // Currently there is no way to allow public access for a specific directory inside a private repository
        return ServerPermissions.can_user_view_repos(await Repos.from_id(item.repos), user_id);
    }

    /**
     * @param item {Item}
     * @param user_id {number}
     * @return {Promise<boolean>}
     */
    static async can_user_edit_item(item, user_id) {
        if (!item)
            return false;

        if (!user_id)
            return false;

        // The person who created this object can always edit or delete it
        if (item.owner === user_id)
            return true;

        // The people who have admin right on the repos can edit or delete the directory as well
        return ServerPermissions.can_user_configure_repos(await Repos.from_id(item.repos), user_id);
    }

    /**
     * @param directory {Item}
     * @param user_id {number}
     * @return {Promise<boolean|boolean>}
     */
    static async can_user_upload_to_directory(directory, user_id) {

        // Ensure the user can access the directory before checking it can upload to it
        if (!await ServerPermissions.can_user_access_item(directory, user_id))
            return false;

        if (!user_id)
            return false;

        if (directory.is_regular_file)
            return false;

        // The people who created the directory can always upload content inside it
        if (directory.owner === user_id)
            return true;

        // Anyone can upload to a repos that is open to public upload
        if (directory.open_upload === undefined)
            await directory.as_directory()
        if (directory.open_upload)
            return true;

        // The people who have upload right on the repos can edit or delete the directory as well
        return ServerPermissions.can_user_upload_to_repos(await Repos.from_id(directory.repos), user_id);
    }

    /**
     * @param repos {Repos}
     * @param user_id {number}
     * @return {Promise<boolean|boolean>}
     */
    static async can_user_view_repos(repos, user_id) {
        // The repo is not private
        if (repos.status !== 'private')
            return true;

        if (!user_id)
            return false;

        // The user is the owner
        if (repos.owner === user_id)
            return true;

        // The user has admin access to this repos
        return await UserRepos.exists(user_id, repos.id) !== null;
    }

    /**
     * @param repos {Repos}
     * @param user_id {number}
     * @return {Promise<boolean|boolean>}
     */
    static async can_user_configure_repos(repos, user_id) {
        // The user have to be connected
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
     * @param repos {Repos}
     * @param user_id {number}
     * @return {Promise<boolean|boolean>}
     */
    static async can_user_upload_to_repos(repos, user_id) {
        // Ensure the user is able to see the repos before uploading to it
        if (!await ServerPermissions.can_user_view_repos(repos, user_id))
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
}

module.exports = {ServerPermissions};