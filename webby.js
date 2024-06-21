const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Email configuration using environment variables
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Root route to handle GET requests to the root URL
app.get('/', (req, res) => {
    res.send('Hello, World! The server is running.');
});

// Webhook endpoint
app.post('/webhook', (req, res) => {
    const notificationType = req.body.type;
    const data = req.body.data;

    if (notificationType === 'install') {
        const { user_name, user_email, account_name } = data;

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: 'liambailey131@outlook.com',
            subject: 'New App Installation',
            text: `A new user has installed your app:
            Name: ${user_name}
            Email: ${user_email}
            Account: ${account_name}`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return console.log(error);
            }
            console.log('Email sent: ' + info.response);
        });
    }

    res.sendStatus(200);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
