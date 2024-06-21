const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Email configuration using environment variables
const transporter = nodemailer.createTransport({
    service: 'hotmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Root route to handle GET requests to the root URL
app.get('/', (req, res) => {
    res.send('Hello, World! The server is running.');
});

// Function to send email
const sendEmail = (subject, text) => {
    const mailOptions = {
        from: process.env.EMAIL_USER, // Sender address
        to: 'liambailey131@outlook.com', // List of recipients
        subject: subject,
        text: text
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Error sending email:', error);
            return;
        }
        console.log('Email sent:', info.response);
    });
};

// Webhook endpoint
app.post('/webhook', (req, res) => {
    console.log('Webhook received:', req.body);

    const notificationType = req.body.type;
    const data = req.body.data;

    let subject, text;
    switch (notificationType) {
        case 'install':
            subject = 'New App Installation';
            text = `A new user has installed your app:\n${JSON.stringify(data, null, 2)}`;
            break;
        case 'app_subscription_created':
            subject = 'New App Subscription Created';
            text = `A new subscription has been created:\n${JSON.stringify(data, null, 2)}`;
            break;
        case 'app_subscription_changed':
            subject = 'App Subscription Changed';
            text = `A subscription has been changed:\n${JSON.stringify(data, null, 2)}`;
            break;
        case 'app_trial_subscription_started':
            subject = 'App Trial Subscription Started';
            text = `A trial subscription has started:\n${JSON.stringify(data, null, 2)}`;
            break;
        default:
            res.sendStatus(200); // Ignore other events
            return;
    }

    sendEmail(subject, text);
    res.sendStatus(200);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
