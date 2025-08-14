require('./notification.scss')

class Message {
    /**
     * @param text {string}
     */
    constructor(text) {
        if (text && (text['message'] || text['code'])) {
            if (!text['message'])
                this._text = text['code'];
            else
                this._text = text['message'];
        } else
            this._text = text.toString();
        this._lifespan = 5000;
    }

    /**
     * @param title {string}
     * @return {Message}
     */
    title(title) {
        this._title = title.toString();
        return this;
    }

    /**
     * @param lifespan {number} Milliseconds (0 for infinite lifetime)
     * @return {Message}
     */
    lifespan(lifespan = 0) {
        this._lifespan = lifespan;
        return this;
    }
}

class Notification {
    constructor() {
        this.notification_box = require('./notification_box_container.hbs')({}, {})

        document.body.append(this.notification_box)
    }

    /**
     * @param level {string}
     * @param message {Message}
     */
    push(level, message) {
        let image = '';
        switch (level) {
            case "error":
                console.error(`${message._title ? message._title : 'error'} : ${message._text}`);
                image = '/public/images/icons/icons8-haute-priorite-48.png';
                break;
            case "warn":
                console.warn(`${message._title ? message._title : 'warn'} : ${message._text}`);
                image = '/public/images/icons/icons8-avertissement-emoji-48.png';
                break;
            case "info":
                console.info(`${message._title ? message._title : 'info'} : ${message._text}`);
                image = '/public/images/icons/icons8-info-48.png';
                break;
            case "success":
                console.info(`${message._title ? message._title : 'success'} : ${message._text}`);
                image = '/public/images/icons/icons8-ok-48.png';
                break;
        }

        let notification = require('./notification_message.hbs')({
            title: message._title,
            text: message._text,
            icon: image
        }, {
            dismiss: () => {
                notification.classList.remove('open');
                setTimeout(() => {
                    notification.remove();
                }, 200);
            }
        })

        if (message._lifespan !== 0) {
            setTimeout(() => {
                notification.classList.remove('open');
                setTimeout(() => {
                    notification.remove();
                }, 200);
            }, message._lifespan)
        }


        notification.classList.add(level);
        setTimeout(() => {
            notification.classList.add('open');
        }, 10)
        this.notification_box.append(notification);
    }

    /**
     * @param message {Message}
     */
    fatal(message) {
        this.push('error', message);
        throw (`${message._title} : ${message._text}`);
    }

    /**
     * @param message {Message}
     */
    error(message) {
        this.push('error', message);
    }

    /**
     * @param message {Message}
     */
    warn(message) {
        this.push('warn', message);
    }

    /**
     * @param message {Message}
     */
    info(message) {
        this.push('info', message);
    }

    /**
     * @param message {Message}
     */
    success(message) {
        this.push('success', message);
    }
}

const NOTIFICATION = new Notification();

export {NOTIFICATION, Message}