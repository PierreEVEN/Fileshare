const nodemailer = require('nodemailer');

async function send_mail(to, subject, message) {
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: true, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_AUTH, // your domain email address
            pass: process.env.EMAIL_PASSWD // your password
        }
    });
    const mail_options = {
        from: `"Fileshare" <${process.env.EMAIL_AUTH}>`,
        to: `${to}`,
        subject: `${subject}`,
        html: `${message}`
    };
    transporter.sendMail(mail_options, function (err, info) {
        if (err) {
            console.error('Failed to send enmail : ', err);
        }
    });
}

module.exports = {send_mail}