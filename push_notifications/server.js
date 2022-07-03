// Use the web-push library to hide the implementation details of the communication
// between the application server and the push service.
// For details, see https://tools.ietf.org/html/draft-ietf-webpush-protocol and
// https://tools.ietf.org/html/draft-ietf-webpush-encryption.
const webPush = require('web-push');
require('dotenv').config();

if (!process.env.PUBLIC_KEY || !process.env.PRIVATE_KEY) {
    console.log(
        'You must set the VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY ' +
            'environment variables. You can use the following ones:'
    );
    console.log(webPush.generateVAPIDKeys());
    return;
}
// Set the keys used for encrypting the push messages.
webPush.setVapidDetails(
    'mailto:perkinsandy0@gmail.com',
    process.env.PUBLIC_KEY,
    process.env.PRIVATE_KEY
);

const payload = JSON.stringify({
    title: 'Notification Spike',
    body: 'This is a test notification',
    actions: [
        {
            action: 'coffee-action',
            title: 'Coffee',
        },
        {
            action: 'doughnut-action',
            title: 'Doughnut',
        },
    ],
});

const options = {
    vapidDetails: {
        subject: 'mailto:perkinsandy0@gmail.com',
        publicKey: process.env.PUBLIC_KEY,
        privateKey: process.env.PRIVATE_KEY,
    },
};

let pushSubscriptions = [
    {
        endpoint:
            'https://fcm.googleapis.com/fcm/send/eSjDOkU9sJI:APA91bGxynhPQ-0jySjzswZT33stWqsXLJCrHm-KZujoQwnF9QDLWH1hjTuxnKir5nTRnalXLQdcnNwS51aL7ijgBAW9HQxjixtLDygpGYo8cuRNZiaCu_vYM20f2yy4r5DoqXUtOU2d',
        expirationTime: null,
        keys: {
            p256dh: 'BHoQmHYFPO22UHMAcsBoZl44qR_9d9Kvk4hWaJ31V1nucNQ_uwP2lWB8mN_2pLnSGJMhAD_KDGrURRgAtBSl78k',
            auth: 'eGFXr9FzywyGWzpW8vC0zg',
        },
    },
];

for (const subscription of pushSubscriptions) {
    webPush.sendNotification(subscription, payload, options);
}

return 0;
