self.addEventListener('push', function (event) {
    if (!(self.Notification && self.Notification.permission === 'granted')) {
        return;
    }

    const sendNotification = (msg) => {
        // you could refresh a notification badge here with postMessage API
        const title = 'Web Push example';

        return self.registration.showNotification(title, msg);
    };

    // Notice this part carefully. event.waitUntil is only getting called when event.data is non-empty.
    if (event.data) {
        console.log(event);
        const message = event.data.json();
        event.waitUntil(sendNotification(message));
    }
});
