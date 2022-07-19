const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieSession = require('cookie-session');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
} = require('@simplewebauthn/server');

const inMemoryUserDeviceDB = {
    // [loggedInUserId]: {
    //   id: loggedInUserId,
    //   username: `user@${rpID}`,
    //   devices: [],
    //   currentChallenge: undefined,
    // },
};

const rpName = 'Perkins SSO';
const rpID = 'localhost';
const origin = 'http://localhost:8000';

const app = express();
app.use(bodyParser.json());
app.use(cors());

app.use(
    cookieSession({
        name: 'session',
        keys: [crypto.randomBytes(32).toString('hex')],

        // Cookie Options
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
    })
);
app.use(cookieParser());

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, '/index.html'));
});

app.get('/generate-registration-options', function (req, res) {
    let input_username = req.body.username;
    const id = crypto.randomUUID();
    console.log(id);

    inMemoryUserDeviceDB[id] = {
        id: crypto.randomUUID(),
        username: `${input_username}@${rpID}`,
        devices: [],
        currentChallenge: undefined,
    };

    user = inMemoryUserDeviceDB[id];

    const { username, devices } = user;

    const options = generateRegistrationOptions({
        rpName,
        rpID,
        userID: id,
        userName: username,
        timeout: 60000,
        attestationType: 'none',
        /**
         * Passing in a user's list of already-registered authenticator IDs here prevents users from
         * registering the same device multiple times. The authenticator will simply throw an error in
         * the browser if it's asked to perform registration when one of these ID's already resides
         * on it.
         */
        excludeCredentials: devices.map((dev) => ({
            id: dev.credentialID,
            type: 'public-key',
            transports: dev.transports,
        })),
        /**
         * The optional authenticatorSelection property allows for specifying more constraints around
         * the types of authenticators that users to can use for registration
         */
        authenticatorSelection: {
            userVerification: 'required',
            residentKey: 'required',
        },
        /**
         * Support the two most common algorithms: ES256, and RS256
         */
        supportedAlgorithmIDs: [-7, -257],
    });

    inMemoryUserDeviceDB[id].currentChallenge = options.challenge;
    req.session.id = id;

    res.send(options);
});

app.post('/verify-registration', async function (req, res) {
    const { body } = req;

    const id = req.session.id;

    const user = inMemoryUserDeviceDB[id];
    // (Pseudocode) Get `options.challenge` that was saved above
    const expectedChallenge = user.currentChallenge;

    let verification;
    try {
        const opts = {
            credential: body,
            expectedChallenge: `${expectedChallenge}`,
            expectedOrigin: 'http://localhost:8000',
            expectedRPID: rpID,
            requireUserVerification: true,
        };
        verification = await verifyRegistrationResponse(opts);
    } catch (error) {
        const _error = error;
        console.error(_error);
        return res.status(400).send({ error: _error.message });
    }

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
        const { credentialPublicKey, credentialID, counter } = registrationInfo;

        const existingDevice = user.devices.find((device) =>
            device.credentialID.equals(credentialID)
        );

        if (!existingDevice) {
            /**
             * Add the returned device to the user's list of devices
             */
            const newDevice = {
                credentialPublicKey,
                credentialID,
                counter,
                transports: body.transports,
            };
            user.devices.push(newDevice);
        }
    }

    res.send({ verified });
});

app.listen(8000);
