
class FilesystemStream {
    async fetch_filtered(filter, directory) {
        const data = filter.data();
        data.repositories = [
            {
                repository: this._repository.id.toString(),
                root_items: directory ? [directory.id] : []
            }
        ]
        const item_ids = await this.app.fetch_api(`item/search`, 'POST', data).catch(error => {
            NOTIFICATION.warn(new Message(error).title(`Impossible de chercher des éléments dan sle dépot ${this._repository.url_name.plain()}`));
            return [];
        });
        return await this.fetch_item(item_ids, false);
    }
}